# ecommerce-iac-aws

![Java](https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.3-6DB33F?logo=springboot&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-CloudFormation-FF9900?logo=amazonaws&logoColor=white)


Plataforma de e-commerce completa desplegada en AWS mediante Infrastructure as Code (CloudFormation). El proyecto demuestra el ciclo completo de aprovisionamiento de infraestructura en la nube: red, cómputo con auto scaling, base de datos relacional, distribución de contenido con CloudFront, integración de pasarela de pago real (MercadoPago) y monitoreo operacional con CloudWatch. Desarrollado como proyecto final del curso Infraestructura III.

---

## Indice

- [Arquitectura](#arquitectura)
- [Stack tecnologico](#stack-tecnologico)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Configuracion de variables de entorno](#configuracion-de-variables-de-entorno)
- [Inicio rapido . local](#inicio-rapido--local)
- [Deploy en AWS](#deploy-en-aws)
- [Scripts disponibles](#scripts-disponibles)
- [Funcionalidades](#funcionalidades)
- [Documentacion](#documentacion)
- [Creditos](#creditos)

---

## Arquitectura

```
Internet
    │
    ├── CloudFront Frontend  ──►  S3 (React SPA, OAC)
    ├── CloudFront Backend   ──►  ALB :80  ──►  EC2 ASG :8080  ──►  RDS PostgreSQL
    └── CloudFront Media     ──►  S3 (imagenes, OAC)

VPC 10.0.0.0/16
  Subredes publicas:
    10.0.1.0/24  (us-east-1a)  —  Bastion t2.micro + EIP, NAT Gateway + EIP
    10.0.2.0/24  (us-east-1b)  —  nodo ALB

  Subredes privadas:
    10.0.11.0/24 (us-east-1a)  —  EC2 t2.medium (ASG), RDS db.t3.micro
    10.0.12.0/24 (us-east-1b)  —  EC2 t2.medium (ASG)

  ASG: min 1 / max 3 instancias — Target Tracking CPU 50%
```

Para la descripcion tecnica completa con valores exactos, reglas de Security Groups, politicas de CloudFront y flujos de trafico en Mermaid, ver [docs/architecture.md](docs/architecture.md).

---

## Stack tecnologico

| Capa | Tecnologia | Detalle |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS | SPA servida desde S3 via CloudFront |
| Backend | Java 21 + Spring Boot 3.3 + Spring Data JPA | JAR desplegado en EC2 via S3 |
| Base de datos | PostgreSQL 15 | RDS db.t3.micro en subred privada |
| Seguridad | Spring Security + JWT | Roles USER y ADMIN, BCrypt |
| Pasarela de pago | MercadoPago Checkout Bricks | Preferencias + webhooks HTTPS |
| IaC | AWS CloudFormation (YAML) | 10 templates, deploy secuencial con exports |
| Scripting | Bash | Deploy, stress test, seed, verificacion |

---

## Estructura del repositorio

```
ecommerce-iac-aws/
│
├── docs/
│   ├── architecture.md          — Arquitectura AWS detallada (valores reales de CF)
│   ├── deployment-guide.md      — Guia de despliegue paso a paso
│   ├── database-evaluation.md   — Evaluacion tecnica PostgreSQL vs DynamoDB vs Redis
│   ├── project-plan.md          — Cronograma real y alcance del proyecto
│   └── diagramInfra.png         — Diagrama de infraestructura
│
├── infrastructure/
│   ├── cloudformation/
│   │   ├── 00-s3-artifacts.yaml — Bucket S3 versionado para el JAR del backend
│   │   ├── 01-vpc.yaml          — VPC, subredes, IGW, NAT Gateway, route tables
│   │   ├── 02-security-groups   — Security Groups por capa (ALB, EC2, RDS, Bastion)
│   │   ├── 03-rds.yaml          — RDS PostgreSQL 15, Single-AZ
│   │   ├── 04-alb.yaml          — ALB internet-facing, Target Group, Listener :80
│   │   ├── 05-autoscaling.yaml  — Bastion Host, Launch Template, ASG, Target Tracking
│   │   ├── 06-cloudwatch.yaml   — Alarmas, dashboard, SNS email
│   │   ├── 07-frontend.yaml     — S3 frontend + CloudFront SPA + CloudFront Backend proxy
│   │   ├── 08-cloudtrail.yaml   — CloudTrail trail, bucket de logs, retencion 90 dias
│   │   ├── 08-media.yaml        — S3 media + CloudFront + presigned URLs
│   │   └── main.yaml            — Stack raiz con nested stacks (orquestador)
│   │
│   └── scripts/
│       ├── deploy-all.sh        — Despliega los 10 stacks en orden
│       ├── upload-templates.sh  — Sube templates YAML a S3 para nested stacks
│       ├── upload-media.sh      — Sube imagenes de productos al bucket de media
│       ├── stress-test.sh       — Genera carga CPU y monitorea auto scaling
│       ├── demo-check.sh        — Verifica estado de recursos antes de la demo
│       ├── seed-products.sh     — Inserta productos de prueba en la DB via API
│       └── set-aws-session.sh   — Renueva credenciales de AWS Academy
│
├── backend/
│   └── src/main/java/com/ecom/
│       ├── config/              — MercadoPago, Spring Security, CORS
│       ├── controller/          — REST controllers (Auth, Product, Cart, Payment...)
│       ├── dto/                 — Java records para request/response
│       ├── exception/           — GlobalExceptionHandler + excepciones de dominio
│       ├── model/               — Entidades JPA (User, Product, CartItem, Order, OrderItem)
│       ├── repository/          — Interfaces JpaRepository
│       ├── security/            — JWT filter, UserDetailsService
│       ├── service/             — Interfaces de servicio
│       └── service/impl/        — Implementaciones (logica de negocio)
│
└── frontend/
    └── src/
        ├── pages/               — Home, Login, Register, Cart, Checkout,
        │                          Profile, ProductDetail, PaymentSuccess,
        │                          PaymentFailure, admin/AdminDashboard
        ├── components/          — Header, Navbar, RequireAuth, RequireAdmin
        └── context/             — AuthContext, CartContext, UIContext
```

---

## Configuracion de variables de entorno

### Frontend

```bash
cp frontend/.env.example frontend/.env
# Editar frontend/.env con los valores reales
```

| Variable | Local | AWS |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | URL de CloudFront Backend |
| `VITE_MP_PUBLIC_KEY` | Public key del vendedor de prueba MP | Igual |
| `VITE_MEDIA_BUCKET_URL` | _(vacio)_ | URL de CloudFront Media |

### Backend

```bash
cp backend/src/main/resources/application-local.properties.template \
   backend/src/main/resources/application-local.properties
# Editar application-local.properties con los valores reales
```

| Variable | Descripcion |
|---|---|
| `jwt.secret` | Minimo 32 caracteres, cualquier string aleatorio |
| `mercadopago.access-token` | Access token del vendedor de prueba (prefijo `APP_USR-`) |
| `app.backend-url` | `http://localhost:8080` en local; URL ngrok para probar webhooks |
| `app.frontend-url` | `http://localhost:5173` en local |
| `s3.media-bucket` | Dejar vacio en local para desactivar imagenes desde S3 |

> `application-local.properties` esta en `.gitignore`. El archivo `.template` es la referencia versionada de la estructura requerida.

En AWS, todas estas variables las inyecta CloudFormation como parametros del stack `ecom-asg` directamente en `/etc/ecom-app.env` de cada instancia EC2. No se configuran manualmente.

---

## Inicio rapido . local

**Requisitos:** Java 21, Maven 3.9+, Node.js 20+

```bash
# Backend con H2 en memoria (sin necesidad de PostgreSQL local)
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
# API disponible en http://localhost:8080
# Consola H2 en http://localhost:8080/h2-console (URL: jdbc:h2:mem:ecomdb, user: sa)

# Frontend (en otra terminal)
cd frontend
echo "VITE_API_URL=http://localhost:8080" > .env
npm install && npm run dev
# App disponible en http://localhost:5173
```

Para pagos con MercadoPago en local, exponer el backend con ngrok y configurar `app.backend-url` en `application-local.properties`.

---

## Deploy en AWS

Para el detalle completo de cada paso, credenciales, parametros y troubleshooting, ver [docs/deployment-guide.md](docs/deployment-guide.md).

**Paso 1 . Renovar credenciales de AWS Academy**
```bash
source infrastructure/scripts/set-aws-session.sh
```

**Paso 2 . Compilar y subir el JAR del backend**
```bash
cd backend && ./mvnw clean package -DskipTests
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws s3 cp target/ecom-backend-*.jar \
    s3://ecom-artifacts-prod-${ACCOUNT_ID}/backend/ecom-app.jar
```

**Paso 3 . Subir los templates de CloudFormation a S3**
```bash
./infrastructure/scripts/upload-templates.sh
```

**Paso 4 . Desplegar los stacks de infraestructura**
```bash
./infrastructure/scripts/deploy-all.sh
# Solicita: DB password, alert email, MercadoPago token, JWT secret
# Tiempo estimado: 20-25 min (RDS tarda ~10 min)
```

**Paso 5 . Subir el build del frontend a S3**
```bash
cd frontend
VITE_API_URL=https://<backend-cloudfront-url> npm run build
aws s3 sync dist/ s3://ecom-frontend-prod-${ACCOUNT_ID}/ --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

**Paso 6 . Verificar el despliegue**
```bash
./infrastructure/scripts/demo-check.sh
```

---

## Scripts disponibles

| Script | Uso | Descripcion |
|---|---|---|
| `deploy-all.sh` | `./infrastructure/scripts/deploy-all.sh` | Despliega los 10 stacks CloudFormation en orden secuencial con espera entre cada uno |
| `upload-templates.sh` | `./infrastructure/scripts/upload-templates.sh` | Sube los templates YAML a S3; necesario para nested stacks y el orquestador `main.yaml` |
| `upload-media.sh` | `./infrastructure/scripts/upload-media.sh` | Sube imagenes de productos al bucket S3 de media e invalida la distribucion CloudFront |
| `stress-test.sh` | `./infrastructure/scripts/stress-test.sh` | Genera carga CPU en instancias EC2 via SSH con ProxyJump; monitorea el ASG en tiempo real |
| `demo-check.sh` | `./infrastructure/scripts/demo-check.sh` | Verifica el estado de todos los recursos AWS (stacks, instancias, RDS, ALB) antes de la presentacion |
| `seed-products.sh` | `./infrastructure/scripts/seed-products.sh` | Inserta el catalogo de productos de prueba en la base de datos via la API REST |
| `set-aws-session.sh` | `source infrastructure/scripts/set-aws-session.sh` | Renueva las credenciales temporales de AWS Academy (expiran cada 2 horas) |

---

## Funcionalidades

- Catalogo de productos con busqueda por categoria, vista en grilla y detalle de producto
- Carrito de compras persistente por usuario con calculo de totales
- Checkout con MercadoPago Checkout Bricks: pago real en sandbox con webhook HTTPS
- Historial de pedidos en pagina de perfil con snapshot inmutable de items y precios al momento de la compra
- Panel de administracion con rol ADMIN para gestion del catalogo de productos
- Registro y autenticacion de usuarios con JWT, BCrypt y roles diferenciados
- Imagenes de productos almacenadas en S3 con presigned PUT URLs y servidas via CloudFront
- Auto scaling verificado: escala de 1 a 2 instancias EC2 bajo carga de CPU real (stress test incluido)
- Monitoreo operacional con 4 alarmas CloudWatch y notificaciones email via SNS
- Auditoria completa de la cuenta AWS con CloudTrail

---

## Documentacion

| Documento | Descripcion |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Arquitectura AWS detallada: CIDRs, Security Groups, CloudFront, S3, flujos de trafico en Mermaid |
| [docs/deployment-guide.md](docs/deployment-guide.md) | Guia de despliegue completa: prerrequisitos, parametros, comandos y troubleshooting |
| [docs/database-evaluation.md](docs/database-evaluation.md) | Evaluacion tecnica de PostgreSQL vs DynamoDB vs Redis para el dominio del proyecto |
| [docs/project-plan.md](docs/project-plan.md) | Cronograma real por semanas, alcance, recursos AWS y riesgos |

---

## Creditos

**Curso:** Infraestructura III  
**Docente:** Ing. Mario German Castillo Ramirez  
**Equipo:** Juan C. Melo, Esteban G.V.  
**Institucion:** Ingenieria de Sistemas . 2026
