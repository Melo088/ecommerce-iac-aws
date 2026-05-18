# Plan de Proyecto — Plataforma de E-Commerce en AWS

**Curso:** Infraestructura III  
**Docente:** Ing. Mario German Castillo Ramirez  
**Equipo:** Melo088 — Juan C. Melo / Esteban G.V.  
**Fecha de inicio:** 25 de abril de 2026  
**Entrega final:** 29 de mayo de 2026

---

## 1. Objetivos

### Objetivo general
Desplegar una plataforma de comercio electrónico funcional en AWS utilizando Infrastructure as Code (CloudFormation), aplicando principios de escalabilidad, seguridad y automatización vistos en el curso.

### Objetivos específicos
- Diseñar e implementar una arquitectura AWS de múltiples capas (red, cómputo, base de datos, distribución).
- Automatizar el aprovisionamiento completo de la infraestructura mediante CloudFormation.
- Integrar una pasarela de pago real (MercadoPago) con soporte de webhooks.
- Configurar monitoreo, alertas y notificaciones con CloudWatch y SNS.
- Verificar el auto scaling bajo carga real mediante stress testing.
- Documentar el proceso completo para reproducibilidad y presentación académica.

---

## 2. Alcance

### Incluido
| Área | Detalle |
|---|---|
| Red | VPC, subredes públicas/privadas, IGW, NAT Gateway, route tables |
| Seguridad | Security groups por capa, IMDSv2 en EC2, acceso SSH solo vía Bastion |
| Cómputo | Auto Scaling Group (1–3 × t2.medium), Launch Template con user-data |
| Bastion Host | Instancia t2.micro en subred pública para acceso administrativo seguro |
| Base de datos | RDS PostgreSQL 15, Single-AZ, subred privada |
| Balanceo de carga | Application Load Balancer internet-facing con health checks |
| Frontend | React 18 + Vite, servido desde S3 + CloudFront (HTTPS) |
| Backend | Spring Boot 3 / Java 21, desplegado como JAR en EC2 vía S3 |
| Pagos | Integración MercadoPago (Checkout Bricks + webhooks HTTPS) |
| Media | S3 bucket de imágenes con presigned PUT URLs + distribución CloudFront |
| Panel de administración | Rol ADMIN con rutas protegidas y dashboard de gestión |
| Historial de pedidos | Página de perfil con órdenes y snapshot de items por orden |
| Monitoreo | CloudWatch alarmas, dashboard, SNS email |
| Auditoría | CloudTrail trail con validación de integridad, retención 90 días |
| Auto scaling verificado | Stress test real: escala de 1 a 2 instancias bajo carga de CPU |
| IaC | 10 templates CloudFormation + scripts de deploy automatizado |
| Scripts | `deploy-all.sh`, `upload-templates.sh`, `upload-media.sh`, `stress-test.sh`, `demo-check.sh` |

### Excluido (limitaciones del sandbox)
- Multi-AZ en RDS (no soportado en AWS Academy con instancias db.t3)
- HTTPS nativo en ALB (sin Route53 ni ACM con dominio propio — resuelto con CloudFront)
- Creación de roles/policies IAM nuevos (IAM read-only en sandbox)

---

## 3. Cronograma

| Semana | Fechas | Actividades | Estado |
|---|---|---|---|
| 1 | 25–26 Abr | Setup inicial del repositorio. Infraestructura base completa: VPC, Security Groups, RDS, ALB, ASG, S3 artifacts, Bastion Host. Backend Spring Boot con entidades y repositorios JPA. | Completado |
| 2 | 27–28 Abr | Backend completo: Spring Security + JWT, service layer, DTOs, manejo de excepciones. Frontend React con Vite, Tailwind, contexto de auth e interceptor JWT. CloudWatch + SNS + dashboard. Orquestador `main.yaml` y scripts `deploy-all.sh`, `upload-templates.sh`. | Completado |
| 3 | 2 May | Integración MercadoPago: Checkout Bricks, gestión de órdenes, endpoint de confirmación de pago y robustez del webhook (estados rejected, cancelled, refunded). Datos de productos seed. | Completado |
| 4 | 10–12 May | Deploy completo a AWS con CloudFront + S3 frontend, pagos end-to-end verificados. CloudTrail. Panel de administración con rol ADMIN. S3 media bucket con presigned PUT URLs y distribución CloudFront de media. | Completado |
| 5 | 16–18 May | Historial de pedidos en página de perfil (snapshot de items). Stress test con ProxyJump SSH y monitoreo de auto scaling (escala 1→2 instancias verificada). Correcciones de UI responsive. Documentación final y presentación. | En curso |

---

## 4. Recursos

### Recursos AWS (sandbox)
| Recurso | Tipo/Tamaño | Cantidad |
|---|---|---|
| EC2 app | t2.medium | 1–3 (ASG) |
| EC2 Bastion | t2.micro | 1 |
| RDS PostgreSQL | db.t3.micro | 1 |
| ALB | application | 1 |
| NAT Gateway | — | 1 |
| S3 buckets | — | 4 (artifacts, frontend, media, cloudtrail-logs) |
| CloudFront distribuciones | — | 3 (frontend, backend proxy, media) |
| CloudTrail | — | 1 (single-region, global events) |
| SNS topics | — | 1 (alertas email) |
| CloudWatch alarmas | — | 4 (CPU alta/baja, 5xx, unhealthy hosts) |

### Scripts de operación
| Script | Propósito |
|---|---|
| `deploy-all.sh` | Despliega los 10 stacks CloudFormation en orden con espera entre cada uno |
| `upload-templates.sh` | Sube los templates YAML a S3 para nested stacks |
| `upload-media.sh` | Sube imágenes de productos al bucket S3 de media |
| `stress-test.sh` | Genera carga CPU en EC2 vía SSH con ProxyJump por el Bastion; monitorea el ASG |
| `demo-check.sh` | Verifica el estado de todos los recursos AWS antes de la presentación |

### Tecnologías utilizadas
- **IaC:** AWS CloudFormation (YAML), 10 templates
- **Backend:** Java 21, Spring Boot 3.3, Maven, PostgreSQL, JPA/Hibernate, Spring Security + JWT
- **Frontend:** React 18, Vite, Tailwind CSS, MercadoPago Bricks SDK
- **Pasarela de pago:** MercadoPago Checkout Bricks + webhooks
- **CI/CD local:** Scripts Bash para deploy automatizado

### Equipo
| Rol | Responsabilidad |
|---|---|
| Infraestructura | CloudFormation templates, scripts de deploy, arquitectura AWS |
| Backend | API REST Spring Boot, lógica de negocio, integración MercadoPago |
| Frontend | UI React, flujo de compra, integración con API y SDK de pagos |

---

## 5. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Límite de instancias sandbox (9 EC2) | Media | Alto | ASG limitado a 3 instancias; Bastion en t2.micro |
| Expiración de sesión AWS Academy | Alta | Medio | Script `set-aws-session.sh` para renovar credenciales rápidamente |
| Cambios de AMI de Amazon Linux | Baja | Bajo | Launch Template usa SSM para obtener siempre la AMI más reciente |
| Webhook MercadoPago requiere HTTPS | Alta | Medio | CloudFront como proxy HTTPS frente al ALB (sin necesidad de dominio) |
| Tiempo de provisioning RDS (~10 min) | Certeza | Bajo | Deploy secuencial con `wait stack-create-complete` en `deploy-all.sh` |
| Credenciales en texto plano en user-data | Media | Medio | Variables en `/etc/ecom-app.env` con permisos 600; en producción usar Secrets Manager |
