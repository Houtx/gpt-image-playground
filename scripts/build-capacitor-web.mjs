import { cpSync, existsSync, rmSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const apiDir = resolve(root, 'src/app/api');
const backupDir = resolve(root, '.next-capacitor-api-backup');

function restoreApiDir() {
  if (existsSync(backupDir)) {
    if (existsSync(apiDir)) {
      rmSync(apiDir, { recursive: true, force: true });
    }
    renameSync(backupDir, apiDir);
  }
}

try {
  if (existsSync(backupDir)) {
    restoreApiDir();
  }

  if (existsSync(apiDir)) {
    cpSync(apiDir, backupDir, { recursive: true });
    rmSync(apiDir, { recursive: true, force: true });
  }

  const result = spawnSync('npx', ['next', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      CAPACITOR_BUILD: '1',
      NEXT_PUBLIC_APP_RUNTIME: 'capacitor',
      NEXT_PUBLIC_IMAGE_STORAGE_MODE: 'indexeddb'
    }
  });

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
} finally {
  restoreApiDir();
}
