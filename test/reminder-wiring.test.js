const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

test('startup wires scheduled and reconnect reminder checks to WhatsApp', async (t) => {
  const originalLoad = Module._load;
  const originalApiKey = process.env.TMDB_API_KEY;
  let reminderCallback;
  let reminderChecks = 0;
  let remindersSent = 0;

  const fakeScheduler = {
    onPollTime() {},
    onReminderTime(callback) {
      reminderCallback = callback;
    },
    async checkReminder() {
      reminderChecks += 1;
    },
    start() {},
    getDeadlineString() {
      return 'Friday 18:00 CET';
    },
    getTimeUntilDeadline() {
      return '1d';
    },
  };

  Module._load = function loadWithFakes(request, parent, isMain) {
    if (request === './bot') {
      return {
        async initBot(_config, onConnected) {
          await onConnected?.();
          return {};
        },
        async sendPoll() {},
        async sendSuggestionReminder() {
          remindersSent += 1;
        },
      };
    }
    if (request === './services/tmdb') {
      return { initTMDB() {} };
    }
    if (request === './services/scheduler') {
      return { initScheduler: () => fakeScheduler };
    }
    if (request === './server') {
      return { createServer() {} };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  process.env.TMDB_API_KEY = 'test-key';
  const indexModulePath = require.resolve('../dist/index.js');
  t.after(() => {
    Module._load = originalLoad;
    delete require.cache[indexModulePath];
    if (originalApiKey === undefined) {
      delete process.env.TMDB_API_KEY;
    } else {
      process.env.TMDB_API_KEY = originalApiKey;
    }
  });

  require(indexModulePath);
  await new Promise((resolve) => setImmediate(resolve));
  await reminderCallback?.();

  assert.equal(reminderChecks, 1);
  assert.equal(remindersSent, 1);
});
