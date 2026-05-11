# Plan de Proyecto — Plataforma de E-Commerce en AWS

**Curso:** Infraestructura III  
**Docente:** Ing. Mario German Castillo Ramirez  
**Equipo:** Melo088 — Juan C. Melo / Esteban G.V.  
**Fecha de inicio:** Abril 2025  
**Entrega final:** Mayo 2025

---

## 1. Objetivos

### Objetivo general
Desplegar una plataforma de comercio electrónico funcional en AWS utilizando Infrastructure as Code (CloudFormation), aplicando principios de escalabilidad, seguridad y automatización vistos en el curso.

### Objetivos específicos
- Diseñar e implementar una arquitectura AWS de múltiples capas (red, cómputo, base de datos, distribución).
- Automatizar el aprovisionamiento completo de la infraestructura mediante CloudFormation.
- Integrar una pasarela de pago real (MercadoPago) con soporte de webhooks.
- Configurar monitoreo, alertas y notificaciones con CloudWatch y SNS.
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
| Pagos | Integración MercadoPago (Checkout Bricks + webhooks) |
| Monitoreo | CloudWatch alarmas, dashboard, SNS email |
| IaC | 8 templates CloudFormation + scripts de deploy automatizado |

### Excluido (limitaciones del sandbox)
- Multi-AZ en RDS (no soportado en AWS Academy)
- HTTPS nativo en ALB (sin Route53 ni ACM con dominio propio)
- CloudTrail (restricciones IAM del sandbox)
- Creación de roles/policies IAM nuevos

---

## 3. Cronograma

| Semana | Actividades | Estado |
|---|---|---|
| x | Diseño de arquitectura, stack de red (VPC, SG, RDS, ALB) | ✅ Completado |
| x | Backend Spring Boot, integración MercadoPago, primer deploy local | ✅ Completado |
| x | Frontend React, scripts de deploy, templates ASG y CloudWatch | ✅ Completado |
| x | Deploy completo a AWS, frontend CloudFront, pruebas end-to-end | 🔄 En curso |
| x | Documentación final, presentación, revisión de entregables | ⏳ Pendiente |

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
| S3 buckets | — | 3 (artifacts, frontend, CloudTrail*) |
| CloudFront | — | 2 (frontend + backend proxy) |

*CloudTrail deshabilitado en sandbox por restricciones IAM.

### Tecnologías utilizadas
- **IaC:** AWS CloudFormation (YAML)
- **Backend:** Java 21, Spring Boot 3.3, Maven, PostgreSQL, JPA/Hibernate
- **Frontend:** React 18, Vite, Tailwind CSS, MercadoPago SDK
- **Pasarela de pago:** MercadoPago Checkout Bricks
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
| Tiempo de provisioning RDS (~10 min) | Certeza | Bajo | Deploy secuencial con `wait stack-create-complete` |
