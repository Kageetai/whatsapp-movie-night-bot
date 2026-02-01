# WhatsApp Movie Night Bot - Implementation Plan

## Overview
A WhatsApp bot for weekly Friday movie night that collects movie suggestions, looks them up via TMDB, and creates a poll at noon (12:00 CET) on Fridays.

---

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Runtime | **Node.js 20+** with **TypeScript** | Modern, type-safe |
| WhatsApp | **[Baileys](https://github.com/WhiskeySockets/Baileys)** | WebSocket-based, lightweight, native poll support |
| Movie API | **[TMDB](https://developer.themoviedb.org/docs)** | Free for non-commercial, comprehensive data, IMDB links |
| Hosting | **[Render](https://render.com)** (free tier) | Free, auto-deploy from GitHub |
| Scheduling | **[cron-job.org](https://cron-job.org)** | Free cron for keep-alive pings + Friday poll trigger |

---

## Configuration (from user input)

- **Deadline**: Friday 12:00 noon
- **Timezone**: Europe/Berlin (CET/CEST)
- **Bot account**: Personal WhatsApp number (bot runs as linked device, like WhatsApp Web)
- **Movie search**: Auto-select best match, but ask user to confirm selection

---

## Core Features

### 1. Movie Suggestion (`!suggest <movie title>`)
```
User: !suggest inception
Bot: 🎬 Found: *Inception* (2010) ⭐ 8.4
     A thief who steals corporate secrets through dream-sharing...
     [poster image]

     Reply "yes" to confirm or "!suggest <different movie>" to try again.
```
- Searches TMDB for best match
- Shows title, year, rating, brief description, poster
- Waits for user confirmation before saving
- One suggestion per person (new suggestion replaces old)

### 2. List Suggestions (`!list`)
```
Bot: 🎬 Current suggestions (3/10):
     1. Inception (2010) - suggested by Michael
     2. The Matrix (1999) - suggested by Anna
     3. Interstellar (2014) - suggested by Tom

     ⏰ Poll closes in 2h 15m
```

### 3. Status (`!status`)
```
Bot: ⏰ Deadline: Friday 12:00 CET
     Time remaining: 1d 14h 32m
     Suggestions so far: 3
```

### 4. Help (`!help`)
```
Bot: 🎬 Movie Night Bot Commands:
     !suggest <title> - Suggest a movie
     !list - See all suggestions
     !status - Time until poll
     !help - This message
```

### 5. Automatic Friday Poll (12:00 CET)
```
Bot: 🍿 Time to vote! Here are this week's movies:

     1. *Inception* (2010) - suggested by Michael
        🔗 https://www.imdb.com/title/tt1375666/

     2. *The Matrix* (1999) - suggested by Anna
        🔗 https://www.imdb.com/title/tt0133093/

     3. *Interstellar* (2014) - suggested by Tom
        🔗 https://www.imdb.com/title/tt0816692/

[WhatsApp Poll: "Which movie for tonight?" with options]
```

### 6. Post-Deadline Behavior
- After poll: suggestions locked until Saturday 00:00
- Automatically resets for next week

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Render (Free)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Node.js App                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │  Baileys    │  │  Commands   │  │  Scheduler   │  │  │
│  │  │  WhatsApp   │  │  Handler    │  │  (node-cron) │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  │  │
│  │         │                │                │          │  │
│  │         └────────────────┴────────────────┘          │  │
│  │                          │                           │  │
│  │                   ┌──────┴──────┐                    │  │
│  │                   │  In-Memory  │                    │  │
│  │                   │   Storage   │                    │  │
│  │                   └─────────────┘                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                             │                               │
│  ┌──────────────────────────┴────────────────────────────┐  │
│  │              Express Health Check (:3000)             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                                    ▲
         ▼                                    │
┌─────────────────┐                  ┌────────┴────────┐
│  WhatsApp Group │                  │  cron-job.org   │
└─────────────────┘                  │  - /health ping │
         │                           │    every 14 min │
         │                           │  - /poll trigger│
┌────────┴────────┐                  │    Fri 12:00    │
│    TMDB API     │                  └─────────────────┘
└─────────────────┘
```

---

## File Structure

```
whatsapp-movie-night-bot/
├── src/
│   ├── index.ts              # Entry point
│   ├── bot.ts                # Baileys setup & message routing
│   ├── commands/
│   │   ├── index.ts          # Command router
│   │   ├── suggest.ts        # !suggest command
│   │   ├── list.ts           # !list command
│   │   ├── status.ts         # !status command
│   │   └── help.ts           # !help command
│   ├── services/
│   │   ├── tmdb.ts           # TMDB API client
│   │   ├── scheduler.ts      # Poll scheduling logic
│   │   └── poll.ts           # Poll creation
│   ├── store.ts              # In-memory suggestion storage
│   ├── server.ts             # Express health check server
│   └── types.ts              # TypeScript interfaces
├── auth_info/                # Baileys session (gitignored)
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── render.yaml               # Render deployment config
└── README.md
```

---

## Environment Variables

```bash
# Required
TMDB_API_KEY=your_tmdb_api_key        # Get free at themoviedb.org
GROUP_JID=123456789@g.us              # WhatsApp group ID (logged on first run)

# Optional (with defaults)
DEADLINE_TIMEZONE=Europe/Berlin       # Timezone for deadline
DEADLINE_DAY=5                        # Day of week (5 = Friday)
DEADLINE_HOUR=12                      # Hour (24h format)
PORT=3000                             # Health check port
```

---

## Implementation Phases

### Phase 1: Project Setup
1. Initialize npm project with TypeScript
2. Install dependencies: `@whiskeysockets/baileys`, `axios`, `express`, `node-cron`, `dotenv`
3. Set up ESLint + Prettier
4. Create basic Baileys connection with QR code auth
5. Log group JID when bot receives first message

**Files**: `package.json`, `tsconfig.json`, `src/index.ts`, `src/bot.ts`

### Phase 2: TMDB Integration
1. Create TMDB service with movie search
2. Extract movie details: title, year, rating, overview, poster, IMDB ID
3. Format IMDB URL from IMDB ID

**Files**: `src/services/tmdb.ts`, `src/types.ts`

### Phase 3: Commands
1. Implement command router (detect `!command` pattern)
2. `!suggest` - search + confirm flow with pending suggestions
3. `!list` - format and display current suggestions
4. `!status` - calculate and show time remaining
5. `!help` - display command list

**Files**: `src/commands/*.ts`, `src/store.ts`

### Phase 4: Poll & Scheduling
1. Implement poll creation with Baileys `sendMessage({ poll: ... })`
2. Create scheduler that calculates next Friday deadline
3. Block suggestions after deadline
4. Auto-reset on Saturday

**Files**: `src/services/poll.ts`, `src/services/scheduler.ts`

### Phase 5: Deployment
1. Add Express health check endpoint
2. Create `render.yaml` for Render deployment
3. Set up cron-job.org:
   - GET `/health` every 14 minutes (keep-alive)
   - GET `/trigger-poll` at Friday 12:00 CET (backup trigger)
4. Document setup in README

**Files**: `src/server.ts`, `render.yaml`, `README.md`

---

## Key Implementation Details

### Baileys Poll Message
```typescript
await sock.sendMessage(groupJid, {
  poll: {
    name: '🎬 Which movie for tonight?',
    values: ['Inception (2010)', 'The Matrix (1999)', 'Interstellar (2014)'],
    selectableCount: 1  // Single choice
  }
});
```

### TMDB Movie Search
```typescript
const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
  params: {
    api_key: TMDB_API_KEY,
    query: movieTitle,
    include_adult: false
  }
});
const movie = response.data.results[0]; // Best match
const imdbUrl = `https://www.imdb.com/title/${movie.imdb_id}/`;
```

### Session Persistence on Render
```typescript
// Store auth state in a file that persists across deploys
const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
```
Note: Render's free tier has ephemeral filesystem. We'll need to either:
- A) Store auth in environment variable (encoded)
- B) Use Render's persistent disk ($0.25/GB/month)
- C) Re-scan QR after each deploy (acceptable for hobby project)

---

## Verification Plan

1. **Local Testing**
   - [ ] Run bot locally, scan QR code
   - [ ] Send `!help` in group, verify response
   - [ ] Test `!suggest Inception`, confirm flow works
   - [ ] Test `!list` shows suggestions
   - [ ] Test `!status` shows correct deadline

2. **TMDB Integration**
   - [ ] Search for well-known movie (Inception, Matrix)
   - [ ] Search for obscure movie
   - [ ] Verify IMDB links are correct

3. **Poll Creation**
   - [ ] Add 2-3 suggestions
   - [ ] Manually trigger poll endpoint
   - [ ] Verify poll appears in group with correct options
   - [ ] Verify IMDB links message follows poll

4. **Deployment**
   - [ ] Deploy to Render
   - [ ] Verify health endpoint responds
   - [ ] Set up cron-job.org pings
   - [ ] Test bot responds after Render wake-up

5. **End-to-End Weekly Cycle**
   - [ ] Test full flow: suggest → list → poll → reset

---

## Cost Summary

| Service | Cost |
|---------|------|
| TMDB API | Free (non-commercial) |
| Render hosting | Free tier |
| cron-job.org | Free |
| **Total** | **€0** |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Baileys breaks with WhatsApp update | Monitor GitHub issues, update promptly |
| Render free tier sleeps | cron-job.org pings every 14 min |
| Session lost on Render deploy | Document QR re-scan process; consider paid disk |
| WhatsApp bans bot number | Use for personal group only, no spam |

---

## Future Enhancements (Out of Scope)
- Persistent storage (database) for suggestion history
- Voting results tracking
- Multiple groups support
- Movie watchlist ("we already watched this")
