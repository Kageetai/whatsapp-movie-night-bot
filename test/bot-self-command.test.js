const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

test('bot handles slash commands sent from its own WhatsApp account', async (t) => {
  const originalLoad = Module._load;
  const eventHandlers = new Map();
  const sentMessages = [];

  const fakeSocket = {
    ev: {
      on(eventName, handler) {
        eventHandlers.set(eventName, handler);
      },
    },
    async sendMessage(jid, content) {
      sentMessages.push({ jid, content });
    },
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

  const handleMessagesUpsert = eventHandlers.get('messages.upsert');
  assert.equal(typeof handleMessagesUpsert, 'function');

  await handleMessagesUpsert({
    messages: [
      {
        key: {
          fromMe: true,
          remoteJid: '123456789@g.us',
          participant: 'owner@s.whatsapp.net',
        },
        message: { conversation: '/help' },
        pushName: 'Owner',
      },
    ],
  });

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].jid, '123456789@g.us');
  assert.match(sentMessages[0].content.text, /\/status/);
});
