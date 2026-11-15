# WhatsApp Movie Night Bot

A WhatsApp bot for weekly Friday movie nights. Collects movie suggestions throughout the week, looks them up via TMDB, and creates a poll at noon on Fridays.

## Features

- **/suggest \<movie\>** - Suggest a movie (auto-searches TMDB)
- **/list** - View current suggestions
- **/status** - Check time until the poll
- **/help** - Show available commands
- One automatic reminder when no movies have been suggested within 24 hours of the deadline
- Automatic poll creation every Friday at 12:00 CET
- Movie details include title, year, rating, description, poster, and IMDB link

## Prerequisites

- Node.js 20+
- A TMDB API key (free at [themoviedb.org](https://www.themoviedb.org/settings/api))
- A WhatsApp account (the bot runs as a linked device)

## Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <your-repo-url>
   cd whatsapp-movie-night-bot
   npm install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your values:

   ```bash
   TMDB_API_KEY=your_tmdb_api_key
   GROUP_JID=                           # Leave empty initially
   ALERT_EMAIL_TO=you@example.com       # WhatsApp re-pairing and storage alerts
   DEADLINE_TIMEZONE=Europe/Berlin
   DEADLINE_DAY=5                       # 0=Sunday, 5=Friday
   DEADLINE_HOUR=12
   PORT=3000
   ```

3. **Run the bot:**

   ```bash
   npm run dev
   ```

4. **Scan the QR code** with WhatsApp (Link a device > Link with QR code)

5. **Get your Group JID:**
   - Send any message in your movie night group
   - The bot will log the group JID
   - Copy it to your `.env` file and restart

## Commands

| Command | Description |
|---------|-------------|
| `/suggest <title>` | Search for a movie and suggest it |
| `/list` | Show all current suggestions |
| `/status` | Show deadline and time remaining |
| `/help` | Show help message |

After suggesting a movie, reply **"yes"** to confirm your selection.

## How It Works

1. Users suggest movies throughout the week using `/suggest`
2. The bot searches TMDB and shows the best match
3. Users confirm their suggestion by replying "yes"
4. If there are still no suggestions within 24 hours of the deadline, the bot sends one reminder
5. At Friday 12:00 CET, the bot posts a poll with all suggestions
6. Suggestions reset automatically on Saturday at midnight

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check (for keep-alive) |
| `GET /status` | Bot status and next deadline |
| `GET /trigger-poll` | Manually trigger the poll |

## Session Persistence

The WhatsApp session is stored in `auth_info/`. On Render's free tier, this directory is ephemeral. You'll need to re-scan the QR code after each deploy.

When `GROUP_JID` is configured, unrelated incoming chats are ignored before decryption. The configured group, the linked account's own devices, and WhatsApp system traffic remain enabled. Without `GROUP_JID`, filtering stays disabled for group discovery. This reduces new encryption-session files from unrelated chats; it does not remove existing files or cap authentication storage. Check usage with `du -sh auth_info`; do not delete session files by age.

At startup and hourly, the bot checks allocated disk usage in `auth_info/` using the server's `du -sk` command. At 10 MiB or more it logs a warning and emails `ALERT_EMAIL_TO` when configured. It alerts once until usage drops below the threshold, or the process restarts; failed emails are retried on the next check. This uses the same allocation measurement as `du -sh auth_info`, with different display rounding. The server must provide `du` on the bot's PATH. No files are deleted automatically.

File content size counts the bytes inside files; disk usage counts the filesystem blocks allocated to them, plus directory storage. For example, on a filesystem with 4 KiB blocks, a 950-byte file typically occupies 4 KiB. Thousands of small encryption-key files can therefore contain about 1 MiB of data while using about 8 MiB of disk space. Sparse files demonstrate the reverse: their logical size can exceed the blocks actually allocated. The warning measures allocated space, rather than logical size or remaining account quota.

If WhatsApp removes the linked-device session, the bot prints a prominent
re-pairing warning and sends one email per running process to `ALERT_EMAIL_TO`.
Email is delivered through the server's local `sendmail` installation and no
message is sent to the WhatsApp group. Set `ALERT_EMAIL_FROM` only if you need
to override the default local sender address.

For persistent sessions, consider:
- Render's paid tier with persistent disk
- Storing auth state in a database
- Using environment variables (encoded)

### Responding to an auth storage warning

10 MiB is an investigation threshold, not evidence that the session is broken or the server is running out of space. There is no safe age-based cleanup: an old session file may still be needed to decrypt messages.

1. From the project directory on the server, check disk usage, free space, and file count:

   ```sh
   du -sh auth_info
   df -h .
   find auth_info -maxdepth 1 -type f | wc -l
   ```

   On Linux, inspect the largest files without reading their contents:

   ```sh
   find auth_info -maxdepth 1 -type f -printf '%s %f\n' | sort -nr | head -20
   ```

2. Confirm `GROUP_JID` is set to the movie-night group and the deployed bot includes the chat filter. Restart after changing configuration. The filter reduces future session creation from unrelated chats; it does not remove sessions already stored.

3. Record the size and count, then compare them the following day. If storage is stable and free space is sufficient, leave the files alone. If it keeps growing quickly, inspect bot logs for repeated connection/decryption errors and investigate the deployed Baileys version and account traffic before changing the threshold. Do not merely raise the threshold to hide unexplained growth.

   The warning does not send periodic reminders while usage remains above 10 MiB. Follow up after the first alert; another alert occurs only after usage falls below the threshold and crosses it again, or after a process restart.

4. For selective cleanup, group-specific `sender-key-` filenames can identify keys belonging to other groups or status broadcasts. Only quarantine files positively identified as outside the configured group, with the bot stopped. Keep the configured group's sender keys and sender-key memory, shared `session-` files, pre-keys, account credentials, and app-state files. Do not assume a shared session is unused because its identifier is unfamiliar or its timestamp is old. Move candidates into a private directory outside `auth_info`, record the filenames for rollback, then restart the bot and verify group commands and a poll. Moving files on the same filesystem reduces `auth_info` usage but does not free account disk space until the quarantine is deleted. Keep the backup until verification is complete; restore it with the bot stopped if needed. Never put quarantine directories inside `auth_info`, because they would still count toward the warning.

5. If a fresh linked-device session is needed, plan a short outage with access to the account's phone. Stop the bot through its existing process manager, rename `auth_info` to an unused backup name, restart the bot, and scan the new QR code. For example, **only while the bot is stopped**, and after confirming the destination does not exist:

   ```sh
   mv auth_info auth_info.before-reset
   ```

   Verify the bot reconnects and responds to `/status` in the configured group. The backup still consumes disk space; remove it only after the new session works and you no longer need the old state. Re-pairing can recreate some files, and the bot may miss commands during the outage. Never run two bot processes against the same auth directory.

Treat `auth_info` and its backups as credentials: keep them private, out of Git, and out of public logs. A reset is a recovery option, not routine maintenance or a guaranteed fix for continuing growth.

## Development

```bash
npm run dev     # Run with ts-node
npm run build   # Compile TypeScript
npm start       # Run compiled JS
npm run lint    # Run ESLint
```

## Tech Stack

- **Runtime:** Node.js 20+ with TypeScript
- **WhatsApp:** [Baileys](https://github.com/WhiskeySockets/Baileys)
- **Movie API:** [TMDB](https://www.themoviedb.org/)
- **Scheduling:** node-cron
- **Server:** Express (health checks)

## License

MIT
