// scripts/setup.js — instala dependencias y crea backend/.env si faltan
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function run(cmd, cwd) {
  const res = spawnSync(cmd, { cwd, stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.error(`\n✖ Falló: ${cmd} (en ${path.relative(root, cwd) || '.'})`);
    process.exit(res.status ?? 1);
  }
}

function setup() {
  for (const dir of ['backend', 'mobile']) {
    const cwd = path.join(root, dir);
    if (!fs.existsSync(path.join(cwd, 'node_modules'))) {
      console.log(`→ Instalando dependencias de ${dir}...`);
      run('npm install', cwd);
    }
  }

  const envFile = path.join(root, 'backend', '.env');
  if (!fs.existsSync(envFile)) {
    fs.copyFileSync(path.join(root, '.env.example'), envFile);
    console.log('→ Creado backend/.env desde .env.example');
    console.log('  ⚠ Rellena las claves de Spotify (y SMTP/Google si las usas).');
  }
  ensureJwtSecret(envFile);
}

// Sustituye el JWT_SECRET de ejemplo por uno aleatorio: con el secreto público
// cualquiera podría firmar tokens válidos
function ensureJwtSecret(envFile) {
  const env = fs.readFileSync(envFile, 'utf8');
  const current = env.match(/^JWT_SECRET=(.*)$/m)?.[1]?.trim();
  if (current && current !== 'change_this_in_production' && current.length >= 32) return;
  const secret = require('crypto').randomBytes(48).toString('hex');
  const updated = current === undefined
    ? `${env.trimEnd()}\nJWT_SECRET=${secret}\n`
    : env.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
  fs.writeFileSync(envFile, updated);
  console.log('→ Generado un JWT_SECRET aleatorio en backend/.env');
}

module.exports = { setup, run, root, ensureJwtSecret };

if (require.main === module) setup();
