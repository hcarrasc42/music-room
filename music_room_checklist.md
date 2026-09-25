# Music Room — Checklist de requisitos (subject v6)

Lista de verificación antes de entregar y defender el proyecto.
Marca cada punto solo si puedes **demostrarlo funcionando** y **justificarlo** en la defensa.

---

## 0. Puntos que pueden hacerte fallar directamente

- [ ] Ninguna credencial, API key o variable de entorno está subida a git (todo en `.env`, `.env` en `.gitignore`).
- [ ] No hay librerías de terceros commiteadas en el repo (solo código propio).
- [ ] Las dependencias se descargan solas desde un clone limpio (Makefile o mecanismo equivalente).
- [ ] La parte obligatoria está **completa y sin fallos** (si no, el bonus ni se evalúa).
- [ ] Todo el trabajo está dentro del repo Git y los nombres de carpetas/ficheros son correctos.
- [ ] El SDK elegido **no hace el trabajo por ti** (la lógica de voto/playlist/delegación es tuya).

---

## 1. Uso de IA (Capítulo II)

- [ ] Podéis explicar y defender **cada** decisión técnica sin depender de la IA.
- [ ] Está documentado de forma transparente qué partes se generaron con IA.
- [ ] Todo lo generado por IA ha sido revisado por el equipo (no hay arquitectura "caja negra").

---

## 2. Arquitectura general (Capítulo IV)

- [ ] Elección de tecnología de back-end justificada (ventajas/inconvenientes evaluados).
- [ ] Elección de almacenamiento de datos justificada.
- [ ] Aplicación móvil para **Android o iOS** (tecnología libre).
- [ ] La app cubre **todas** las acciones necesarias del proyecto.

---

## 3. Usuario (V.1)

- [ ] Registro en el primer arranque: mail/contraseña **o** red social (Facebook o Google).
- [ ] Un usuario ya registrado puede **vincular** su cuenta de red social (Facebook o Google).
- [ ] Si el registro fue con mail/contraseña: **validación por email** obligatoria.
- [ ] Recuperación / cambio de contraseña si el usuario la olvida.
- [ ] Perfil: el usuario puede **consultar y actualizar**:
  - [ ] información pública,
  - [ ] información visible solo para amigos,
  - [ ] información privada,
  - [ ] preferencias musicales.

---

## 4. Servicios (V.2)

> El subject se contradice: el Cap. III dice "los siguientes servicios deberán implementarse" (los 3) y V.2 dice "al menos 2 de 3"; V.7 vuelve a hablar de "tus 3 servicios". **Confirma con el equipo/evaluador**; lo seguro es implementar los 3.

- [ ] El usuario accede al menos a **2** de: Music Track Vote, Music Playlist Editor, Music Control Delegation.

### 4.1 Music Track Vote (V.2.1)

- [ ] Cualquiera puede **sugerir** una pista para la playlist actual.
- [ ] Cualquiera puede **votar** la siguiente pista.
- [ ] Las pistas con más votos **suben** en la lista y se reproducen antes.
- [ ] Visibilidad:
  - [ ] Por defecto el evento es **público**.
  - [ ] Público → cualquier usuario encuentra el evento y vota.
  - [ ] Privado → solo los invitados encuentran el evento y votan.
- [ ] Licencias:
  - [ ] Por defecto, **todo el mundo puede votar**.
  - [ ] Licencia: solo los invitados pueden votar.
  - [ ] Licencia: solo quien esté en **una ubicación concreta** dentro de **una franja horaria** concreta (ej. 16:00–18:00) puede votar.
- [ ] Gestión de **concurrencia**: varios usuarios votando a la vez, la misma pista o distintas, sin corromper el orden.

### 4.2 Music Control Delegation (V.2.2)

- [ ] Gestión de licencias **por dispositivo** asociado a la cuenta del usuario.
- [ ] El usuario puede **delegar el control de la música** a distintos amigos.

### 4.3 Music Playlist Editor (V.2.3)

- [ ] Edición de playlists **multi-usuario en tiempo real**.
- [ ] Visibilidad:
  - [ ] Por defecto la playlist es **pública**.
  - [ ] Pública → todos los usuarios acceden.
  - [ ] Privada → solo los invitados acceden.
- [ ] Licencias:
  - [ ] Por defecto, todos pueden editar.
  - [ ] Licencia: solo los invitados pueden editar.
- [ ] Gestión de **concurrencia**: varios usuarios moviendo pistas a la vez (mismas o distintas).

---

## 5. Servidor (V.3)

- [ ] **Todos** los datos de los servicios se guardan en el back-end.
- [ ] El back-end es la única fuente de verdad (el cliente no decide nada).

---

## 6. API (V.4)

- [ ] Documentación de referencia de la API con **métodos, entradas y salidas** (ej. Swagger).
- [ ] API basada en REST (o alternativa) — **justificable** y sabes explicar sus características.
- [ ] Formato de intercambio JSON (o alternativa) — **justificable**.

---

## 7. Aplicación móvil (V.5)

- [ ] La app es solo un "mando a distancia" del back-end (cero lógica de negocio en el cliente).
- [ ] La **dirección del back-end es configurable** desde la app para pruebas.
- [ ] Autenticación vía red social (Facebook o Google) implementada en la app.

---

## 8. Seguridad (V.6)

- [ ] Un usuario autenticado accede a **sus** datos y **no** a los de otros (probado).
- [ ] Mecanismos de protección implementados (bruteforce de la API, robo de sesión, etc.).
- [ ] Otros riesgos **identificados y documentados** con las protecciones practicables.
- [ ] **Toda** acción de la app genera log en el back-end, incluyendo:
  - [ ] plataforma (Android, iOS…),
  - [ ] dispositivo (modelo),
  - [ ] versión de la aplicación.

---

## 9. Ramp-up / carga (V.7)

- [ ] Medición real de carga hecha (AB, Gatling, Siege, Tsung, JMeter…).
- [ ] Número de usuarios simultáneos soportados por cada servicio **medido y justificado**.
- [ ] Características del servidor especificadas (CPU, RAM, cloud o on-premise).
- [ ] La cifra máxima es **coherente** con la plataforma (decenas en Raspberry, miles en servidor).

---

## 10. Agilidad, calidad e integración continua (V.8)

- [ ] Reparto de tareas entre los miembros del equipo demostrable.
- [ ] Tests específicos por **cada capa** del proyecto.
- [ ] Capacidad de cuestionar y justificar vuestras propias decisiones.
- [ ] Integración continua en marcha.

---

## 11. Bonus (solo si lo obligatorio es PERFECTO)

- [ ] **Multi-plataforma**: versión web responsive adaptable a cualquier pantalla.
- [ ] **IoT**: mecanismo tipo iBeacon (info del evento al acercarse a un evento público).
- [ ] **Suscripción gratuita vs. de pago**: cambio entre ofertas y funcionalidades restringidas a pago (ej. Music Playlist Editor).
- [ ] **Modo offline**: uso sin conexión + sincronización posterior, gestionando:
  - [ ] conflictos y concurrencia,
  - [ ] datos obsoletos en el móvil.

---

## 12. Entrega (Capítulo VII)

- [ ] Todo subido al repositorio Git.
- [ ] Nombres de carpetas y ficheros verificados.
- [ ] Probado desde un **clone limpio** en otra máquina antes de la defensa.
