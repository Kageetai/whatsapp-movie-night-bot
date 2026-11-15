import { readdir, stat } from 'node:fs/promises';
import { sendAuthStorageWarningEmail } from './alerts';

const WARNING_BYTES = 10 * 1024 * 1024;
let warned = false;
let checking = false;

export async function checkAuthStorage(recipient?: string): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    let bytes = 0;
    const entries = await readdir('./auth_info', { withFileTypes: true }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      try {
        bytes += (await stat(`./auth_info/${entry.name}`)).size;
      } catch (error) {
        // Baileys can remove a key while the directory is being scanned.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
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
