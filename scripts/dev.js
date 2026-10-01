// scripts/dev.js — levanta Postgres, backend y Expo con un solo comando
const { spawn, spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const { setup, root } = require('./setup');

const isWin = process.platform === 'win32';

// IP de la red local, para que el móvil pueda llegar al backend
function lanIp() {
  const skip = /vethernet|virtualbox|vmware|wsl|docker|loopback|bluetooth/i;
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (skip.test(name)) continue;
    // 192.168.56.x es la red host-only de VirtualBox, aunque el adaptador se llame "Ethernet N"
    const ipv4 = (addrs || []).find(
      (a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('192.168.56.'),
    );
    if (ipv4) return ipv4.address;
  }
  return 'localhost';
}

setup();

console.log('→ Levantando Postgres (docker compose)...');
const db = spawnSync('docker compose up -d --wait', { cwd: root, stdio: 'inherit', shell: true });
if (db.status !== 0) {
  console.error('\n✖ No se pudo levantar Postgres. ¿Está Docker Desktop abierto?');
  process.exit(1);
}

const ip = lanIp();
const apiUrl = process.env.API_URL || `http://${ip}:3000`;
console.log(`→ Backend accesible desde el móvil en: ${apiUrl}\n`);

// Backend en segundo plano, con sus logs prefijados
const api = spawn('npm run start:dev', {
  cwd: path.join(root, 'backend'),
  shell: true,
  detached: !isWin,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: '1' },
});
const prefix = (stream, out) =>
  stream.on('data', (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) if (line) out.write(`[api] ${line}\n`);
  });
prefix(api.stdout, process.stdout);
prefix(api.stderr, process.stderr);

// Expo en primer plano, para que el QR y las teclas (a, r, ...) funcionen
const app = spawn('npx expo start', {
  cwd: path.join(root, 'mobile'),
  shell: true,
  stdio: 'inherit',
  // Sin esto Expo elige su propia IP y puede anunciar la de VirtualBox en el QR
  env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl, REACT_NATIVE_PACKAGER_HOSTNAME: ip },
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (api.exitCode === null) {
    if (isWin) spawnSync(`taskkill /pid ${api.pid} /T /F`, { shell: true, stdio: 'ignore' });
    else try { process.kill(-api.pid, 'SIGTERM'); } catch {}
  }
  console.log('\n→ Backend y Expo parados. Postgres sigue corriendo (npm run stop para pararlo).');
  process.exit(code);
}

app.on('exit', (code) => stop(code ?? 0));
api.on('exit', (code) => {
  if (!stopping) console.error(`\n✖ El backend se ha cerrado (código ${code}).`);
});
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
