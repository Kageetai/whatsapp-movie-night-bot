import { spawn } from 'node:child_process';
import { hostname, userInfo } from 'node:os';

function validateHeaderValue(name: string, value: string): void {
  if (!value || /[\r\n]/.test(value)) {
    throw new Error(`${name} must be a non-empty single-line value`);
  }
}

function buildDeviceRemovedEmail(recipient: string): string {
  const sender =
    process.env.ALERT_EMAIL_FROM ||
    `${userInfo().username}@${hostname()}`;

  validateHeaderValue('ALERT_EMAIL_TO', recipient);
  validateHeaderValue('ALERT_EMAIL_FROM', sender);

  return [
    `To: ${recipient}`,
    `From: Movie Night Bot <${sender}>`,
    'Subject: [Movie Night Bot] WhatsApp re-pair required',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    'This is an automated alert from the Movie Night Bot.',
    '',
    'WhatsApp removed the bot\'s linked-device session, so the bot is offline',
    'and cannot respond to group messages. Re-pair it by scanning a new QR code.',
    '',
    `Detected at: ${new Date().toISOString()}`,
    '',
  ].join('\n');
}

export function sendDeviceRemovedEmail(recipient: string): Promise<void> {
  const sendmailPath = process.env.SENDMAIL_PATH || '/usr/sbin/sendmail';
  const message = buildDeviceRemovedEmail(recipient);

  return new Promise((resolve, reject) => {
    const sendmail = spawn(sendmailPath, ['-t', '-oi']);
    let stderr = '';

    sendmail.stderr.setEncoding('utf8');
    sendmail.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    sendmail.on('error', reject);
    sendmail.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `sendmail exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`
          )
        );
      }
    });

    sendmail.stdin.end(message);
  });
}
