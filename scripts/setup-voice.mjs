import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const windows = process.platform === 'win32';
const pythonCommand = process.env.PYTHON || (windows ? 'python' : 'python3');
const createArgs = windows
  ? ['-m', 'venv', resolve('voice-server', '.venv')]
  : ['-m', 'venv', resolve('voice-server', '.venv')];
const created = spawnSync(pythonCommand, createArgs, { stdio: 'inherit' });
if (created.error || created.status !== 0) {
  console.error(`Não consegui criar o ambiente Python com ${pythonCommand}. Instale Python 3 e tente novamente.`);
  process.exit(created.status || 1);
}
const venvPython = windows
  ? resolve('voice-server', '.venv', 'Scripts', 'python.exe')
  : resolve('voice-server', '.venv', 'bin', 'python');
const installed = spawnSync(venvPython, ['-m', 'pip', 'install', '-r', resolve('voice-server', 'requirements.txt')], { stdio: 'inherit' });
if (installed.error || installed.status !== 0) process.exit(installed.status || 1);
console.log('Dependências instaladas. O voice-server agora inicia automaticamente com npm run dev.');
