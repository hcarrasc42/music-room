# Security — Amenazas y protecciones

## Protecciones implementadas

| Amenaza | Protección |
|---|---|
| Doble voto | UNIQUE constraint en BD (motor, no código) |
| Acceso a recursos ajenos | Guard que verifica propiedad del recurso en cada endpoint |
| Robo de refresh token | Rotación + detección de reutilización revoca toda la familia |
| Brute force de login | Rate limiting por IP (`HttpThrottlerGuard` global: 120 req/min; login 10/min; registro, códigos y cambio de contraseña 5/min) + bloqueo por cuenta (5 contraseñas fallidas seguidas → 15 min bloqueada) |
| Brute force de códigos de email | Código de 6 dígitos guardado como HMAC, caduca en 15 min, se invalida tras 5 fallos, solo uno por minuto |
| Enumeración de cuentas | Mismo mensaje para email inexistente y contraseña incorrecta; "cuenta sin verificar" solo se revela con la contraseña correcta; forgot/resend responden igual exista o no el email |
| Robo de sesión / dispositivo perdido | Logout revoca el refresh token en el servidor; "cerrar sesión en todos los dispositivos" y el cambio/reset de contraseña revocan todos los refresh tokens y anulan los access tokens ya emitidos (`sessionsValidAfter`, comprobado en cada petición) |
| JWT firmado con secreto conocido | `make install` sustituye el `JWT_SECRET` de ejemplo por uno aleatorio de 96 caracteres hex |
| Trazabilidad | Cada petición HTTP queda en `action_logs` con usuario, acción, código de respuesta, plataforma, modelo, versión de la app e IP |
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
