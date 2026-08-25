const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

test('startup wires reminders and the offline alert recipient to WhatsApp', async (t) => {
  const originalLoad = Module._load;
  const originalApiKey = process.env.TMDB_API_KEY;
  const originalAlertEmailTo = process.env.ALERT_EMAIL_TO;
  let reminderCallback;
  let reminderChecks = 0;
  let remindersSent = 0;
  let botConfig;

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
        async initBot(config, onConnected) {
          botConfig = config;
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
  process.env.ALERT_EMAIL_TO = 'owner@example.com';
  const indexModulePath = require.resolve('../dist/index.js');
  t.after(() => {
    Module._load = originalLoad;
    delete require.cache[indexModulePath];
    if (originalApiKey === undefined) {
      delete process.env.TMDB_API_KEY;
    } else {
      process.env.TMDB_API_KEY = originalApiKey;
    }
    if (originalAlertEmailTo === undefined) {
      delete process.env.ALERT_EMAIL_TO;
    } else {
      process.env.ALERT_EMAIL_TO = originalAlertEmailTo;
    }
  });

  require(indexModulePath);
  await new Promise((resolve) => setImmediate(resolve));
  await reminderCallback?.();

  assert.equal(reminderChecks, 1);
  assert.equal(remindersSent, 1);
  assert.equal(botConfig.alertEmailTo, 'owner@example.com');
});
