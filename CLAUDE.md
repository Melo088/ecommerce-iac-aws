# ecommerce-iac-aws — Proyecto Final Infraestructura III

## Contexto
Plataforma de e-commerce desplegada en AWS usando Infrastructure as Code (CloudFormation).
Curso: Infraestructura III — Ing. Mario German Castillo Ramirez.

## Stack tecnológico
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Java 21 + Spring Boot 3 + Spring Data JPA
- **Base de datos:** PostgreSQL 15 en AWS RDS (db.t3.micro, Single-AZ)
- **IaC:** AWS CloudFormation (YAML)
- **CI/CD local:** Scripts Bash para deploy automatizado

## Arquitectura AWS
- VPC con subredes públicas (ALB, Bastion, NAT GW) y privadas (EC2, RDS)
- Application Load Balancer distribuyendo tráfico a instancias EC2
- Auto Scaling Group (mín 1, máx 3 instancias t2.medium) — límite sandbox: 9 total
- RDS PostgreSQL Single-AZ (Multi-AZ NO soportado en sandbox)
- S3 para imágenes de productos
- CloudWatch + SNS para monitoreo y alertas
- Systems Manager Session Manager para acceso seguro a EC2
- IAM: solo lectura en sandbox — no crear roles/policies nuevas

## Estructura del repositorio

# ecommerce-iac-aws — Proyecto Final Infraestructura III

ecommerce-iac-aws/
├── CLAUDE.md                        ← este archivo
├── README.md
├── docs/
│   ├── architecture.md
│   ├── project-plan.md
│   └── deployment-guide.md
├── infrastructure/
│   ├── cloudformation/
│   │   ├── 01-vpc.yaml              ← VPC, subredes, IGW, NAT GW
│   │   ├── 02-security-groups.yaml  ← SGs para ALB, EC2, RDS, Bastion
│   │   ├── 03-rds.yaml              ← instancia PostgreSQL
│   │   ├── 04-alb.yaml             ← Application Load Balancer
│   │   ├── 05-autoscaling.yaml     ← Launch Template + ASG
│   │   ├── 06-cloudwatch.yaml      ← alarmas, dashboards, SNS
│   │   └── main.yaml               ← stack raíz con nested stacks
│   └── scripts/
│       ├── user-data.sh             ← bootstrap de instancias EC2
│       ├── deploy-stack.sh          ← despliegue ordenado de stacks
│       └── validate-templates.sh    ← cfn-lint antes de deploy
├── frontend/                        ← React app (Vite)
└── backend/                         ← Spring Boot app

## Convenciones de código
- CloudFormation: YAML, parámetros con tipo explícito, Outputs en cada stack
- Naming: `ecom-{recurso}-{env}` (ej: `ecom-alb-prod`, `ecom-rds-prod`)
- Tags obligatorios en todos los recursos: Project, Environment, Owner
- Spring Boot: Java 21, Maven, controladores REST bajo `/api/v1/`
- React: componentes funcionales con hooks, Axios para llamadas API

## Limitaciones del sandbox
- Máximo 9 instancias EC2 totales
- RDS: solo instancias db.t3 (micro a medium), sin Multi-AZ
- IAM: acceso read-only (no crear roles nuevos)
- Route53: no se puede registrar dominio
- EC2 recomendado: t2.medium para app (Spring Boot necesita más RAM que Node)

## Comandos frecuentes
```bash
# Validar templates
aws cloudformation validate-template --template-body file://infrastructure/cloudformation/01-vpc.yaml

# Deploy stack principal
./infrastructure/scripts/deploy-stack.sh prod

# Ver logs de instancia
aws logs get-log-events --log-group-name /ecom/app --log-stream-name {instance-id}
```

## Funcionalidades de la app
1. Catálogo de productos (GET /api/v1/products)
2. Carrito de compras (POST/DELETE /api/v1/cart)
3. Proceso de pago simulado (POST /api/v1/checkout)
4. Registro y autenticación de usuarios (JWT)
