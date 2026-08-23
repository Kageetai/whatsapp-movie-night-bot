const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const storeModule = require('../dist/store.js');

test('persists the deadline for which a reminder was sent', (t) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'movie-night-reminder-')
  );
  const dataFile = path.join(temporaryDirectory, 'suggestions.json');
  t.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));

  const SuggestionStore = storeModule.SuggestionStore;
  let reminderWasPersisted = false;

  if (typeof SuggestionStore === 'function') {
    const deadline = new Date('2026-08-28T16:00:00.000Z');
    const firstStore = new SuggestionStore(dataFile);
    firstStore.markReminderSentFor?.(deadline);

    const reloadedStore = new SuggestionStore(dataFile);
    reloadedStore.load();
    reminderWasPersisted =
      reloadedStore.wasReminderSentFor?.(deadline) === true;
  }

  assert.equal(reminderWasPersisted, true);
});

test('weekly reset allows a reminder for the next cycle', (t) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'movie-night-reminder-reset-')
  );
  const dataFile = path.join(temporaryDirectory, 'suggestions.json');
  t.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));

  const deadline = new Date('2026-08-28T16:00:00.000Z');
  const suggestionStore = new storeModule.SuggestionStore(dataFile);
  suggestionStore.markReminderSentFor(deadline);

  suggestionStore.reset();

  assert.equal(suggestionStore.wasReminderSentFor(deadline), false);
});
