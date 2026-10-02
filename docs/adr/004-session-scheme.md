# ADR 004 — Esquema de sesión y sondeo de reproducción

**Fecha:** 2026-09-16  
**Estado:** Aceptado

## Contexto
Dos problemas relacionados con el estado:
1. Cómo autenticar a los usuarios en la API REST y WebSocket.
2. Cómo detectar que una canción ha terminado para encadenar la siguiente (Spotify Web API no emite eventos push).

## Decisión — Sesión
JWT de corta duración (15 min) + refresh token rotatorio almacenado hasheado en base de datos.

## Justificación (sesión)
- Access token corto limita la ventana de exposición si se intercepta.
- Refresh token rotatorio: si llega uno ya usado, se revoca toda la familia — señal de robo.
- Sin estado en servidor para los access tokens: escala horizontalmente sin sesiones compartidas.

## Consecuencias aceptadas (sesión)
- El cliente debe implementar lógica de refresco transparente.
- Revocar todos los tokens de un usuario requiere una tabla de refresh tokens (ya incluida en el esquema).

## Actualización 2026-10-02 — Revocación inmediata
El punto "sin estado en servidor para los access tokens" se ha matizado. Cada petición autenticada consulta `users.sessionsValidAfter`, y los access tokens emitidos antes de esa fecha se rechazan.

Se actualiza en tres casos: "cerrar sesión en todos los dispositivos", cambio de contraseña y recuperación de contraseña.

- **Coste:** una lectura por clave primaria por petición.
- **Ganancia:** una sesión robada se corta al momento, en vez de seguir viva hasta 15 minutos.

## Decisión — Sondeo de reproducción
El backend consulta `GET /v1/me/player` cada 3 segundos mientras hay un evento en vivo. Cuando `progress_ms / duration_ms > 0.95`, extrae la pista más votada de la cola, la marca como `playing` y emite el cambio por WebSocket.

## Justificación (sondeo)
- Spotify Web API no ofrece webhooks ni eventos push para fin de pista.
- 3 segundos es el balance entre latencia de transición perceptible (~1s) y consumo de cuota de API.
- El sondeo vive en el servidor, nunca en el móvil: un cliente que desconecta no rompe el encadenado.

## Consecuencias aceptadas (sondeo)
- Latencia máxima de transición entre canciones: ~3 segundos.
- Consumo de cuota: ~20 llamadas/minuto por evento activo.
- Si la cuota de Spotify se agota, el encadenado falla silenciosamente hasta que se recupera.
