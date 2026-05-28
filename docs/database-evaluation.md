# Evaluación de Bases de Datos. E-Commerce en AWS

Este documento evalúa tres tecnologías de bases de datos disponibles en AWS para la plataforma de e-commerce, justifica la elección realizada y describe cómo cada alternativa podría complementar la arquitectura en un escenario de mayor escala.

---

## Modelo de datos del dominio

La plataforma gestiona las siguientes entidades y sus relaciones:

```
Usuario ──< Orden ──< OrderItem >── Producto
                │
                └── (mpPreferenceId, mpPaymentId, status)
```

Las relaciones son intrínsecamente relacionales: un usuario posee múltiples órdenes, cada orden contiene uno o más `OrderItem` que representan un snapshot inmutable de los productos al momento del checkout (nombre, precio y cantidad capturados en ese instante), y cada orden registra los identificadores de pago de MercadoPago junto con su estado (`PENDING`, `PAID`, `FAILED`).

La entidad `OrderItem` es fundamental para preservar la integridad histórica del historial de pedidos: al capturar el estado del producto en el momento de la compra, el historial es inmune a cambios posteriores en el catálogo (modificación de precio o nombre de un producto).

La integridad referencial, las transacciones ACID y la capacidad de consulta relacional son requisitos naturales del dominio de pagos y órdenes.

---

## 1. PostgreSQL 15. Elegida

**Tipo:** Base de datos relacional (SQL), ACID compliant.  
**En AWS:** RDS PostgreSQL 15, `db.t3.micro`, Single-AZ, subred privada.

### Fortalezas para este caso de uso

| Característica | Relevancia |
|---|---|
| Transacciones ACID | Garantiza que la creación de una orden y su snapshot de items sean atómicos |
| Integridad referencial (FK) | Previene órdenes huérfanas sin usuario o con productos inexistentes |
| JOINs complejos | Recuperación de orden con sus OrderItems en una sola consulta eficiente |
| Soporte JPA/Hibernate | Mapeo directo con las entidades Java del backend Spring Boot |
| Madurez y ecosistema | Drivers, herramientas y documentación ampliamente disponibles |

### Limitaciones

- El escalado es predominantemente vertical (incremento de la clase de instancia) en lugar de horizontal.
- Para cargas de lectura muy elevadas requeriría réplicas de lectura adicionales.
- En el entorno sandbox: Single-AZ sin alta disponibilidad (Multi-AZ no disponible con instancias `db.t3` en AWS Academy).

### Configuración utilizada

```
Motor:    PostgreSQL 15
Clase:    db.t3.micro (2 vCPU, 1 GB RAM)
Storage:  20 GB gp2, auto-scaling hasta 100 GB
Backup:   7 días de retención, snapshot al eliminar el stack
Schema:   Hibernate DDL auto=update
```

---

## 2. Amazon DynamoDB. Evaluada

**Tipo:** Base de datos NoSQL key-value / document, serverless.  
**Modelo:** Tabla con partition key y sort key opcional; sin schema fijo.

### ¿Cuándo es la elección correcta?

DynamoDB ofrece ventajas en casos de uso con lectura masiva y schema flexible:

- Catálogos de productos con atributos heterogéneos (un producto tiene `color`, otro tiene `talla`, otro tiene `peso`).
- Sesiones de usuario con TTL automático para expiración.
- Historial de eventos de alta frecuencia (clickstream, logs de actividad).
- Aplicaciones que requieren escalado automático a millones de operaciones por segundo.

### Por qué no se eligió para este proyecto

El dominio de e-commerce presenta relaciones fuertemente acopladas que penalizan el modelo de DynamoDB:

| Operación | Con PostgreSQL | Con DynamoDB |
|---|---|---|
| Obtener orden con sus items y productos | Un JOIN | Una consulta más N `GetItem` por item (problema N+1) |
| Verificar stock disponible al crear orden | Una transacción | `TransactWriteItems` (mayor complejidad) |
| Reportes de ventas por categoría | `GROUP BY` nativo | Requiere GSI o scan completo |
| Consistencia en pago + actualización de orden | Una transacción ACID | `TransactWriteItems` (limitado a 25 items) |

La desnormalización necesaria para aprovechar DynamoDB incrementaría significativamente la complejidad del código Java y redundaría en duplicación de datos.

