import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';
import { handleMessage } from './commands';
import { createPollData } from './services/poll';
import { Config } from './types';

let sock: WASocket | null = null;
let groupJid: string | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const logger = pino({ level: 'warn' });

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function initBot(config: Config): Promise<WASocket> {
  groupJid = config.groupJid;

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const { version } = await fetchLatestBaileysVersion();

  console.log(`Using WA version: ${version.join('.')}`);

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    version,
    printQRInTerminal: false,
    logger,
    browser: ['Movie Night Bot', 'Chrome', '120.0.0'],
    syncFullHistory: false,
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

      if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delayMs = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delayMs / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        await delay(delayMs);
        initBot(config);
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
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue;

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

      const messageContent =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      if (!messageContent) continue;

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
