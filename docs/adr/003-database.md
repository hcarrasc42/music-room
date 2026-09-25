# ADR 003 — Almacenamiento de datos

**Fecha:** 2026-09-16  
**Estado:** Aceptado

## Contexto
Necesitamos almacenar usuarios, eventos, colas de votación y logs. La concurrencia (varios usuarios votando a la vez) es un requisito explícito del enunciado.

## Opciones consideradas
- **PostgreSQL**
- MongoDB
- SQLite
- Redis (como almacenamiento principal)

## Decisión
PostgreSQL 16.

## Justificación
- Las restricciones únicas a nivel de motor (UNIQUE constraint en votes(suggestion_id, user_id)) hacen imposible el doble voto sin lógica de aplicación adicional.
- Índices únicos parciales permiten modelar reglas de negocio complejas (misma canción no puede estar dos veces en cola activa).
- Transacciones ACID garantizan consistencia bajo carga concurrente.
- La respuesta en defensa es sólida: "la concurrencia la resuelve el motor, no el código".

## Consecuencias aceptadas
- Esquema rígido: cambios de modelo requieren migraciones.
- Más configuración inicial que SQLite o MongoDB.
- Necesita Docker en desarrollo (resuelto con docker-compose).
