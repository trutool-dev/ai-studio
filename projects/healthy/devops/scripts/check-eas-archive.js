#!/usr/bin/env node
/**
 * Comprueba en local qué archivos subiría `eas build` SIN subir nada ni lanzar ningún build.
 *
 * Usa el mismo código que eas-cli (GitClient.makeShallowCopyAsync de la instalación global
 * de eas-cli): clon superficial del repo + .easignore de la raíz + copia del directorio de
 * trabajo. El resultado queda en una carpeta temporal que se borra al terminar.
 *
 * Uso (desde cualquier carpeta del repo):
 *   node projects/healthy/devops/scripts/check-eas-archive.js [--list] [--keep]
 *
 * Sale con código 1 si en la copia aparece algo que no debería subirse (fuera de
 * projects/healthy/frontend, .git, .claude, .env, node_modules…).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = new Set(process.argv.slice(2));

function loadEasGitClient() {
  const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  const clientPath = path.join(globalRoot, 'eas-cli', 'build', 'vcs', 'clients', 'git.js');
  if (!fs.existsSync(clientPath)) {
    throw new Error(`No se encuentra eas-cli instalado globalmente (${clientPath})`);
  }
  return require(clientPath).default;
}

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push({ rel: path.relative(base, full).split(path.sep).join('/'), size: fs.statSync(full).size });
  }
  return out;
}

// Patrones que nunca deben llegar a EAS
const FORBIDDEN = [
  /^\.git(\/|$)/,
  /(^|\/)\.claude(\/|$)/,
  /(^|\/)\.env(\.|$)(?!example$)/,
  /(^|\/)node_modules\//,
  /(^|\/)CLAUDE(\..*)?\.md$/,
];
const ALLOWED_PREFIX = 'projects/healthy/frontend/';

async function main() {
  const GitClient = loadEasGitClient();
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'eas-archive-'));
  try {
    const client = new GitClient({ requireCommit: false });
    await client.makeShallowCopyAsync(dest);
    const files = walk(dest);
    const total = files.reduce((s, f) => s + f.size, 0);
    const bad = files.filter((f) => !f.rel.startsWith(ALLOWED_PREFIX) || FORBIDDEN.some((re) => re.test(f.rel)));

    console.log(`Archivos que se subirían: ${files.length} — ${(total / 1024 / 1024).toFixed(2)} MB (sin comprimir)`);
    if (args.has('--list')) files.forEach((f) => console.log(`  ${f.rel} (${f.size} B)`));
    if (bad.length) {
      console.error(`\n✖ ${bad.length} archivo(s) no deberían subirse:`);
      bad.slice(0, 50).forEach((f) => console.error(`  ${f.rel}`));
      process.exitCode = 1;
    } else {
      console.log('✔ Solo se sube projects/healthy/frontend (sin .git, .claude, .env ni node_modules)');
    }
  } finally {
    if (args.has('--keep')) console.log(`Copia conservada en ${dest}`);
    else fs.rmSync(dest, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
});
