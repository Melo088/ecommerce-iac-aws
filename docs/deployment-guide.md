# Guía de Despliegue — ecommerce-iac-aws

Esta guía cubre el deploy completo desde cero en un entorno AWS Academy (sandbox).  
Tiempo estimado total: **45–60 minutos**.

---

## Prerrequisitos

| Herramienta | Versión mínima | Verificar |
|---|---|---|
| AWS CLI | v2 | `aws --version` |
| Java / Maven | 21 / 3.9 | `java -version` |
| Node.js / npm | 20 / 10 | `node --version` |
| Git | cualquier | `git --version` |

Clonar el repositorio:
```bash
git clone <url-del-repo>
cd ecommerce-iac-aws
```

---

## Paso 0 — Configurar credenciales AWS Academy

Cada vez que se inicia una sesión de laboratorio, las credenciales cambian. Ejecutar:

```bash
source infrastructure/scripts/set-aws-session.sh
```

El script solicita `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y `AWS_SESSION_TOKEN` (disponibles en el panel de AWS Academy → "AWS Details") y los exporta como variables de entorno. Valida las credenciales con `aws sts get-caller-identity`.

> **Importante:** Las credenciales solo persisten en la sesión de terminal actual. Si se abre una nueva terminal, hay que ejecutar el script nuevamente.

---

## Paso 1 — Subir templates y preparar bucket S3

```bash
./infrastructure/scripts/upload-templates.sh prod
```

Este script:
1. Verifica si el bucket `ecom-artifacts-prod-<ACCOUNT_ID>` existe. Si no, despliega `00-s3-artifacts.yaml` para crearlo.
2. Sube los 9 templates YAML al prefijo `cloudformation/` dentro del bucket.
3. Crea el key pair `ecom-keypair` en AWS si no existe y lo guarda en `~/.ssh/ecom-keypair.pem`.

Al finalizar imprime las URLs HTTPS de cada template en S3 y un comando de ejemplo para el stack principal.

---

## Paso 2 — Compilar el backend y subir el JAR

```bash
cd backend
./mvnw clean package -DskipTests
cd ..
```

El JAR se genera en `backend/target/ecom-app.jar` (nombre configurado con `<finalName>ecom-app</finalName>` en `pom.xml`).

Subir al bucket S3 donde el user-data de EC2 lo espera:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws s3 cp backend/target/ecom-app.jar \
  s3://ecom-artifacts-prod-${ACCOUNT_ID}/backend/ecom-app.jar
```

---

## Paso 3 — Desplegar la infraestructura completa

```bash
./infrastructure/scripts/deploy-all.sh prod
```

El script solicita cuatro valores de forma interactiva:

| Prompt | Valor |
|---|---|
| `AlertEmail` | Email que recibirá notificaciones de CloudWatch/SNS |
| `DBPassword` | Contraseña para el usuario `ecomadmin` de PostgreSQL (mínimo 8 caracteres) |
| `MpAccessToken` | Access token de MercadoPago (formato `APP_USR-...`) |
| `JwtSecret` | Secreto para firmar JWT (mínimo 32 caracteres) |

**Orden de despliegue y tiempos aproximados:**

| Stack | Template | Tiempo |
|---|---|---|
| `ecom-s3-artifacts` | `00-s3-artifacts.yaml` | ~1 min (omitido si ya existe) |
| `ecom-vpc` | `01-vpc.yaml` | ~3 min |
| `ecom-sg` | `02-security-groups.yaml` | ~1 min |
| `ecom-rds` | `03-rds.yaml` | ~10 min |
| `ecom-alb` | `04-alb.yaml` | ~3 min |
| `ecom-asg` | `05-autoscaling.yaml` | ~5 min |
| `ecom-cw` | `06-cloudwatch.yaml` | ~1 min |

> **Nota SNS:** AWS enviará un email de confirmación a la dirección ingresada. Hacer clic en "Confirm subscription" para activar las alertas.

Obtener el DNS del ALB al finalizar:
```bash
aws cloudformation describe-stacks \
  --stack-name ecom-alb \
  --query 'Stacks[0].Outputs[?OutputKey==`AlbDnsName`].OutputValue' \
  --output text
```

---

## Paso 4 — Desplegar el hosting del frontend (S3 + CloudFront)

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws cloudformation create-stack \
  --stack-name ecom-frontend \
  --template-url https://s3.us-east-1.amazonaws.com/ecom-artifacts-prod-${ACCOUNT_ID}/cloudformation/07-frontend.yaml \
  --parameters ParameterKey=AlbStackName,ParameterValue=ecom-alb \
  --region us-east-1

aws cloudformation wait stack-create-complete --stack-name ecom-frontend
```

Tiempo estimado: **10–15 minutos** (CloudFront tarda en provisionarse globalmente).

Guardar las URLs de salida para los pasos siguientes:
```bash
aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs'
```

Outputs relevantes:
- `BackendCloudFrontUrl` — URL HTTPS del backend (usar como `VITE_API_URL`)
- `FrontendCloudFrontUrl` — URL HTTPS del frontend (usar como `APP_FRONTEND_URL`)
- `FrontendBucketName` — bucket donde subir el build
- `FrontendDistributionId` — ID de la distribución (para invalidaciones)

---

## Paso 5 — Compilar y subir el frontend

Con las URLs de CloudFront disponibles, compilar el frontend apuntando al backend correcto:

```bash
BACKEND_CF=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendCloudFrontUrl`].OutputValue' --output text)
FRONTEND_BUCKET=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' --output text)
FRONTEND_DIST=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendDistributionId`].OutputValue' --output text)

