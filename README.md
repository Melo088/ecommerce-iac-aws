# ecommerce-iac-aws

Plataforma de e-commerce escalable desplegada en AWS con Infrastructure as Code.
**Proyecto Final — Infraestructura III · Ing. Mario German Castillo Ramirez**

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Java 21 + Spring Boot 3 + Spring Data JPA |
| Base de datos | PostgreSQL 15 en AWS RDS (db.t3.micro) |
| IaC | AWS CloudFormation (YAML) |
| Scripting | Bash |

---

## Arquitectura desplegada

```
Internet
    │
    ▼
[Application Load Balancer]  ← subred pública (2 AZs)
    │
    ▼
[Auto Scaling Group]         ← subred privada (min 1 / max 3 × t2.medium)
    │                            Spring Boot :8080
    ├──────────────────────────► [RDS PostgreSQL]  ← subred privada
    │
    └── [Bastion Host t2.micro + EIP]  ← subred pública (acceso SSH/psql)

[S3 Bucket]  ← artefactos del backend (JAR)
[CloudWatch] ← métricas, alarmas y dashboard
[SNS]        ← notificaciones de alarmas
```

**VPC** `10.0.0.0/16` con:
- Subredes **públicas**: `10.0.1.0/24` y `10.0.2.0/24` — ALB, Bastion, NAT Gateway
- Subredes **privadas**: `10.0.11.0/24` y `10.0.12.0/24` — EC2 (ASG), RDS

---

## Stacks CloudFormation

Los stacks se despliegan en orden numérico; cada uno exporta outputs que los siguientes importan.

| Archivo | Stack name | Descripción |
|---|---|---|
| `00-s3-artifacts.yaml` | `ecom-s3-artifacts` | Bucket S3 versionado para el JAR del backend |
| `01-vpc.yaml` | `ecom-vpc` | VPC, subredes públicas/privadas, IGW, NAT Gateway y route tables |
| `02-security-groups.yaml` | `ecom-sg` | Security Groups para ALB, EC2, RDS y Bastion |
| `03-rds.yaml` | `ecom-rds` | Instancia PostgreSQL 15 Single-AZ en subredes privadas |
| `04-alb.yaml` | `ecom-alb` | Application Load Balancer, Target Group y Listener HTTP:80 |
| `05-autoscaling.yaml` | `ecom-asg` | Bastion Host, Launch Template y Auto Scaling Group con Target Tracking CPU 50 % |
| `06-cloudwatch.yaml` | `ecom-cw` | Alarmas CloudWatch, dashboard y topic SNS |

---

## Prerrequisitos

- AWS CLI v2
- Java 21 + Maven
- Node.js 20+
- `cfn-lint` — `pip install cfn-lint`
- Par de claves EC2 creado en la región `us-east-1` (nombre: `ecom-keypair`)

---

## Gestión de sesión AWS Academy

Las credenciales del sandbox **expiran cada 2 horas**. Para renovarlas:

```bash
source infrastructure/scripts/set-aws-session.sh
```

El script pide `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y `AWS_SESSION_TOKEN`
(cópialos desde el panel **AWS Details** de AWS Academy) y los exporta en la sesión
actual. Al final verifica la identidad con `aws sts get-caller-identity`.

> Usa siempre `source` (no `bash`) para que las variables queden en el shell actual.
> Si un deploy falla con `ExpiredTokenException`, renueva las credenciales y reintenta.

---

## Por qué upload-templates.sh

CloudFormation requiere que los templates de nested stacks estén en S3 —
no puede leer archivos locales cuando despliegas un stack raíz con stacks anidados.
`upload-templates.sh` resuelve esto en dos pasos:

1. **Bootstrap del bucket**: comprueba si `ecom-artifacts-{env}-{account}` existe.
   Si no, despliega `00-s3-artifacts.yaml` de forma standalone para crearlo.
2. **Subida de templates**: copia todos los `.yaml` de `infrastructure/cloudformation/`
   al prefijo `cloudformation/` del bucket e imprime la URL S3 de cada uno.

Esto separa el bucket de artefactos (prerrequisito) del stack raíz `main.yaml`
(que orquesta los stacks 01–06), evitando la dependencia circular: el bucket
debe existir antes de poder subir los templates que lo referencian.

---

## Despliegue

### Forma A — Stack raíz (recomendada)

Despliega toda la infraestructura como un único stack raíz con nested stacks.
CloudFormation gestiona el orden y las dependencias automáticamente.

```bash
# 1. Subir templates a S3 (crea el bucket si no existe)
./infrastructure/scripts/upload-templates.sh

# 2. Obtener datos de la cuenta
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
IAM_PROFILE=$(aws iam list-instance-profiles \
  --query 'InstanceProfiles[0].InstanceProfileName' --output text)

# 3. Desplegar el stack raíz
aws cloudformation create-stack \
  --stack-name ecom-main-prod \
  --template-url "https://s3.amazonaws.com/ecom-artifacts-prod-${ACCOUNT_ID}/cloudformation/main.yaml" \
  --parameters \
      ParameterKey=DBPassword,ParameterValue=<tu-password> \
      ParameterKey=AlertEmail,ParameterValue=<tu-email> \
      ParameterKey=IamInstanceProfile,ParameterValue=${IAM_PROFILE} \
  --region us-east-1

# 4. Esperar a que complete (~15-20 min)
aws cloudformation wait stack-create-complete \
  --stack-name ecom-main-prod --region us-east-1
```

Una vez desplegado, obtén los endpoints:

```bash
aws cloudformation describe-stacks --stack-name ecom-main-prod \
  --query 'Stacks[0].Outputs' --output table
```

### Forma B — Stacks individuales (legacy)

```bash
./infrastructure/scripts/deploy-all.sh
```

Despliega los 7 stacks en orden secuencial. El script pide `AlertEmail` y
`DBPassword` al inicio, verifica/crea el key pair `ecom-keypair` automáticamente
y espera a que cada stack complete antes de continuar.

> Esta forma existe por razones históricas (permite redesplegar stacks
> individuales sin tocar el resto). Para despliegues completos usar **Forma A**.

---

## Conexión a las instancias

### Bastion Host (SSH directo)

```bash
# Obtener la IP pública del Bastion
BASTION_IP=$(aws cloudformation describe-stacks \
  --stack-name ecom-asg \
  --query 'Stacks[0].Outputs[?OutputKey==`BastionPublicIp`].OutputValue' \
  --output text)

ssh -i ~/.ssh/ecom-keypair.pem ec2-user@$BASTION_IP
```

### Instancias privadas (EC2 del ASG, a través del Bastion)

```bash
# Desde el Bastion, conectarse a una instancia privada
ssh -i ~/.ssh/ecom-keypair.pem ec2-user@<IP-PRIVADA>
```

O usando SSH ProxyJump directamente desde tu máquina:

```bash
ssh -i ~/.ssh/ecom-keypair.pem \
    -o ProxyJump=ec2-user@$BASTION_IP \
    ec2-user@<IP-PRIVADA>
```

### Conexión a RDS (desde el Bastion)

```bash
# Obtener el endpoint de RDS
DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name ecom-rds \
  --query 'Stacks[0].Outputs[?OutputKey==`DBEndpoint`].OutputValue' \
  --output text)

psql -h $DB_ENDPOINT -U ecomadmin -d ecomdb
```

---

## Validar templates antes de desplegar

```bash
cfn-lint infrastructure/cloudformation/*.yaml
```
