// scripts/setup.js — instala dependencias y crea backend/.env si faltan
const { spawnSync } = require('child_process');
const crypto = require('crypto');
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
  addMissingKeys(envFile);
  ensureSecret(envFile, 'JWT_SECRET', 48);
  ensureSecret(envFile, 'TOKEN_ENCRYPTION_KEY', 32);
}

const readEnv = (file) => fs.readFileSync(file, 'utf8');
const getKey = (env, key) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();

// Añade al .env las variables nuevas de .env.example que aún no tenga
// (para quien ya tenía un .env de antes de que existieran)
function addMissingKeys(envFile) {
  const example = readEnv(path.join(root, '.env.example'));
  let env = readEnv(envFile);
  const added = [];
  for (const [, key, value] of example.matchAll(/^([A-Z0-9_]+)=(.*)$/gm)) {
    if (getKey(env, key) !== undefined) continue;
    env = `${env.trimEnd()}\n${key}=${value}\n`;
    added.push(key);
  }
  if (!added.length) return;
  fs.writeFileSync(envFile, env);
  console.log(`→ Añadidas a backend/.env las variables nuevas: ${added.join(', ')}`);
}

// Sustituye un secreto de ejemplo por uno aleatorio: con el valor público del
// .env.example cualquiera podría firmar tokens (JWT) o descifrar datos (tokens de Spotify)
function ensureSecret(envFile, key, bytes) {
  const env = readEnv(envFile);
  const current = getKey(env, key);
  if (current && current !== 'change_this_in_production' && current.length >= 32) return;
  const secret = crypto.randomBytes(bytes).toString('hex');
  const updated = current === undefined
    ? `${env.trimEnd()}\n${key}=${secret}\n`
    : env.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${secret}`);
  fs.writeFileSync(envFile, updated);
  console.log(`→ Generado un ${key} aleatorio en backend/.env`);
}

module.exports = { setup, run, root, getKey, readEnv };

if (require.main === module) setup();
