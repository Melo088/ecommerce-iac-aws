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

## Arquitectura del Backend

El backend sigue una **arquitectura en capas** estricta donde cada capa solo conoce a la inmediatamente inferior. Las entidades JPA nunca salen de la capa de servicio — la capa web solo maneja DTOs.

```
HTTP request
     │
     ▼
┌─────────────┐   recibe DTOs (@Valid)   devuelve DTOs
│ Controller  │ ──────────────────────────────────────►  HTTP response
└──────┬──────┘
       │ llama a interface
       ▼
┌─────────────┐   lógica de negocio, mapeo entidad ↔ DTO
│   Service   │
└──────┬──────┘
       │ llama a interface
       ▼
┌─────────────┐   consultas JPA / SQL
│ Repository  │
└──────┬──────┘
       │
       ▼
┌─────────────┐   tablas PostgreSQL (o H2 en local)
│    Model    │
└─────────────┘
```

### Controller (`com.ecom.controller`)

Capa web. Recibe requests HTTP, valida el body con `@Valid` y delega al service. No contiene lógica de negocio ni accede a repositories directamente.

| Clase | Responsabilidad |
|---|---|
| `HealthController` | Expone `GET /api/v1/health` para el health check del ALB |
| `ProductController` | CRUD completo de productos |
| `CartController` | Gestión del carrito de compras por usuario |
| `UserController` | Registro y consulta de usuarios |
| `CheckoutController` | Proceso de pago (simulado) |

### DTO (`com.ecom.dto`)

Objetos de transferencia de datos. Implementados como **Java records** — inmutables y sin boilerplate. Los `*Request` llevan anotaciones de validación (`@NotNull`, `@NotBlank`, `@Min`, `@Email`, etc.); los `*Response` exponen solo los campos seguros (p. ej. `UserResponse` omite `passwordHash`).

| Clase | Uso |
|---|---|
| `ProductRequest` | Body de POST/PUT para productos |
| `ProductResponse` | Respuesta de todos los endpoints de productos |
| `CartItemRequest` | Body de POST para añadir ítem al carrito |
| `CartItemResponse` | Respuesta con datos del ítem y del producto anidado |
| `UserRequest` | Body de registro (`email`, `password`, `name`) |
| `UserResponse` | Respuesta sin `passwordHash` |
| `CheckoutRequest` | Body de POST checkout (`userId`) |
| `CheckoutResponse` | `orderId` (UUID), `total`, lista de ítems, mensaje |

### Service (`com.ecom.service` + `service/impl`)

Lógica de negocio. Cada dominio define una **interface** y una **implementación** (`*ServiceImpl`) anotada con `@Service`. Es la única capa que accede a los repositories y que conoce las entidades JPA.

| Interface | Implementación | Responsabilidad |
|---|---|---|
| `ProductService` | `ProductServiceImpl` | CRUD de productos, mapeo `Product ↔ ProductResponse` |
| `CartService` | `CartServiceImpl` | Gestión del carrito; resuelve usuario y producto antes de persistir |
| `UserService` | `UserServiceImpl` | Registro de usuarios (almacena `passwordHash`) y consulta por ID |
| `CheckoutService` | `CheckoutServiceImpl` | Calcula el total, limpia el carrito (`@Transactional`) y genera un `orderId` |

### Repository (`com.ecom.repository`)

Acceso a datos. Interfaces que extienden `JpaRepository` — Spring Data JPA genera la implementación en tiempo de ejecución. No se modificaron durante el refactor.

| Clase | Tabla | Métodos destacados |
|---|---|---|
| `ProductRepository` | `products` | `findByStockGreaterThan(int)` |
| `CartItemRepository` | `cart_items` | `findByUserId(Long)`, `deleteByUserId(Long)` |
| `UserRepository` | `users` | `findByEmail(String)` |

### Model (`com.ecom.model`)

Entidades JPA mapeadas a tablas PostgreSQL. Anotadas con `@Entity`. No se modificaron durante el refactor.

| Clase | Tabla | Relaciones |
|---|---|---|
| `Product` | `products` | — |
| `User` | `users` | — |
| `CartItem` | `cart_items` | `@ManyToOne` a `User` y `Product` |

### Exception (`com.ecom.exception`)

Manejo centralizado de errores.

| Clase | Descripción |
|---|---|
| `ResourceNotFoundException` | `RuntimeException` → HTTP 404 cuando no se encuentra un recurso |
| `GlobalExceptionHandler` | `@RestControllerAdvice` que captura: `ResourceNotFoundException` (404), `MethodArgumentNotValidException` (400 con mapa de campos), `IllegalStateException` (400) |

---

## Endpoints de la API

Base path: `/api/v1` · Puerto: `8080`

### Health

| Método | Path | Descripción |
|---|---|---|
| `GET` | `/api/v1/health` | Health check del ALB — devuelve `{"status":"UP"}` |

### Productos

| Método | Path | Descripción |
|---|---|---|
| `GET` | `/api/v1/products` | Lista todos los productos |
| `GET` | `/api/v1/products/{id}` | Obtiene un producto por ID (404 si no existe) |
| `POST` | `/api/v1/products` | Crea un producto; body: `ProductRequest` validado |
| `PUT` | `/api/v1/products/{id}` | Actualiza un producto existente; body: `ProductRequest` validado |
| `DELETE` | `/api/v1/products/{id}` | Elimina un producto (204 si ok, 404 si no existe) |

### Carrito

