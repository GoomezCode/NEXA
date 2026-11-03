import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const voiceDir = resolve(root, 'voice-server');
const python = process.platform === 'win32'
  ? resolve(voiceDir, '.venv', 'Scripts', 'python.exe')
  : resolve(voiceDir, '.venv', 'bin', 'python');
const pythonCommand = existsSync(python) ? python : (process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'));
const voiceDependencies = spawnSync(pythonCommand, ['-c', 'import fastapi, uvicorn, faster_whisper, av'], { cwd: voiceDir, stdio: 'ignore' });
if (voiceDependencies.error || voiceDependencies.status !== 0) {
  console.error('Dependências do serviço de voz ausentes. Execute `npm run voice:setup` uma vez e tente novamente.');
  process.exit(1);
}
const children = [];
let stopping = false;

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  const forceTimer = setTimeout(() => {
    for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
  }, 3000);
  forceTimer.unref();
  setTimeout(() => process.exit(code), 3200).unref();
}

function launch(label, command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env });
  children.push(child);
  child.on('error', (error) => {
    console.error(`[${label}] não foi possível iniciar: ${error.message}`);
    stopAll(1);
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    if (code !== 0) console.error(`[${label}] encerrou (código ${code ?? signal}).`);
    stopAll(code ?? 1);
  });
  return child;
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

console.log('Iniciando NEXA Web e serviço local de voz…');
launch('voice-server', pythonCommand, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8765'], voiceDir);
launch('vite', process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js')], root);
