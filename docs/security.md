# Security — Amenazas y protecciones

## Protecciones implementadas

| Amenaza | Protección |
|---|---|
| Doble voto | UNIQUE constraint en BD (motor, no código) |
| Acceso a recursos ajenos | Guard que verifica propiedad del recurso en cada endpoint |
| Robo de refresh token | Rotación + detección de reutilización revoca toda la familia |
| Brute force de login | Rate limiting por IP (100 req/min) + por cuenta (10 intentos/15min) |
| Inyección SQL | TypeORM con queries parametrizadas, nunca interpolación de strings |
| Credenciales en git | `.env` en `.gitignore` desde el primer commit |
| Votar sin estar en ubicación | Validación de coordenadas en servidor, el cliente no es fuente de verdad |

## Amenazas identificadas no mitigadas

| Amenaza | Por qué no mitigada | Protección practicable |
|---|---|---|
| Coordenadas GPS falsas | No hay forma de verificar coordenadas desde el servidor | Firma de ubicación con timestamp desde app certificada |
| DDoS a nivel de red | Fuera del alcance de la aplicación | CDN / WAF delante del servidor |
| Token JWT interceptado en tránsito | Requiere HTTPS en producción (no configurado en dev) | Certificado TLS en producción |
| Cuenta Spotify comprometida | Refresh token en .env, si se filtra el servidor deja de funcionar | Rotación periódica del refresh token |
