# ADR 002 — Transporte en tiempo real

**Fecha:** 2026-09-16  
**Estado:** Aceptado

## Contexto
La cola de votación necesita actualizarse en todos los clientes conectados sin que hagan polling desde el móvil.

## Opciones consideradas
- **WebSockets (Socket.IO sobre NestJS Gateway)**
- Server-Sent Events (SSE)
- Long polling
- GraphQL Subscriptions

## Decisión
WebSockets con Socket.IO usando el gateway integrado de NestJS.

## Justificación
- NestJS incluye el gateway de WebSockets sin dependencias adicionales.
- Socket.IO gestiona reconexión automática y fallback a long-polling si WebSockets no está disponible.
- Bidireccional: el servidor puede emitir deltas y el cliente puede emitir acciones (voto, propuesta) por el mismo canal.
- SSE es unidireccional y no cubre el caso de acciones del cliente.

## Consecuencias aceptadas
- Conexiones persistentes aumentan el consumo de memoria por usuario conectado.
- Hay que gestionar salas (rooms) por evento para no emitir a todos los clientes.
- Los deltas deben ser idempotentes: un cliente que reconecta puede recibir un delta ya aplicado.
