# Evaluación de Bases de Datos — E-Commerce en AWS

Este documento evalúa tres tecnologías de bases de datos disponibles en AWS para la plataforma de e-commerce, justifica la elección realizada y describe cómo cada alternativa podría complementar la arquitectura en un escenario de mayor escala.

---

## Modelo de datos del dominio

La plataforma maneja las siguientes entidades y sus relaciones:

```
Usuario ──< Orden ──< OrdenItem >── Producto
                │
                └──< Pago
```

Las relaciones son intrínsecamente relacionales: un usuario tiene múltiples órdenes, cada orden referencia productos existentes, y cada pago está ligado a una orden específica. La integridad referencial y las transacciones ACID son requisitos naturales del dominio de pagos.

---

## 1. PostgreSQL 15 — Elegida

**Tipo:** Base de datos relacional (SQL), ACID compliant.  
**En AWS:** RDS PostgreSQL 15, `db.t3.micro`, Single-AZ, subred privada.

### Fortalezas para este caso de uso

| Característica | Relevancia |
|---|---|
| Transacciones ACID | Garantiza que un pago y la actualización de stock sean atómicos |
| Integridad referencial (FK) | Previene órdenes huérfanas sin usuario o con productos inexistentes |
| JOINs complejos | `SELECT orden + items + productos` en una sola consulta eficiente |
| Soporte JPA/Hibernate | Mapeo directo con las entidades Java del backend Spring Boot |
| Madurez y ecosistema | Drivers, herramientas, documentación abundante |

### Limitaciones

- Escalado vertical (escalar la instancia) más que horizontal.
- Para cargas de lectura muy altas requeriría réplicas de lectura.
- En el sandbox: Single-AZ (sin alta disponibilidad).

### Configuración elegida

```
Motor:    PostgreSQL 15
Clase:    db.t3.micro (2 vCPU, 1 GB RAM) — suficiente para demo
Storage:  20 GB gp2, auto-scaling hasta 100 GB
Backup:   7 días de retención, snapshot al eliminar
Schema:   Hibernate DDL auto=update
```

---

## 2. Amazon DynamoDB — Evaluada

**Tipo:** Base de datos NoSQL key-value / document, serverless.  
**Modelo:** Tabla con partition key + sort key; sin schema fijo.

### Cuándo es la elección correcta

DynamoDB destaca en casos de uso con **lectura masiva y schema flexible**:
- Catálogos de productos con atributos heterogéneos (un producto tiene `color`, otro tiene `talla`, otro tiene `peso`).
- Sesiones de usuario (TTL automático para expiración).
- Historial de eventos de alta frecuencia (clickstream, logs de actividad).
- Aplicaciones que necesitan escalado automático a millones de operaciones por segundo.

### Por qué no se eligió para este proyecto

El dominio de e-commerce tiene relaciones fuertemente acopladas que penalizan a DynamoDB:

| Operación | Con PostgreSQL | Con DynamoDB |
|---|---|---|
| Obtener orden con sus ítems y productos | 1 JOIN | 1 query + N `GetItem` por producto (N+1) |
| Verificar stock disponible al crear orden | 1 transacción | Transacciones DynamoDB (más complejo) |
| Reportes de ventas por categoría | `GROUP BY` nativo | Requiere GSI o scan completo |
| Consistencia en pago + actualización de orden | 1 transacción ACID | `TransactWriteItems` (limitado a 25 items) |

La desnormalización necesaria para aprovechar DynamoDB aumentaría significativamente la complejidad del código Java y duplicaría datos.

### Uso potencial en producción

DynamoDB sería ideal para el **catálogo de productos** si este creciera a millones de SKUs con atributos altamente variables. Se implementaría como una tabla separada, y el backend consultaría DynamoDB para listings del catálogo y PostgreSQL para el flujo de órdenes/pagos.

---

## 3. Amazon ElastiCache Redis — Evaluada

**Tipo:** Base de datos en memoria (in-memory), key-value.  
**Latencia:** Sub-milisegundo.  
**Persistencia:** Opcional (RDB snapshots, AOF logs).

### Cuándo es la elección correcta

Redis es una **capa de aceleración**, no una base de datos primaria. Sus casos de uso más relevantes para e-commerce:

| Caso de uso | Mecanismo Redis |
|---|---|
| Caché del catálogo de productos | `SET productos:all <json>` con TTL de 5 min |
| Sesiones de usuario (alternativa a JWT) | `SETEX session:<id> 3600 <datos>` |
| Conteo de visitas / ranking de productos | `INCR vistas:<product_id>` |
| Rate limiting en endpoints de pago | `INCR intentos:<user_id>` + TTL |
| Cola de notificaciones (Pub/Sub) | `PUBLISH` / `SUBSCRIBE` |

### Por qué no se implementó

El volumen de la demo no justifica la complejidad adicional:
- El catálogo tiene decenas de productos, no millones — RDS responde en <5 ms.
- El sandbox de AWS Academy tiene límite de instancias (9 EC2); añadir ElastiCache consumiría cuota.
- La arquitectura JWT stateless ya elimina la necesidad de almacenamiento de sesión.

### Impacto esperado si se implementara

Para una carga de producción real, agregar ElastiCache Redis frente a RDS en el endpoint `GET /api/v1/products` podría reducir la latencia de ~20 ms a ~1 ms y disminuir la carga en RDS en un 80–90% (asumiendo que el catálogo cambia poco y la mayoría del tráfico es de lectura).

```
Request → Spring Boot → Redis HIT  → respuesta en ~1 ms
                     → Redis MISS → RDS → actualiza caché → ~20 ms
```

---

## Conclusión y decisión final

| Criterio | PostgreSQL | DynamoDB | Redis |
|---|---|---|---|
| Integridad transaccional | ✅ Nativo ACID | ⚠️ Parcial | ❌ No aplica |
| Relaciones entre entidades | ✅ JOINs nativos | ❌ Desnormalización manual | ❌ No aplica |
| Flexibilidad de schema | ⚠️ Migraciones | ✅ Sin schema | ✅ Sin schema |
| Escalado de lectura | ⚠️ Read replicas | ✅ Automático | ✅ In-memory |
| Costo en sandbox | ✅ db.t3.micro | ✅ On-demand | ⚠️ Instancia adicional |
| Integración con Spring Boot/JPA | ✅ Driver nativo | ⚠️ SDK propio | ⚠️ Spring Data Redis |

**Decisión:** PostgreSQL como única base de datos es la elección correcta para la escala y naturaleza relacional de este proyecto.

**Arquitectura objetivo para producción real:**
```
Spring Boot
  ├── ElastiCache Redis   ← caché de catálogo, rate limiting
  └── RDS PostgreSQL      ← órdenes, usuarios, pagos (fuente de verdad)
         └── DynamoDB     ← catálogo de millones de productos (si aplica)
```
