const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

function loadBotWithFakeBaileys(t) {
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

  return {
    bot: require(botModulePath),
    eventHandlers,
    sentMessages,
  };
}

test('sends the suggestion reminder to the configured group', async (t) => {
  const { bot, sentMessages } = loadBotWithFakeBaileys(t);
  await bot.initBot({
    tmdbApiKey: 'test-key',
    groupJid: '123456789@g.us',
    deadlineTimezone: 'Europe/Berlin',
    deadlineDay: 5,
    deadlineHour: 18,
    port: 3000,
  });

  await bot.sendSuggestionReminder?.();

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].jid, '123456789@g.us');
  assert.match(sentMessages[0].content.text, /\/suggest <movie title>/);
});

test('checks for a missed reminder when WhatsApp connects', async (t) => {
  const { bot, eventHandlers } = loadBotWithFakeBaileys(t);
  let reminderChecks = 0;

  await bot.initBot(
    {
      tmdbApiKey: 'test-key',
      groupJid: '123456789@g.us',
      deadlineTimezone: 'Europe/Berlin',
      deadlineDay: 5,
      deadlineHour: 18,
      port: 3000,
    },
    async () => {
      reminderChecks += 1;
    }
  );

  const handleConnectionUpdate = eventHandlers.get('connection.update');
  await handleConnectionUpdate?.({ connection: 'open' });

  assert.equal(reminderChecks, 1);
});
