import { CommandResponse } from '../types';
import { formatSuggestionsList } from '../services/poll';
import { getScheduler } from '../services/scheduler';
import { store } from '../store';

export async function listCommand(): Promise<CommandResponse> {
  const list = formatSuggestionsList();
  const scheduler = getScheduler();

  let text = list;

  if (store.getSuggestionCount() > 0 && !store.isLocked()) {
    const timeRemaining = scheduler.getTimeUntilDeadline();
    text += `\n\nPoll in ${timeRemaining}`;
  }

  return { text };
}
