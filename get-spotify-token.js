const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');

// Lee el .env manualmente (sin dependencias externas)
const env = fs.readFileSync('.env', 'utf8');
const get = (key) => {
  const match = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  if (!match) { console.error(`Falta ${key} en .env`); process.exit(1); }
  return match[1].trim();
};

const CLIENT_ID     = get('SPOTIFY_CLIENT_ID');
const CLIENT_SECRET = get('SPOTIFY_CLIENT_SECRET');
const REDIRECT_URI  = get('SPOTIFY_REDIRECT_URI');

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

const authUrl =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    scope:         SCOPES,
    redirect_uri:  REDIRECT_URI,
  });

console.log('\n=== Abriendo Spotify en el navegador ===');
console.log('Si no se abre solo, copia esta URL:\n');
console.log(authUrl + '\n');

// Intenta abrir el navegador
try { execSync(`xdg-open "${authUrl}" 2>/dev/null`); } catch (_) {}

// Servidor temporal en puerto 3000 para capturar el callback
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:3000');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.end('<h2>Error: ' + error + '</h2><p>Cierra esta pestaña.</p>');
    console.error('\nSpotify devolvió error:', error);
    server.close();
    return;
  }

  if (!code) return;

  res.end('<h2>Autorizado. Puedes cerrar esta pestaña.</h2>');

  // Intercambia el code por tokens
  const body = new URLSearchParams({
    grant_type:   'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  }).toString();

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const options = {
    hostname: 'accounts.spotify.com',
    path:     '/api/token',
    method:   'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const tokenReq = https.request(options, (tokenRes) => {
    let data = '';
    tokenRes.on('data', (chunk) => data += chunk);
    tokenRes.on('end', () => {
      const json = JSON.parse(data);

      if (json.error) {
        console.error('\nError al obtener tokens:', json.error, json.error_description);
        server.close();
        return;
      }

      console.log('\n=== TOKENS OBTENIDOS ===\n');
      console.log('ACCESS TOKEN (dura 1h, no lo guardes):');
      console.log(json.access_token);
      console.log('\nREFRESH TOKEN (guarda esto en tu .env):');
      console.log(json.refresh_token);
      console.log('\n=== Añade esta línea a tu .env ===');
      console.log(`SPOTIFY_REFRESH_TOKEN=${json.refresh_token}`);
      console.log('================================\n');

      server.close();
    });
  });

  tokenReq.on('error', (e) => console.error('Error de red:', e));
  tokenReq.write(body);
  tokenReq.end();
});

server.listen(3000, '127.0.0.1', () => {
  console.log('Esperando callback de Spotify en http://127.0.0.1:3000/callback ...\n');
});
