import { CommandResponse } from '../types';
import { getScheduler } from '../services/scheduler';
import { store } from '../store';

export async function statusCommand(): Promise<CommandResponse> {
  const scheduler = getScheduler();
  const deadline = scheduler.getDeadlineString();
  const timeRemaining = scheduler.getTimeUntilDeadline();
  const suggestionCount = store.getSuggestionCount();
  const isLocked = store.isLocked();

  let statusText = `Deadline: ${deadline}
Time remaining: ${timeRemaining}
Suggestions so far: ${suggestionCount}`;

  if (isLocked) {
    statusText += '\n\nSuggestions are currently locked. They will reopen Saturday at midnight.';
  }

  return { text: statusText };
}
