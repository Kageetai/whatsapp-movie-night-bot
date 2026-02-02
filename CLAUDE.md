# CLAUDE.md - AI Assistant Context

See `README.md` for general project documentation, setup, and usage.

## Critical Technical Details

### Baileys Connection Fix
The bot uses specific Baileys settings required for stable WhatsApp connection. Without these, you get 405 "Method Not Allowed" errors:

```typescript
// src/bot.ts - DO NOT remove these
const { version } = await fetchLatestBaileysVersion();
sock = makeWASocket({
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger),  // Required
  },
  version,  // Required - fetched dynamically
  browser: ['Movie Night Bot', 'Chrome', '120.0.0'],  // Required
});
```

### Hosting Constraints
- **Cannot use serverless** (Vercel, Lambda) - requires persistent WebSocket
- See `docs/ADRs/001-hosting-platform.md` for hosting decision rationale

### Key Architecture Choices
- **Baileys** (not whatsapp-web.js) - WebSocket-based, lighter weight
- **In-memory storage** - suggestions lost on restart (by design for simplicity)
- **One suggestion per user** - new suggestion replaces previous

## Development
- First run shows QR code - scan with WhatsApp to authenticate
- `auth_info/` stores session (gitignored)
- Group JID logged when bot receives first group message
