# ADR 001 — SDK de música

**Fecha:** 2026-09-16  
**Estado:** Aceptado

## Contexto
Necesitamos integrar reproducción y búsqueda de música. Las opciones principales son Spotify Web API, Apple Music API y YouTube Music API.

## Opciones consideradas
- **Spotify Web API** (sin SDK nativo)
- Apple Music API
- YouTube Music API

## Decisión
Spotify Web API llamada exclusivamente desde el backend, sin SDK nativo en el cliente móvil.

## Justificación
- Spotify tiene la mayor penetración en el mercado objetivo.
- Controlar la reproducción desde el servidor (una única cuenta de servicio) permite operar con los 5 huecos de allowlist del plan de desarrollo.
- Sin SDK nativo, Expo normal es suficiente — sin necesidad de development build.
- El Web API cubre los tres scopes necesarios: playback state, modify playback, currently playing.

## Consecuencias aceptadas
- La reproducción requiere que el usuario tenga Spotify abierto en un dispositivo activo.
- El límite de búsqueda es 10 resultados (no 50 como antes de 2026).
- El refresh token caduca a los 6 meses desde la autorización original.
- Sin notificaciones push cuando termina una canción: se resuelve con sondeo en el servidor (ver ADR 004).
