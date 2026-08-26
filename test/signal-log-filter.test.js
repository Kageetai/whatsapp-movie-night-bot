const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

test('initBot suppresses Signal session dumps without hiding other logs', async (t) => {
  const originalLoad = Module._load;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const infoCalls = [];
  const warnCalls = [];

  console.info = (...args) => infoCalls.push(args);
  console.warn = (...args) => warnCalls.push(args);

  const fakeSocket = {
    ev: {
      on() {},
    },
    async sendMessage() {},
  };

  Module._load = function loadWithNoisyBaileys(request, parent, isMain) {
    if (request === '@whiskeysockets/baileys') {
      return {
        __esModule: true,
        default() {
          console.info('Opening session:', { privateKey: 'secret' });
          console.info('Closing session:', { privateKey: 'secret' });
          console.warn('Session already open');
          console.warn('Session already closed', { privateKey: 'secret' });
          console.info('Useful dependency information', 42);
          console.warn('Useful dependency warning', 43);
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

  const botModulePath = require.resolve('../dist/bot.js');
  t.after(() => {
    Module._load = originalLoad;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
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

  assert.deepEqual(infoCalls, [['Useful dependency information', 42]]);
  assert.deepEqual(warnCalls, [['Useful dependency warning', 43]]);
});
