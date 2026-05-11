# Arquitectura AWS — Plataforma de E-Commerce

## Diagrama de arquitectura

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AWS CloudFront (HTTPS)                      │
│   ┌─────────────────────────┐  ┌──────────────────────────────┐ │
│   │  CF Frontend            │  │  CF Backend                  │ │
│   │  (*.cloudfront.net)     │  │  (*.cloudfront.net)          │ │
│   │  → S3 bucket (OAC)      │  │  → ALB:80 (HTTP al origin)   │ │
│   └─────────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  VPC  10.0.0.0/16  (us-east-1)                  │
│                                                                 │
│  ┌──────────────────── Subredes Públicas ─────────────────────┐ │
│  │  us-east-1a  10.0.1.0/24    us-east-1b  10.0.2.0/24       │ │
│  │                                                             │ │
│  │  ┌────────────┐   ┌──────────────────────────────────────┐ │ │
│  │  │   Bastion  │   │   Application Load Balancer          │ │ │
│  │  │  t2.micro  │   │   (internet-facing, puerto 80)       │ │ │
│  │  │   + EIP    │   │   Health check: /api/v1/health       │ │ │
│  │  └────────────┘   └──────────────────────────────────────┘ │ │
│  │                              │                              │ │
│  │  ┌──────────┐                │                             │ │
│  │  │ NAT GW   │                │                             │ │
│  │  │ + EIP    │                │                             │ │
│  │  └──────────┘                │                             │ │
│  └──────────────────────────────│─────────────────────────────┘ │
│                                 │                               │
│  ┌──────────────────── Subredes Privadas ─────────────────────┐ │
│  │  us-east-1a  10.0.11.0/24   us-east-1b  10.0.12.0/24      │ │
│  │                                                             │ │
│  │  ┌────────────────────────────────────────────────────┐    │ │
│  │  │           Auto Scaling Group (1–3 instancias)      │    │ │
│  │  │                                                     │    │ │
│  │  │  ┌───────────────┐     ┌───────────────┐           │    │ │
│  │  │  │ EC2 t2.medium │ ... │ EC2 t2.medium │           │    │ │
│  │  │  │ Spring Boot   │     │ Spring Boot   │           │    │ │
│  │  │  │ puerto 8080   │     │ puerto 8080   │           │    │ │
│  │  │  └───────────────┘     └───────────────┘           │    │ │
│  │  └────────────────────────────────────────────────────┘    │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  RDS PostgreSQL 15  (db.t3.micro, Single-AZ)         │  │ │
│  │  │  puerto 5432 — accesible solo desde EC2 y Bastion    │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

Servicios externos:
  S3  ──── artifacts (JAR backend)
       └── frontend  (build React, acceso vía CloudFront OAC)
  CloudWatch ── alarmas CPU / HTTP 5xx / hosts no saludables
  SNS        ── notificaciones email
  MercadoPago ─ webhooks HTTPS via CloudFront backend
```

---

## Capas de la arquitectura

### Capa de distribución — CloudFront
Dos distribuciones independientes que resuelven la ausencia de HTTPS en el ALB:

- **Frontend:** Origin = bucket S3 privado (OAC SigV4). Custom error responses redirigen cualquier 403/404 a `index.html`, habilitando el client-side routing de React Router.
- **Backend:** Origin = ALB DNS en HTTP:80. CloudFront termina TLS hacia el browser y habla HTTP al ALB. Cache policy `CachingDisabled` garantiza que cada llamada a la API llega al backend. Origin request policy `AllViewerExceptHostHeader` reenvía todos los headers/cookies/query strings.

### Capa de red — VPC
- **CIDR:** `10.0.0.0/16`
- **Subredes públicas** (1a, 1b): ALB, Bastion Host, NAT Gateway.
- **Subredes privadas** (1a, 1b): Instancias EC2 del ASG, RDS.
- **NAT Gateway** en subred pública permite que las instancias privadas accedan a internet (actualizaciones, S3, MercadoPago API) sin exponerse directamente.
- Las instancias EC2 no tienen IP pública; todo el tráfico de entrada llega por el ALB.

### Capa de seguridad — Security Groups
Modelo de mínimo privilegio entre capas:

| SG | Ingress permitido | Desde |
|---|---|---|
| ALB SG | TCP 80, 443 | `0.0.0.0/0` |
| EC2 SG | TCP 8080 | ALB SG |
| EC2 SG | TCP 22 | Bastion SG |
| Bastion SG | TCP 22 | `0.0.0.0/0` |
| RDS SG | TCP 5432 | EC2 SG + Bastion SG |

IMDSv2 obligatorio en el Launch Template (`HttpTokens: required`) para prevenir ataques SSRF al servicio de metadata.

### Capa de cómputo — ASG + Launch Template
- **Instancia:** t2.medium (4 GB RAM — necesario para JVM de Spring Boot).
- **AMI:** Amazon Linux 2023, resuelta dinámicamente desde SSM Parameter Store en cada deploy.
- **Bootstrap:** El user-data instala Java 21 (Corretto), descarga el JAR desde S3 usando el IAM instance profile (sin credenciales hardcodeadas), crea un usuario `ecom` sin shell, configura `/etc/ecom-app.env` (permisos 600) y registra un servicio systemd con restart automático.
- **Escalado:** Target Tracking CPU al 50% — el ASG escala de 1 a 3 instancias automáticamente.
- **Health check:** El ALB verifica `/api/v1/health` cada 30 segundos; instancias no saludables son reemplazadas por el ASG.

### Capa de base de datos — RDS PostgreSQL
- PostgreSQL 15, `db.t3.micro`, Single-AZ (Multi-AZ no disponible en sandbox).
- Almacenamiento: 20 GB gp2 con auto-scaling hasta 100 GB.
- Backup automático: 7 días de retención, ventana 03:00–04:00 UTC.
- `DeletionPolicy: Snapshot` — se crea un snapshot antes de eliminar el stack.
- Schema gestionado por Hibernate (`ddl-auto=update`).

### Capa de observabilidad — CloudWatch + SNS
- **4 alarmas:** CPU alta (≥70%), CPU baja (<20%), HTTP 5xx (>10 en 5 min), hosts no saludables (>0).
- **Dashboard:** CPU ASG, requests ALB, HTTP 5xx, healthy hosts — ventana de 24 horas.
- **SNS topic** `ecom-alerts-prod` con subscripción email; las 4 alarmas publican en él.

---

## Decisiones de diseño

### ¿Por qué CloudFront en lugar de HTTPS nativo en el ALB?
El sandbox de AWS Academy no permite registrar dominios en Route53, y ACM requiere validación de dominio para emitir certificados. CloudFront proporciona HTTPS automático con el dominio `*.cloudfront.net` sin necesidad de dominio propio. Esto también habilita webhooks HTTPS requeridos por MercadoPago.

### ¿Por qué S3 + CloudFront para el frontend y no EC2?
React compila a archivos estáticos — no hay lógica de servidor que justifique una instancia. S3 + CloudFront escala a nivel global de forma automática, reduce costos, y desacopla el ciclo de deploy del frontend del backend.

### ¿Por qué JAR en S3 en lugar de imagen Docker?
Simplicidad y compatibilidad con el sandbox (no hay ECR ni ECS disponibles sin crear roles nuevos). El patrón S3 → EC2 user-data es reproducible, auditable, y permite rollback cambiando el objeto en S3 y lanzando un instance refresh.

### ¿Por qué Single-AZ en RDS?
Multi-AZ no está soportado en el sandbox de AWS Academy (instancias `db.t3`). En producción real se habilitaría `MultiAZ: true`.
