# Guía de Despliegue. ecommerce-iac-aws

Esta guía cubre el deploy completo desde cero en un entorno AWS Academy (sandbox).  
Tiempo estimado total: **45–60 minutos**.

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `set-aws-session.sh` | Configura credenciales AWS Academy en la sesión actual |
| `upload-templates.sh` | Sube templates CloudFormation a S3 y crea el key pair EC2 |
| `deploy-all.sh` | Despliega toda la infraestructura en orden |
| `upload-media.sh <bucket>` | Sube imágenes de productos al bucket S3 de media |
| `stress-test.sh` | Prueba de carga para verificar el auto scaling |
| `stress-test.sh --monitor-only` | Monitorea métricas de CPU y ASG sin lanzar carga |
| `demo-check.sh` | Verifica que toda la infraestructura está operativa antes de presentar |

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

## Paso 1. Subir templates y preparar bucket S3

```bash
./infrastructure/scripts/upload-templates.sh
```

Este script:
1. Verifica si el bucket `ecom-artifacts-prod-<ACCOUNT_ID>` existe. Si no, despliega `00-s3-artifacts.yaml` para crearlo.
2. Sube los 9 templates YAML al prefijo `cloudformation/` dentro del bucket.
3. Crea el key pair `ecom-keypair` en AWS si no existe y lo guarda en `~/.ssh/ecom-keypair.pem`.

Al finalizar imprime las URLs HTTPS de cada template en S3 y un comando de ejemplo para el stack principal.

---

## Paso 2. Compilar el backend y subir el JAR

```bash
cd backend && mvn clean package -DskipTests && cd ..
```

El JAR se genera en `backend/target/ecom-app.jar` (nombre configurado con `<finalName>ecom-app</finalName>` en `pom.xml`).

Subir al bucket S3 donde el user-data de EC2 lo espera:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws s3 cp backend/target/ecom-app.jar \
  s3://ecom-artifacts-prod-${ACCOUNT_ID}/backend/ecom-app.jar
```

---

## Paso 3. Desplegar la infraestructura completa

```bash
./infrastructure/scripts/deploy-all.sh
```

El script solicita cuatro valores de forma interactiva:

| Prompt | Valor |
|---|---|
| `AlertEmail` | Email que recibirá notificaciones de CloudWatch/SNS |
| `DBPassword` | Contraseña para el usuario `ecomadmin` de PostgreSQL (mínimo 8 caracteres) |
| `MpAccessToken` | Access token de MercadoPago de la cuenta de prueba (formato `APP_USR-...`) |
| `JwtSecret` | Secreto para firmar JWT (mínimo 32 caracteres), ej. `ecom-jwt-secret-prod-2026-min32chars` |

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
| `ecom-media` | `08-media.yaml` | ~10–15 min |
| `ecom-frontend` | `07-frontend.yaml` | ~10–15 min |

`deploy-all.sh` despliega **todos** los stacks incluyendo `ecom-media` (bucket S3 + CloudFront para imágenes de productos, con upload automático vía `upload-media.sh`) y `ecom-frontend` (hosting React + distribución CloudFront del backend). No es necesario ejecutar esos pasos por separado.

> **Pasos manuales que quedan después de este script:** seed de RDS (Paso 4), compilar y subir el frontend (Paso 5), y actualizar el ASG con las URLs de CloudFront (Paso 6).

> **Nota SNS:** AWS enviará un email de confirmación a la dirección ingresada. Hacer clic en "Confirm subscription" para activar las alertas.

> **Nota media bucket:** `deploy-all.sh` pasa automáticamente `S3MediaBucket=ecom-media-prod-<ACCOUNT_ID>` y `AwsRegion=us-east-1` al stack `ecom-asg`. Las instancias EC2 arrancan con las variables `S3_MEDIA_BUCKET` y `AWS_REGION` ya configuradas, de modo que el admin puede subir imágenes de productos y el backend genera las presigned URLs correctamente sin ningún paso manual adicional.

Obtener el DNS del ALB al finalizar:
```bash
aws cloudformation describe-stacks \
  --stack-name ecom-alb \
  --query 'Stacks[0].Outputs[?OutputKey==`AlbDnsName`].OutputValue' \
  --output text
```

---

## Paso 4. Seed de RDS (datos iniciales)

Para cargar productos en la base de datos de producción, conectarse al RDS mediante el Bastion Host:

```bash
# Obtener IP pública del Bastion desde el stack ecom-asg
BASTION_IP=$(aws cloudformation describe-stacks \
  --stack-name ecom-asg \
  --query "Stacks[0].Outputs[?OutputKey=='BastionPublicIp'].OutputValue" \
  --output text)
echo "Bastion: $BASTION_IP"

