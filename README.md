# WhatsApp Movie Night Bot

A WhatsApp bot for weekly Friday movie nights. Collects movie suggestions throughout the week, looks them up via TMDB, and creates a poll at noon on Fridays.

## Features

- **/suggest \<movie\>** - Suggest a movie (auto-searches TMDB)
- **/list** - View current suggestions
- **/status** - Check time until the poll
- **/help** - Show available commands
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
4. At Friday 12:00 CET, the bot posts a poll with all suggestions
5. Suggestions reset automatically on Saturday at midnight

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check (for keep-alive) |
| `GET /status` | Bot status and next deadline |
| `GET /trigger-poll` | Manually trigger the poll |

## Session Persistence

The WhatsApp session is stored in `auth_info/`. On Render's free tier, this directory is ephemeral. You'll need to re-scan the QR code after each deploy.

For persistent sessions, consider:
- Render's paid tier with persistent disk
- Storing auth state in a database
- Using environment variables (encoded)

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
