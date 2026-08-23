const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

test('initBot uses the installed Baileys protocol and skips history synchronization', async (t) => {
  const originalLoad = Module._load;
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
        async useMultiFileAuthState() {
          return {
            state: { creds: {}, keys: {} },
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
});