# Copiar el SQL al Bastion
scp -i ~/.ssh/ecom-keypair.pem backend/src/main/resources/data.sql \
  ec2-user@${BASTION_IP}:/tmp/data.sql

# Obten el endopoint de RDS 
DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name ecom-rds \
  --query 'Stacks[0].Outputs[?OutputKey==`DBEndpoint`].OutputValue' \
  --output text)
echo "DB Endpoint: $DB_ENDPOINT"

# SSH al Bastion
ssh -i ~/.ssh/ecom-keypair.pem ec2-user@${BASTION_IP}
```

Dentro del Bastion, obtener el endpoint de RDS y ejecutar el seed:

```bash
# Dentro del Bastion
psql -h <DB_ENPOINT> -U ecomadmin -d ecomdb -f /tmp/data.sql
# reemplaza <DB_ENDPOINT> por el resultado del comando anterior
# Password: el que ingresaste en deploy-all.sh (DBPassword)
# Resultado esperado: INSERT 0 62
exit
```

> El archivo `data.sql` se usa automáticamente en local (perfil H2), pero en RDS hay que ejecutarlo manualmente vía Bastion porque las instancias EC2 del ASG están en subredes privadas sin acceso directo.

---

## Paso 5. Compilar y subir el frontend

Con las URLs de CloudFront disponibles, compilar el frontend apuntando al backend correcto:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BACKEND_CF=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendCloudFrontUrl`].OutputValue' --output text)
FRONTEND_BUCKET=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' --output text)
FRONTEND_DIST=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendDistributionId`].OutputValue' --output text)
MEDIA_CF=$(aws cloudformation describe-stacks --stack-name ecom-media \
  --query 'Stacks[0].Outputs[?OutputKey==`MediaCloudFrontUrl`].OutputValue' --output text)

echo "Backend CF: $BACKEND_CF"
echo "Media CF:   $MEDIA_CF"
echo "Frontend Bucket: $FRONTEND_BUCKET"
echo "Frontend Dist:   $FRONTEND_DIST"

# La MP_PUBLIC_KEY es también de la cuenta de prueba.
cd frontend
VITE_API_URL=${BACKEND_CF} \
VITE_MP_PUBLIC_KEY=<tu-public-key-de-mercadopago> \
VITE_MEDIA_BUCKET_URL=${MEDIA_CF} \
npm run build

aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete
aws cloudfront create-invalidation --distribution-id ${FRONTEND_DIST} --paths "/*"
cd ..
```

---

## Paso 6. Actualizar el ASG con las URLs de CloudFront (rolling update)

Las instancias EC2 actuales tienen `APP_BACKEND_URL` y `APP_FRONTEND_URL` vacíos (fueron lanzadas antes de crear CloudFront). Actualizar el stack con el template en S3 (que incluye los parámetros `S3MediaBucket` y `AwsRegion`) y reemplazar las instancias:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BACKEND_CF=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendCloudFrontUrl`].OutputValue' --output text)
FRONTEND_CF=$(aws cloudformation describe-stacks --stack-name ecom-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendCloudFrontUrl`].OutputValue' --output text)

aws cloudformation update-stack \
  --stack-name ecom-asg \
  --template-url https://s3.us-east-1.amazonaws.com/ecom-artifacts-prod-${ACCOUNT_ID}/cloudformation/05-autoscaling.yaml \
  --parameters \
    ParameterKey=BackendPublicUrl,ParameterValue=${BACKEND_CF} \
    ParameterKey=FrontendPublicUrl,ParameterValue=${FRONTEND_CF} \
    ParameterKey=S3MediaBucket,ParameterValue=ecom-media-prod-${ACCOUNT_ID} \
    ParameterKey=AwsRegion,ParameterValue=us-east-1 \
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
echo "✓ ASG actualizado"
```

Iniciar el reemplazo gradual de instancias (sin downtime):
```bash
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name ecom-asg-prod \
  --preferences '{"MinHealthyPercentage": 50, "InstanceWarmup": 300}'
```

Monitorear hasta `Status: Successful`:
```bash
watch -n 30 "aws autoscaling describe-instance-refreshes \
  --auto-scaling-group-name ecom-asg-prod \
  --query 'InstanceRefreshes[0].{Status:Status,Pct:PercentageComplete}'"
```

---

## Paso 7. Verificación end-to-end

```bash
./infrastructure/scripts/demo-check.sh
```

> El script imprime las URLs del frontend, admin y backend al finalizar, junto con el estado de cada componente de la infraestructura.

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
  --auto-scaling-group-name ecom-asg-prod \
  --preferences '{"MinHealthyPercentage": 50, "InstanceWarmup": 300}'
```

---

## Acceso administrativo a EC2

### Opción A. SSH vía Bastion Host

