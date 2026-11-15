const assert = require('node:assert/strict');
const test = require('node:test');

const { store } = require('../dist/store.js');
const { createPollData } = require('../dist/services/poll.js');

test('includes each movie rating in the overview alongside its IMDb link', (t) => {
  t.mock.method(store, 'getAllSuggestions', () => [
    {
      movie: { title: 'Arrival', year: 2016, rating: 7.6, imdbUrl: 'https://www.imdb.com/title/tt2543164/' },
      suggestedBy: 'Gummy',
    },
    {
      movie: { title: 'Unrated Movie', year: 2026, rating: 0, imdbUrl: null },
      suggestedBy: 'Alex',
    },
  ]);

  const { introMessage, pollData } = createPollData();

  assert.ok(introMessage.includes('1. *Arrival* (2016) ⭐ 7.6 - suggested by Gummy'));
  assert.ok(introMessage.includes('https://www.imdb.com/title/tt2543164/'));
  assert.ok(introMessage.includes('2. *Unrated Movie* (2026) ⭐ 0 - suggested by Alex'));
  assert.deepEqual(pollData.values, ['Arrival (2016)', 'Unrated Movie (2026)']);
});
