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
}

module.exports = { setup, run, root };

if (require.main === module) setup();
