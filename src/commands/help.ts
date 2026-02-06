import { CommandResponse } from '../types';

export async function helpCommand(): Promise<CommandResponse> {
  const helpText = `Movie Night Bot Commands:

/suggest <title> - Suggest a movie
/list - See all suggestions
/status - Time until poll
/help - This message

Use /suggest again to change your suggestion.`;

  return { text: helpText };
}
