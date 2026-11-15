const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('auth storage warns once above 10 MiB, retries failed email, and rearms below the threshold', async (t) => {
  const originalLoad = Module._load;
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'movie-bot-storage-'));
  const warnings = [];
  const emails = [];
  let failEmail = false;
  Module._load = function (request, parent, isMain) {
    if (request === './alerts') return {
      async sendAuthStorageWarningEmail(recipient, bytes) {
        if (failEmail) throw new Error('mail unavailable');
        emails.push({ recipient, bytes });
      },
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
  t.mock.method(console, 'error', () => {});
  process.chdir(tempDir);
  t.after(() => {
    Module._load = originalLoad;
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  const { checkAuthStorage } = require('../dist/services/auth-storage.js');
  await checkAuthStorage('owner@example.com'); // Directory does not exist yet.
  fs.mkdirSync('auth_info');
  fs.writeFileSync('auth_info/session-test.json', 'small');
  await checkAuthStorage('owner@example.com');
  assert.equal(warnings.length, 0);

  fs.writeFileSync('auth_info/session-other.json', '');
  fs.truncateSync('auth_info/session-other.json', 5 * 1024 * 1024);
  fs.truncateSync('auth_info/session-test.json', 6 * 1024 * 1024);
  await Promise.all([checkAuthStorage('owner@example.com'), checkAuthStorage('owner@example.com')]);
  await checkAuthStorage('owner@example.com');
  assert.equal(emails.length, 1);
  assert.deepEqual(emails[0], { recipient: 'owner@example.com', bytes: 11 * 1024 * 1024 });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /auth_info.*11\.0 MiB/);

  fs.truncateSync('auth_info/session-test.json', 0);
  await checkAuthStorage('owner@example.com');
  fs.truncateSync('auth_info/session-test.json', 6 * 1024 * 1024);
  failEmail = true;
  await checkAuthStorage('owner@example.com');
  failEmail = false;
  await checkAuthStorage('owner@example.com');
  assert.equal(emails.length, 2, 'failed emails must be retried');

  fs.truncateSync('auth_info/session-test.json', 0);
  await checkAuthStorage();
  fs.truncateSync('auth_info/session-test.json', 6 * 1024 * 1024);
  await checkAuthStorage();
  await checkAuthStorage();
  assert.equal(emails.length, 2, 'email is optional');
  assert.equal(warnings.length, 4, 'log-only warnings must also be deduplicated');
});