### Uso potencial en producción

DynamoDB sería adecuado para el catálogo de productos si este creciera a millones de SKUs con atributos altamente variables. Se implementaría como una tabla separada, y el backend consultaría DynamoDB para listados del catálogo y PostgreSQL para el flujo de órdenes y pagos.

---

## 3. Amazon ElastiCache Redis. Evaluada

**Tipo:** Base de datos en memoria (in-memory), key-value.  
**Latencia:** Sub-milisegundo.  
**Persistencia:** Opcional mediante RDB snapshots y AOF logs.

### Cuándo es la elección correcta

Redis actúa como capa de aceleración y no como base de datos primaria. Sus casos de uso más relevantes para e-commerce son los siguientes:

| Caso de uso | Mecanismo Redis |
|---|---|
| Caché del catálogo de productos | `SET productos:all <json>` con TTL de 5 minutos |
| Sesiones de usuario (alternativa a JWT) | `SETEX session:<id> 3600 <datos>` |
| Conteo de visitas y ranking de productos | `INCR vistas:<product_id>` |
| Rate limiting en endpoints de pago | `INCR intentos:<user_id>` con TTL |
| Cola de notificaciones (Pub/Sub) | `PUBLISH` / `SUBSCRIBE` |

### Por qué no se implementó

El volumen de la demostración no justifica la complejidad adicional por las siguientes razones:

- El catálogo contiene decenas de productos, no millones; RDS responde en menos de 5 ms.
- El sandbox de AWS Academy limita el número de instancias EC2 a 9; agregar un nodo ElastiCache consumiría cuota disponible.
- La arquitectura JWT stateless elimina la necesidad de almacenamiento de sesión del lado del servidor.

### Impacto esperado si se implementara

Para una carga de producción real, agregar ElastiCache Redis frente a RDS en el endpoint `GET /api/v1/products` podría reducir la latencia y disminuir la carga sobre RDS, asumiendo que el catálogo cambia con poca frecuencia y que la mayoría del tráfico es de lectura.

```
Request → Spring Boot → Redis HIT  → respuesta en ~x ms
                     → Redis MISS → RDS → actualiza caché → ~xx ms
```

---

## Conclusión y decisión final

| Criterio | PostgreSQL | DynamoDB | Redis |
|---|---|---|---|
| Integridad transaccional | Nativo ACID | Parcial (`TransactWriteItems`) | No aplica |
| Relaciones entre entidades | JOINs nativos | Desnormalización manual | No aplica |
| Flexibilidad de schema | Migraciones requeridas | Sin schema fijo | Sin schema fijo |
| Escalado de lectura | Read replicas | Automático | In-memory |
| Costo en sandbox | db.t3.micro (bajo) | On-demand (bajo) | Instancia adicional |
| Integración con Spring Boot/JPA | Driver nativo y JPA | SDK propio (sin JPA) | Spring Data Redis |

**Decisión:** PostgreSQL como única base de datos es la elección correcta para la escala y la naturaleza relacional de este proyecto. La existencia de entidades con relaciones bien definidas (`Usuario`, `Orden`, `OrderItem`, `Producto`), el requerimiento de transacciones atómicas en el flujo de pagos, y la integración directa con JPA/Hibernate hacen de PostgreSQL la tecnología más adecuada sin añadir complejidad operacional innecesaria.

### Arquitectura objetivo para producción real

```
Spring Boot
  ├── ElastiCache Redis   ← caché de catálogo, rate limiting
  └── RDS PostgreSQL      ← órdenes, usuarios, pagos (fuente de verdad)
         └── DynamoDB     ← catálogo de millones de productos (si aplica)
```

Esta arquitectura en capas separa las responsabilidades según la naturaleza del dato: Redis actúa como capa de aceleración para lecturas frecuentes de baja criticidad; PostgreSQL preserva la consistencia transaccional del núcleo de negocio (órdenes, pagos, usuarios); y DynamoDB absorbería el catálogo de productos en el escenario en que su volumen y heterogeneidad de atributos supere las capacidades óptimas de un modelo relacional. Cada capa se escala de forma independiente, lo que permite optimizar costo y rendimiento según el perfil de carga de cada tipo de dato.
