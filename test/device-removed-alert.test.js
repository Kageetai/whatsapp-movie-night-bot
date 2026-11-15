const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('a removed WhatsApp device logs a re-pair warning and emails once', async (t) => {
  const originalLoad = Module._load;
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;
  const originalSendmailPath = process.env.SENDMAIL_PATH;
  const originalOutputPath = process.env.FAKE_SENDMAIL_OUTPUT;
  const handlers = {};
  const logLines = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'movie-bot-alert-'));
  const sendmailPath = path.join(tempDir, 'sendmail');
  const outputPath = path.join(tempDir, 'mail.txt');

  fs.writeFileSync(
    sendmailPath,
    `#!/usr/bin/env node
const fs = require('node:fs');
let message = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { message += chunk; });
process.stdin.on('end', () => {
  fs.appendFileSync(process.env.FAKE_SENDMAIL_OUTPUT, message + '\\n---MESSAGE-END---\\n');
});
`
  );
  fs.chmodSync(sendmailPath, 0o755);
  process.env.SENDMAIL_PATH = sendmailPath;
  process.env.FAKE_SENDMAIL_OUTPUT = outputPath;

  const fakeSocket = {
    ev: {
      on(event, handler) {
        handlers[event] = handler;
      },
    },
    async sendMessage() {},
  };

  Module._load = function loadWithFakeBaileys(request, parent, isMain) {
    if (request === '@whiskeysockets/baileys') {
      return {
        __esModule: true,
        default() {
          return fakeSocket;
        },
        DisconnectReason: { loggedOut: 401 },
        async useMultiFileAuthState() {
          return {
            state: { creds: {}, keys: {} },
            async saveCreds() {},
          };
        },
        makeCacheableSignalKeyStore(keys) {
          return keys;
        },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  console.error = (...args) => logLines.push(args.join(' '));
  console.log = (...args) => logLines.push(args.join(' '));

  const botModulePath = require.resolve('../dist/bot.js');
  t.after(() => {
    Module._load = originalLoad;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    delete require.cache[botModulePath];
    fs.rmSync(tempDir, { recursive: true, force: true });

    if (originalSendmailPath === undefined) delete process.env.SENDMAIL_PATH;
    else process.env.SENDMAIL_PATH = originalSendmailPath;

    if (originalOutputPath === undefined) delete process.env.FAKE_SENDMAIL_OUTPUT;
    else process.env.FAKE_SENDMAIL_OUTPUT = originalOutputPath;
  });

  const { initBot } = require(botModulePath);
  await initBot({
    tmdbApiKey: 'test-key',
    groupJid: '123456789@g.us',
    deadlineTimezone: 'Europe/Berlin',
    deadlineDay: 5,
    deadlineHour: 18,
    port: 3000,
    alertEmailTo: 'owner@example.com',
  });

  const removedDeviceUpdate = {
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode: 401 } } },
  };
  await handlers['connection.update'](removedDeviceUpdate);
  await handlers['connection.update'](removedDeviceUpdate);

  const logs = logLines.join('\n');
  assert.match(logs, /MOVIE NIGHT BOT OFFLINE/);
  assert.match(logs, /RE-PAIR REQUIRED/);

  assert.equal(fs.existsSync(outputPath), true, 'the alert email should be delivered to sendmail');
  const email = fs.readFileSync(outputPath, 'utf8');
  assert.match(email, /^To: owner@example\.com$/m);
  assert.match(email, /^Subject: \[Movie Night Bot\] WhatsApp re-pair required$/m);
  assert.match(email, /automated alert from the Movie Night Bot/i);
  assert.equal((email.match(/---MESSAGE-END---/g) || []).length, 1);

  const { sendAuthStorageWarningEmail } = require('../dist/services/alerts.js');
  await sendAuthStorageWarningEmail('owner@example.com', 11 * 1024 * 1024);
  const storageEmail = fs.readFileSync(outputPath, 'utf8');
  assert.match(storageEmail, /^Subject: \[Movie Night Bot\] WhatsApp auth storage warning$/m);
  assert.match(storageEmail, /auth_info uses 11\.0 MiB of disk space/);
  assert.match(storageEmail, /No files have been deleted/);
});
