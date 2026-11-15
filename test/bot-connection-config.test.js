const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

test('initBot uses the installed Baileys protocol and skips history synchronization', async (t) => {
  const { jidNormalizedUser } = await import('@whiskeysockets/baileys');
  const originalLoad = Module._load;
  const creds = {};
  let fetchLatestVersionCalls = 0;
  let socketOptions;

  const fakeSocket = {
    ev: {
      on() {},
    },
    async sendMessage() {},
  };

  Module._load = function loadWithFakeBaileys(request, parent, isMain) {
    if (request === '@whiskeysockets/baileys') {
      return {
        __esModule: true,
        default(options) {
          socketOptions = options;
          return fakeSocket;
        },
        DisconnectReason: { loggedOut: 401 },
        jidNormalizedUser,
        async useMultiFileAuthState() {
          return {
            state: { creds, keys: {} },
            async saveCreds() {},
          };
        },
        async fetchLatestBaileysVersion() {
          fetchLatestVersionCalls += 1;
          return { version: [9, 9, 9] };
        },
        makeCacheableSignalKeyStore(keys) {
          return keys;
        },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  const botModulePath = require.resolve('../dist/bot.js');
  t.after(() => {
    Module._load = originalLoad;
    delete require.cache[botModulePath];
  });

  const { initBot } = require(botModulePath);
  await initBot({
    tmdbApiKey: 'test-key',
    groupJid: '123456789@g.us',
    deadlineTimezone: 'Europe/Berlin',
    deadlineDay: 5,
    deadlineHour: 18,
    port: 3000,
  });

  assert.equal(fetchLatestVersionCalls, 0, 'must not fetch a protocol version from Baileys master');
  assert.ok(socketOptions, 'must create a WhatsApp socket');
  assert.equal(
    Object.prototype.hasOwnProperty.call(socketOptions, 'version'),
    false,
    'must let the installed Baileys release select its matching protocol version'
  );
  assert.equal(
    socketOptions.shouldSyncHistoryMessage({}),
    false,
    'must not wait for history sync in a real-time command bot'
  );

  assert.equal(typeof socketOptions.shouldIgnoreJid, 'function');
  const ignore = socketOptions.shouldIgnoreJid;
  assert.equal(ignore('123456789@g.us'), false);
  assert.equal(ignore('987654321@g.us'), true);
  assert.equal(ignore('491111111111@s.whatsapp.net'), true);
  assert.equal(ignore('status@broadcast'), true);
  assert.equal(ignore('123@newsletter'), true);
  for (const jid of ['@s.whatsapp.net', 'server@c.us', '0@c.us']) {
    assert.equal(ignore(jid), false, `must preserve system traffic from ${jid}`);
  }

  // Pairing supplies the account identity after the socket has been created.
  creds.me = { id: '491234567890:7@s.whatsapp.net', lid: '100000000001:7@lid' };
  for (const jid of [
    '491234567890@s.whatsapp.net',
    '491234567890:2@s.whatsapp.net',
    '100000000001@lid',
    '100000000001:3@lid',
  ]) {
    assert.equal(ignore(jid), false, `must preserve own-device traffic from ${jid}`);
  }
  assert.equal(ignore('100000000002:3@lid'), true);
  assert.equal(ignore('491234567890@lid'), true, 'must distinguish identifier domains');

  await initBot({ groupJid: '' });
  assert.equal(socketOptions.shouldIgnoreJid('987654321@g.us'), false,
    'must allow group discovery when no group is configured');
});
