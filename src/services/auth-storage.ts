import { stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sendAuthStorageWarningEmail } from './alerts';

const WARNING_BYTES = 10 * 1024 * 1024;
const runFile = promisify(execFile);
let warned = false;
let checking = false;

export async function checkAuthStorage(recipient?: string): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    try {
      await stat('./auth_info');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      warned = false;
      return;
    }
    const { stdout } = await runFile('du', ['-sk', './auth_info']);
    const match = /^(\d+)\s/.exec(stdout);
    if (!match) throw new Error('Unexpected du output');
    const bytes = Number(match[1]) * 1024;
    if (bytes < WARNING_BYTES) {
      warned = false;
      return;
    }
    if (warned) return;
    console.warn(`auth_info storage warning: ${(bytes / 1024 / 1024).toFixed(1)} MiB (threshold: 10 MiB). No files deleted.`);
    if (recipient) await sendAuthStorageWarningEmail(recipient, bytes);
    warned = true;
  } catch (error) {
    console.error('Failed to check auth storage or send warning:', error);
  } finally {
    checking = false;
  }
}

export function startAuthStorageMonitor(recipient?: string): void {
  void checkAuthStorage(recipient);
  setInterval(() => { void checkAuthStorage(recipient); }, 60 * 60 * 1000).unref();
}
