import 'dotenv/config';
import { Config } from './types';
import { initBot, sendPoll } from './bot';
import { initTMDB } from './services/tmdb';
import { initScheduler } from './services/scheduler';
import { createServer } from './server';

function loadConfig(): Config {
  const tmdbApiKey = process.env.TMDB_API_KEY;
  if (!tmdbApiKey) {
    console.error('TMDB_API_KEY is required. Get one at https://www.themoviedb.org/settings/api');
    process.exit(1);
  }

  return {
    tmdbApiKey,
    groupJid: process.env.GROUP_JID || '',
    deadlineTimezone: process.env.DEADLINE_TIMEZONE || 'Europe/Berlin',
    deadlineDay: parseInt(process.env.DEADLINE_DAY || '5', 10),
    deadlineHour: parseInt(process.env.DEADLINE_HOUR || '12', 10),
    port: parseInt(process.env.PORT || '3000', 10),
  };
}

async function main(): Promise<void> {
  console.log('Starting WhatsApp Movie Night Bot...\n');

  const config = loadConfig();

  initTMDB(config.tmdbApiKey);
  console.log('TMDB service initialized');

  const scheduler = initScheduler({
    timezone: config.deadlineTimezone,
    deadlineDay: config.deadlineDay,
    deadlineHour: config.deadlineHour,
  });

  scheduler.onPollTime(async () => {
    console.log('Sending poll...');
    await sendPoll();
  });

  scheduler.start();
  console.log(`Next deadline: ${scheduler.getDeadlineString()}`);
  console.log(`Time remaining: ${scheduler.getTimeUntilDeadline()}`);

  createServer(config.port);

  await initBot(config);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
