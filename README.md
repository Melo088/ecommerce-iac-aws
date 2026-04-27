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

## Credenciales del sandbox (AWS Academy)

Las credenciales del sandbox expiran cada ~4 horas. Para renovarlas ejecuta:

```bash
source infrastructure/scripts/set-aws-session.sh
```

El script pide `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y `AWS_SESSION_TOKEN`
(cópialos desde el panel **AWS Details** de AWS Academy) y los exporta en la sesión
actual. Al final verifica la identidad con `aws sts get-caller-identity`.

> El script debe ejecutarse con `source` (no `bash`) para que las variables queden
> disponibles en el shell actual.

---

## Redespliegue completo

```bash
./infrastructure/scripts/deploy-all.sh
```

El script despliega los 6 stacks en orden, esperando a que cada uno complete antes
de continuar. Antes de correrlo asegúrate de:

1. Tener credenciales válidas (`source infrastructure/scripts/set-aws-session.sh`).
2. Haber subido el JAR al bucket S3:
   ```bash
   ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   aws s3 cp target/ecom-app.jar s3://ecom-artifacts-prod-$ACCOUNT_ID/backend/ecom-app.jar
   ```
3. Que el par de claves `ecom-keypair` exista en `us-east-1`.

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
