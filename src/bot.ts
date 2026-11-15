import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';
import { handleMessage } from './commands';
import { createPollData } from './services/poll';
import { Config } from './types';
import { store } from './store';
import { sendDeviceRemovedEmail } from './services/alerts';
import { suppressSignalSessionLogs } from './services/logging';

let sock: WASocket | null = null;
let groupJid: string | null = null;
let reconnectAttempts = 0;
let deviceRemovedAlertSent = false;
const MAX_RECONNECT_ATTEMPTS = 5;

const logger = pino({ level: 'warn' });

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function initBot(
  config: Config,
  onConnected?: () => Promise<void>
): Promise<WASocket> {
  suppressSignalSessionLogs();
  groupJid = config.groupJid;

  // Load persisted suggestions from storage
  store.load();

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger,
    browser: ['Movie Night Bot', 'Chrome', '120.0.0'],
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    shouldIgnoreJid: (jid) => {
      if (!config.groupJid || jid === config.groupJid ||
          ['@s.whatsapp.net', 'server@c.us', '0@c.us'].includes(jid)) {
        return false;
      }

      // Own-device sync must remain available, including after first-time pairing.
      const normalizedJid = jidNormalizedUser(jid);
      return ![state.creds.me?.id, state.creds.me?.lid].some(
        (ownJid) => ownJid && jidNormalizedUser(ownJid) === normalizedJid
      );
    },
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\nScan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(
        'Connection closed, status:',
        statusCode,
        ', reconnecting:',
        shouldReconnect
      );

      if (!shouldReconnect && !deviceRemovedAlertSent) {
        deviceRemovedAlertSent = true;
        console.error(
          [
            '',
            '============================================================',
            '🤖 MOVIE NIGHT BOT OFFLINE — WHATSAPP RE-PAIR REQUIRED',
            'WhatsApp removed the linked-device session (status 401).',
            'The bot cannot respond until auth_info is replaced and a new QR code is scanned.',
            '============================================================',
          ].join('\n')
        );

        if (!config.alertEmailTo) {
          console.error(
            'Email alert not sent: ALERT_EMAIL_TO is not configured.'
          );
        } else {
          try {
            await sendDeviceRemovedEmail(config.alertEmailTo);
            console.log(`Offline alert email sent to ${config.alertEmailTo}`);
          } catch (error) {
            console.error('Failed to send offline alert email:', error);
          }
        }
      }

      if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delayMs = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delayMs / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        await delay(delayMs);
        initBot(config, onConnected);
      } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnection attempts reached. Please restart the bot.');
      }
    } else if (connection === 'open') {
      reconnectAttempts = 0;
      console.log('Connected to WhatsApp!');
      if (groupJid) {
        console.log(`Listening to group: ${groupJid}`);
      } else {
        console.log(
          'No GROUP_JID configured. Bot will log group IDs when messages are received.'
        );
      }

      if (onConnected) {
        try {
          await onConnected();
        } catch (error) {
          console.error('Failed to check suggestion reminder:', error);
        }
      }
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    for (const msg of m.messages) {
      if (!msg.message) continue;

      const messageContent =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      if (!messageContent) continue;

      // Commands sent from the linked WhatsApp account should be handled too,
      // while ordinary self-sent messages and bot responses remain ignored.
      if (msg.key.fromMe && !messageContent.trim().startsWith('/')) continue;

      const remoteJid = msg.key.remoteJid;
      if (!remoteJid) continue;

      if (remoteJid.endsWith('@g.us')) {
        if (!groupJid) {
          console.log(`Group message from: ${remoteJid}`);
          console.log('Set GROUP_JID in .env to this value to enable the bot for this group');
        }

        if (groupJid && remoteJid !== groupJid) {
          continue;
        }
      } else {
        continue;
      }

      const senderJid = msg.key.participant || msg.key.remoteJid || '';
      const senderName = msg.pushName || 'Unknown';

      console.log(`[${senderName}]: ${messageContent}`);

      try {
        const response = await handleMessage(messageContent, senderJid, senderName);

        if (response) {
          if (response.imageUrl) {
            await sendImageWithCaption(remoteJid, response.imageUrl, response.text);
          } else {
            await sendMessage(remoteJid, response.text);
          }
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    }
  });

  return sock;
}

export async function sendMessage(jid: string, text: string): Promise<void> {
  if (!sock) {
    throw new Error('Bot not initialized');
  }

  await sock.sendMessage(jid, { text });
}

export async function sendImageWithCaption(
  jid: string,
  imageUrl: string,
  caption: string
): Promise<void> {
  if (!sock) {
    throw new Error('Bot not initialized');
  }

  try {
    await sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption,
    });
  } catch (error) {
    console.error('Failed to send image, sending text only:', error);
    await sendMessage(jid, caption);
  }
}

export async function sendSuggestionReminder(): Promise<void> {
  if (!groupJid) {
    throw new Error('No GROUP_JID configured, cannot send suggestion reminder');
  }

  await sendMessage(
    groupJid,
    '🎬 Reminder: There are still no movie suggestions, and the deadline is within 24 hours. Use /suggest <movie title> to add one!'
  );
}

export async function sendPoll(): Promise<void> {
  if (!sock) {
    throw new Error('Bot not initialized');
  }

  if (!groupJid) {
    console.error('No GROUP_JID configured, cannot send poll');
    return;
  }

  const pollData = createPollData();

  if (!pollData) {
    await sendMessage(
      groupJid,
      'No movie suggestions this week! Use /suggest <movie title> to add suggestions for next week.'
    );
    return;
  }

  await sendMessage(groupJid, pollData.introMessage);

  await sock.sendMessage(groupJid, {
    poll: {
      name: pollData.pollData.name,
      values: pollData.pollData.values,
      selectableCount: pollData.pollData.selectableCount,
    },
  });

  console.log('Poll sent to group');
}

export function getSocket(): WASocket | null {
  return sock;
}

export function getGroupJid(): string | null {
  return groupJid;
}
