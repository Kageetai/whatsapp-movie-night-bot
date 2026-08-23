const assert = require('node:assert/strict');
const test = require('node:test');

const { Scheduler } = require('../dist/services/scheduler.js');

function createEmptyReminderStore() {
  return {
    getSuggestionCount() {
      return 0;
    },
    wasReminderSentFor() {
      return false;
    },
    markReminderSentFor() {},
  };
}

function createScheduler(reminderStore = createEmptyReminderStore()) {
  return new Scheduler(
    {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      deadlineDay: 5,
      deadlineHour: 18,
    },
    reminderStore
  );
}

test('sends a reminder when an empty deadline is exactly 24 hours away', async () => {
  const scheduler = createScheduler();
  let remindersSent = 0;

  scheduler.onReminderTime?.(async () => {
    remindersSent += 1;
  });

  await scheduler.checkReminder?.(new Date(2026, 7, 27, 18, 0, 0));

  assert.equal(remindersSent, 1);
});

test('does not send a reminder more than 24 hours before the deadline', async () => {
  const scheduler = createScheduler();
  let remindersSent = 0;

  scheduler.onReminderTime?.(async () => {
    remindersSent += 1;
  });

  await scheduler.checkReminder?.(new Date(2026, 7, 27, 17, 59, 0));

  assert.equal(remindersSent, 0);
});

test('does not send a reminder when suggestions already exist', async () => {
  const reminderStore = createEmptyReminderStore();
  reminderStore.getSuggestionCount = () => 1;
  const scheduler = createScheduler(reminderStore);
  let remindersSent = 0;

  scheduler.onReminderTime?.(async () => {
    remindersSent += 1;
  });

  await scheduler.checkReminder?.(new Date(2026, 7, 27, 18, 0, 0));

  assert.equal(remindersSent, 0);
});

test('sends only one reminder for the same weekly deadline', async () => {
  let sentForDeadline = null;
  const reminderStore = {
    getSuggestionCount() {
      return 0;
    },
    wasReminderSentFor(deadline) {
      return sentForDeadline === deadline.toISOString();
    },
    markReminderSentFor(deadline) {
      sentForDeadline = deadline.toISOString();
    },
  };
  const scheduler = createScheduler(reminderStore);
  let remindersSent = 0;

  scheduler.onReminderTime?.(async () => {
    remindersSent += 1;
  });

  await scheduler.checkReminder?.(new Date(2026, 7, 27, 18, 0, 0));
  await scheduler.checkReminder?.(new Date(2026, 7, 27, 19, 0, 0));

  assert.equal(remindersSent, 1);
});

test('retries after a reminder send fails', async () => {
  const scheduler = createScheduler();
  let attempts = 0;

  scheduler.onReminderTime?.(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('WhatsApp unavailable');
    }
  });

  await assert.rejects(
    scheduler.checkReminder?.(new Date(2026, 7, 27, 18, 0, 0)),
    /WhatsApp unavailable/
  );
  await scheduler.checkReminder?.(new Date(2026, 7, 27, 18, 1, 0));

  assert.equal(attempts, 2);
});

test('coalesces simultaneous reminder checks into one send', async () => {
  const scheduler = createScheduler();
  let remindersSent = 0;
  let releaseSend;
  const sendCanFinish = new Promise((resolve) => {
    releaseSend = resolve;
  });

  scheduler.onReminderTime?.(async () => {
    remindersSent += 1;
    await sendCanFinish;
  });

  const now = new Date(2026, 7, 27, 18, 0, 0);
  const firstCheck = scheduler.checkReminder?.(now);
  await Promise.resolve();
  const secondCheck = scheduler.checkReminder?.(now);
  releaseSend();
  await Promise.all([firstCheck, secondCheck]);

  assert.equal(remindersSent, 1);
});

test('uses the configured timezone when it differs from the server timezone', async () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'UTC';

  try {
    const scheduler = new Scheduler(
      {
        timezone: 'Europe/Berlin',
        deadlineDay: 5,
        deadlineHour: 18,
      },
      createEmptyReminderStore()
    );
    let remindersSent = 0;
    scheduler.onReminderTime?.(async () => {
      remindersSent += 1;
    });

    await scheduler.checkReminder?.(
      new Date('2026-08-27T16:00:00.000Z')
    );

    assert.equal(remindersSent, 1);
  } finally {
    if (originalTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimezone;
    }
  }
});