Método documentado en los pasos anteriores (seed de RDS, troubleshooting). Requiere el archivo `~/.ssh/ecom-keypair.pem` y la IP pública del Bastion.

```bash
BASTION_IP=$(aws cloudformation describe-stacks \
  --stack-name ecom-asg \
  --query "Stacks[0].Outputs[?OutputKey=='BastionPublicIp'].OutputValue" \
  --output text)

# Acceso directo al Bastion
ssh -i ~/.ssh/ecom-keypair.pem ec2-user@${BASTION_IP}

# Acceso a instancia privada del ASG via ProxyJump
PRIVATE_IP=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names ecom-asg-prod \
  --query 'AutoScalingGroups[0].Instances[0].InstanceId' --output text)

ssh -i ~/.ssh/ecom-keypair.pem \
    -o ProxyJump=ec2-user@${BASTION_IP} \
    ec2-user@${PRIVATE_IP}
```

### Opción B. Systems Manager Session Manager (sin SSH)

El IAM instance profile asignado a todas las instancias EC2 (`SsmRoleInstanceProfile`) incluye los permisos necesarios para SSM. No requiere abrir el puerto 22, no depende del Bastion y funciona directamente desde la AWS CLI.

**Listar todas las instancias gestionadas por SSM:**
```bash
aws ssm describe-instance-information \
  --query 'InstanceInformationList[*].{ID:InstanceId,Estado:PingStatus,IP:IPAddress}' \
  --output table
```

**Abrir sesión interactiva en una instancia del ASG:**
```bash
INSTANCE_ID=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names ecom-asg-prod \
  --query 'AutoScalingGroups[0].Instances[0].InstanceId' \
  --output text)

aws ssm start-session --target ${INSTANCE_ID}
```

**Abrir sesión en el Bastion Host:**
```bash
BASTION_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=ecom-bastion-prod" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

aws ssm start-session --target ${BASTION_ID}
```

**Comandos útiles dentro de la sesión SSM:**
```bash
# Ver logs del servicio Spring Boot en tiempo real
sudo journalctl -u ecom-app -f

# Ver variables de entorno de la aplicación
sudo cat /etc/ecom-app.env

# Estado del servicio
sudo systemctl status ecom-app

# Verificar conectividad con RDS
sudo -u ecom bash -c 'source /etc/ecom-app.env && \
  nc -zv $(echo $SPRING_DATASOURCE_URL | grep -oP "(?<=//)[^:]+") 5432'
```

> SSM Session Manager es la opcion recomendada por AWS para acceso a instancias en subredes privadas. Al no requerir el puerto 22 abierto ni un bastion intermediario, reduce la superficie de ataque. Toda actividad queda registrada en CloudTrail bajo el evento `StartSession`.

---

## Prueba de Auto Scaling

Para verificar que el ASG escala correctamente bajo carga:

```bash
./infrastructure/scripts/stress-test.sh
```

Para monitorear el scale-in después de que baja la carga (sin generar más estrés):

```bash
./infrastructure/scripts/stress-test.sh --monitor-only
```

El Auto Scaling Group está configurado para:
- **Scale-out:** cuando CPU supera el 50% → agrega 1 instancia (hasta máximo 3)
- **Scale-in:** cuando la CPU baja de los umbrales → tarda **5–15 minutos** en reducir las instancias después de que la carga se normaliza (cooldown de CloudWatch)

El script imprime una tabla en tiempo real con CPU promedio, instancias deseadas e instancias InService, y reporta `PASS` cuando detecta el scale-out.

---

## Verificación pre-presentación

Antes de la presentación, verificar que toda la infraestructura está operativa en ~30 segundos:

```bash
./infrastructure/scripts/demo-check.sh
```

El script comprueba en paralelo: credenciales AWS, estado de los 9 stacks CloudFormation, health check del backend, accesibilidad del frontend, target health del ALB, instancias InService del ASG y objetos en el bucket de media. Imprime ✓ o ✗ por cada componente y termina con `✓ LISTO PARA PRESENTAR` o lista los componentes con fallo.

**Flujo recomendado del showcase:**
1. `demo-check.sh` — confirmar que todo está verde
2. Mostrar el catálogo y navegación por categorías
3. Agregar productos al carrito y completar un checkout simulado
4. Ver el historial de pedidos en la página de perfil
5. Mostrar el panel de administración (`/admin`)
6. Lanzar `stress-test.sh` para demostrar el auto scaling en vivo

---

## Teardown. eliminar toda la infraestructura

Eliminar los stacks en orden inverso para respetar dependencias:

```bash
for stack in ecom-frontend ecom-media ecom-cw ecom-asg ecom-alb ecom-rds ecom-sg ecom-vpc ecom-s3-artifacts; do
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