| Método | Path | Descripción |
|---|---|---|
| `GET` | `/api/v1/cart/{userId}` | Devuelve los ítems del carrito del usuario (404 si el usuario no existe) |
| `POST` | `/api/v1/cart` | Añade un ítem al carrito; body: `CartItemRequest` con `userId`, `productId`, `quantity` |
| `DELETE` | `/api/v1/cart/{id}` | Elimina un ítem del carrito por su ID (204 si ok, 404 si no existe) |

### Usuarios

| Método | Path | Descripción |
|---|---|---|
| `POST` | `/api/v1/users/register` | Registra un nuevo usuario; body: `UserRequest` con `email`, `password`, `name` |
| `GET` | `/api/v1/users/{id}` | Obtiene los datos públicos de un usuario (sin `passwordHash`) |

### Checkout

| Método | Path | Descripción |
|---|---|---|
| `POST` | `/api/v1/checkout` | Procesa el pago simulado: calcula el total, vacía el carrito y devuelve `orderId`, `total` e ítems |

---

## Desarrollo local — Backend

**Requisitos:** Java 21, Maven 3.9+

```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Arranca con perfil `local`, que sustituye PostgreSQL por **H2 en memoria** (`ddl-auto=create-drop`).
Al iniciar, Spring Boot ejecuta `src/main/resources/data.sql` automáticamente e inserta 6 productos de prueba (ropa y tecnología).

Consola H2 disponible en `http://localhost:8080/h2-console`:

| Campo | Valor |
|---|---|
| JDBC URL | `jdbc:h2:mem:ecomdb` |
| Usuario | `sa` |
| Password | _(vacío)_ |

### Endpoints disponibles

#### Health

| Método | Path | JWT |
|---|---|---|
| `GET` | `/api/v1/health` | No |

#### Autenticación

| Método | Path | JWT |
|---|---|---|
| `POST` | `/api/v1/auth/login` | No |

#### Usuarios

| Método | Path | JWT |
|---|---|---|
| `POST` | `/api/v1/users/register` | No |
| `GET` | `/api/v1/users/{id}` | Sí |

#### Productos

| Método | Path | JWT |
|---|---|---|
| `GET` | `/api/v1/products` | No |
| `GET` | `/api/v1/products/{id}` | No |
| `POST` | `/api/v1/products` | Sí |
| `PUT` | `/api/v1/products/{id}` | Sí |
| `DELETE` | `/api/v1/products/{id}` | Sí |

#### Carrito

| Método | Path | JWT |
|---|---|---|
| `GET` | `/api/v1/cart` | Sí |
| `POST` | `/api/v1/cart` | Sí |
| `DELETE` | `/api/v1/cart/{productId}` | Sí |

#### Checkout

| Método | Path | JWT |
|---|---|---|
| `POST` | `/api/v1/checkout` | Sí |

---

## Desarrollo local — Frontend

**Requisitos:** Node.js 20+

```bash
cd frontend

# 1. Crear el archivo de entorno
echo "VITE_API_URL=http://localhost:8080" > .env

# 2. Instalar dependencias y arrancar
npm install && npm run dev
```

El servidor de desarrollo queda en `http://localhost:5173`.

### Rutas disponibles

| Ruta | Descripción | Requiere sesión |
|---|---|---|
| `/` | Catálogo de productos (grid de cards) | No |
| `/login` | Formulario de inicio de sesión | No |
| `/register` | Formulario de registro de usuario | No |
| `/cart` | Carrito de compras con totales y botón Pagar | Sí (redirige a `/login`) |
| `/checkout` | Confirmación del pago con `orderId` y total | Sí |

> Si el backend no está corriendo, el catálogo muestra un mensaje de error y las acciones autenticadas fallan con alerta.

---

## Despliegue del backend en AWS

### 1. Compilar el JAR

```bash
cd backend
./mvnw clean package -DskipTests
# Genera: target/ecom-backend-*.jar
```

### 2. Subir el JAR a S3

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET="ecom-artifacts-prod-${ACCOUNT_ID}"
JAR=$(ls backend/target/ecom-backend-*.jar)

aws s3 cp "$JAR" "s3://${BUCKET}/app/ecom-backend.jar"
```

### 3. Rolling update del ASG (terminate & replace)

Las instancias del ASG descargan el JAR de S3 al arrancar via `user-data.sh`.
Para forzar el reemplazo de la instancia activa sin modificar el ASG:

```bash
# Obtener el ID de la instancia activa
INSTANCE_ID=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names ecom-asg-prod \
  --query 'AutoScalingGroups[0].Instances[0].InstanceId' \
  --output text)

# Terminar la instancia — el ASG lanza una nueva automáticamente
aws autoscaling terminate-instance-in-auto-scaling-group \
  --instance-id "$INSTANCE_ID" \
  --no-should-decrement-desired-capacity
```

La nueva instancia arranca, descarga `ecom-backend.jar` de S3 y queda registrada en el Target Group del ALB en ~2 minutos.

> Para múltiples instancias, repite el terminate una a una y espera a que el Target Group marque cada nueva instancia como `healthy` antes de continuar.

### Variables de entorno

Las variables de entorno de la aplicación (`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `JWT_SECRET`) **no se configuran manualmente** en la instancia. CloudFormation las inyecta en el script `user-data.sh` del Launch Template a partir de los parámetros del stack, y el script las escribe en `/etc/ecom/env` antes de arrancar el servicio.

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
