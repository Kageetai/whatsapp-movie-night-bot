import { CommandResponse } from '../types';
import { helpCommand } from './help';
import { statusCommand } from './status';
import { listCommand } from './list';
import { suggestCommand, handleConfirmation } from './suggest';

const COMMAND_PREFIX = '!';

export interface ParsedCommand {
  command: string;
  args: string;
}

export function parseCommand(message: string): ParsedCommand | null {
  const trimmed = message.trim();

  if (!trimmed.startsWith(COMMAND_PREFIX)) {
    return null;
  }

  const withoutPrefix = trimmed.slice(COMMAND_PREFIX.length);
  const spaceIndex = withoutPrefix.indexOf(' ');

  if (spaceIndex === -1) {
    return {
      command: withoutPrefix.toLowerCase(),
      args: '',
    };
  }

  return {
    command: withoutPrefix.slice(0, spaceIndex).toLowerCase(),
    args: withoutPrefix.slice(spaceIndex + 1).trim(),
  };
}

export function isConfirmation(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return normalized === 'yes' || normalized === 'y' || normalized === 'ja';
}

export async function handleMessage(
  message: string,
  senderJid: string,
  senderName: string
): Promise<CommandResponse | null> {
  if (isConfirmation(message)) {
    return handleConfirmation(senderJid, senderName);
  }

  const parsed = parseCommand(message);
  if (!parsed) {
    return null;
  }

  switch (parsed.command) {
    case 'help':
      return helpCommand();

    case 'status':
      return statusCommand();

    case 'list':
      return listCommand();

    case 'suggest':
      return suggestCommand(parsed.args, senderJid, senderName);

    default:
      return null;
  }
}