cd frontend
VITE_API_URL=${BACKEND_CF} \
VITE_MP_PUBLIC_KEY=<public-key-de-mercadopago> \
npm run build

aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete
aws cloudfront create-invalidation --distribution-id ${FRONTEND_DIST} --paths "/*"
cd ..
```

---

## Paso 6 — Actualizar el ASG con las URLs de CloudFront (rolling update)

Las instancias EC2 actuales tienen `APP_BACKEND_URL` y `APP_FRONTEND_URL` vacíos (fueron lanzadas antes de crear CloudFront). Actualizar el stack y reemplazar las instancias:

```bash
BACKEND_CF=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendCloudFrontUrl`].OutputValue' --output text)
FRONTEND_CF=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendCloudFrontUrl`].OutputValue' --output text)

aws cloudformation update-stack \
  --stack-name ecom-asg \
  --use-previous-template \
  --parameters \
    ParameterKey=BackendPublicUrl,ParameterValue=${BACKEND_CF} \
    ParameterKey=FrontendPublicUrl,ParameterValue=${FRONTEND_CF} \
    ParameterKey=KeyName,UsePreviousValue=true \
    ParameterKey=IamInstanceProfile,UsePreviousValue=true \
    ParameterKey=S3BucketName,UsePreviousValue=true \
    ParameterKey=S3JarPath,UsePreviousValue=true \
    ParameterKey=DBUsername,UsePreviousValue=true \
    ParameterKey=DBPassword,UsePreviousValue=true \
    ParameterKey=MpAccessToken,UsePreviousValue=true \
    ParameterKey=JwtSecret,UsePreviousValue=true \
    ParameterKey=VpcStackName,UsePreviousValue=true \
    ParameterKey=SgStackName,UsePreviousValue=true \
    ParameterKey=RdsStackName,UsePreviousValue=true \
    ParameterKey=AlbStackName,UsePreviousValue=true

aws cloudformation wait stack-update-complete --stack-name ecom-asg
```

Iniciar el reemplazo gradual de instancias (sin downtime):
```bash
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name ecom-asg \
  --preferences '{"MinHealthyPercentage": 50, "InstanceWarmup": 300}'
```

Monitorear hasta `Status: Successful`:
```bash
aws autoscaling describe-instance-refreshes \
  --auto-scaling-group-name ecom-asg \
  --query 'InstanceRefreshes[0].{Status:Status,Porcentaje:PercentageComplete}'
```

---

## Paso 7 — Verificación end-to-end

```bash
BACKEND_CF=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendCloudFrontUrl`].OutputValue' --output text)
FRONTEND_CF=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendCloudFrontUrl`].OutputValue' --output text)

echo "Frontend: ${FRONTEND_CF}"
echo "Backend:  ${BACKEND_CF}"

# Health check del backend
curl -s ${BACKEND_CF}/api/v1/health

# Test del endpoint de webhook
curl -s -X POST ${BACKEND_CF}/api/v1/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"payment","data":{"id":"test-123"}}'
```

Configurar la URL de notificación en el panel de MercadoPago (sandbox):
```
https://<backend-cloudfront-domain>/api/v1/payments/webhook
```

---

## Actualizar el JAR del backend (deploys futuros)

Para redesplegar el backend sin recrear la infraestructura:

```bash
# 1. Compilar nuevo JAR
cd backend && ./mvnw clean package -DskipTests && cd ..

# 2. Subir a S3
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws s3 cp backend/target/ecom-app.jar \
  s3://ecom-artifacts-prod-${ACCOUNT_ID}/backend/ecom-app.jar

# 3. Reemplazar instancias (descargan el nuevo JAR al arrancar)
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name ecom-asg \
  --preferences '{"MinHealthyPercentage": 50, "InstanceWarmup": 300}'
```

---

## Acceso administrativo a EC2 (Systems Manager Session Manager)

Sin necesidad de SSH ni de exponer el Bastion:

```bash
INSTANCE_ID=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names ecom-asg \
  --query 'AutoScalingGroups[0].Instances[0].InstanceId' --output text)

aws ssm start-session --target ${INSTANCE_ID}
```

Ver logs de la aplicación Spring Boot:
```bash
journalctl -u ecom-app -f
```

---

## Teardown — eliminar toda la infraestructura

Eliminar los stacks en orden inverso para respetar dependencias:

```bash
for stack in ecom-frontend ecom-cw ecom-asg ecom-alb ecom-rds ecom-sg ecom-vpc ecom-s3-artifacts; do
  echo "Eliminando $stack..."
  aws cloudformation delete-stack --stack-name $stack
  aws cloudformation wait stack-delete-complete --stack-name $stack
  echo "$stack eliminado"
done
```

> **Nota:** RDS crea un snapshot automático antes de eliminarse (`DeletionPolicy: Snapshot`).  
> El bucket de artifacts y el bucket de frontend deben vaciarse manualmente antes de que CloudFormation pueda eliminarlos:
> ```bash
> aws s3 rm s3://ecom-artifacts-prod-<ACCOUNT_ID>/ --recursive
> aws s3 rm s3://ecom-frontend-prod-<ACCOUNT_ID>/ --recursive
> ```
