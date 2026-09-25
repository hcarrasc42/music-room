const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const get = (key) => {
  const match = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  if (!match) { console.error(`Falta ${key} en .env`); process.exit(1); }
  return match[1].trim();
};

const CLIENT_ID     = get('SPOTIFY_CLIENT_ID');
const CLIENT_SECRET = get('SPOTIFY_CLIENT_SECRET');
const REFRESH_TOKEN = get('SPOTIFY_REFRESH_TOKEN');

// Primero refresca el access token (el de antes puede haber caducado)
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: REFRESH_TOKEN,
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

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.error) reject(new Error(json.error + ': ' + json.error_description));
        else resolve(json.access_token);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function spotifyRequest(token, method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.spotify.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        let body = null;
        if (data) { try { body = JSON.parse(data); } catch (_) { body = data; } }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runTests() {
  console.log('\nObteniendo access token...');
  const token = await getAccessToken();
  console.log('Access token OK\n');

  // TEST 1: Dispositivos activos
  console.log('--- TEST 1: GET /v1/me/player/devices ---');
  const devRes = await spotifyRequest(token, 'GET', '/v1/me/player/devices');
  const devices = devRes.body?.devices ?? [];
  if (devices.length === 0) {
    console.log('RESULTADO: Sin dispositivos activos. Abre Spotify Desktop y dale al play.');
  } else {
    console.log(`RESULTADO: ${devices.length} dispositivo(s):`);
    devices.forEach(d => console.log(`  - ${d.name} (${d.type}) id=${d.id} activo=${d.is_active}`));
  }

  const activeDevice = devices.find(d => d.is_active) ?? devices[0];
  if (!activeDevice) {
    console.log('\nNo hay dispositivo activo. Abre Spotify Desktop y dale al play antes de seguir.');
    return;
  }

  // TEST 2: Pausar
  console.log('\n--- TEST 2: PUT /v1/me/player/pause ---');
  const pauseRes = await spotifyRequest(token, 'PUT', '/v1/me/player/pause');
  if (pauseRes.status === 204) {
    console.log('RESULTADO: OK (204) — la música debería haberse parado');
  } else if (pauseRes.status === 404) {
    console.log('RESULTADO: 404 — no hay dispositivo activo (TEST 5 adelantado)');
  } else {
    console.log(`RESULTADO: ${pauseRes.status}`, pauseRes.body);
  }

  // TEST 3: Reproducir una canción concreta (Bohemian Rhapsody de Queen)
  console.log('\n--- TEST 3: PUT /v1/me/player/play (Bohemian Rhapsody) ---');
  const playRes = await spotifyRequest(token, 'PUT', '/v1/me/player/play', {
    uris: ['spotify:track:7tFiyTwD0nx5a1eklYtX2J'],
    device_id: activeDevice.id,
  });
  if (playRes.status === 204) {
    console.log('RESULTADO: OK (204) — debería estar sonando Bohemian Rhapsody');
  } else {
    console.log(`RESULTADO: ${playRes.status}`, playRes.body);
  }

  // TEST 4: Buscar canciones
  console.log('\n--- TEST 4: GET /v1/search?type=track&limit=10 (query: "queen") ---');
  const searchRes = await spotifyRequest(token, 'GET', '/v1/search?type=track&limit=10&q=queen');
  if (searchRes.status === 200) {
    const tracks = searchRes.body?.tracks?.items ?? [];
    console.log(`RESULTADO: OK — ${tracks.length} resultados:`);
    tracks.forEach((t, i) => console.log(`  ${i + 1}. ${t.name} — ${t.artists[0].name}`));
  } else {
    console.log(`RESULTADO: ${searchRes.status}`, searchRes.body);
  }

  console.log('\n--- TEST 5 ---');
  console.log('Cierra Spotify Desktop ahora y vuelve a ejecutar solo el test de pausa:');
  console.log('  node test-spotify.js --pause-only');
  console.log('Deberías ver un 404. Eso es el error que tienes que manejar en el backend.\n');
}

// Modo --pause-only para el test 5
if (process.argv.includes('--pause-only')) {
  (async () => {
    const token = await getAccessToken();
    const res = await spotifyRequest(token, 'PUT', '/v1/me/player/pause');
    console.log(`\nRESULTADO pausa: ${res.status}`);
    if (res.status === 404) console.log('404 correcto — no hay dispositivo activo (caso de error verificado)\n');
    else console.log(res.body);
  })().catch(console.error);
} else {
  runTests().catch(console.error);
}
