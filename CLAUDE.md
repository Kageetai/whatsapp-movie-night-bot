# CLAUDE.md - AI Assistant Context

See `README.md` for general project documentation, setup, and usage.

## Critical Technical Details

### Baileys Connection Compatibility
Pin Baileys to an exact release and let that installed release select its bundled WhatsApp protocol version. Do not call `fetchLatestBaileysVersion()`: it reads the version from Baileys' `master` branch and can combine a new protocol version with older library code.

The bot also skips history synchronization because it only processes new group messages:

```typescript
// src/bot.ts - DO NOT remove these
sock = makeWASocket({
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger),  // Required
  },
  browser: ['Movie Night Bot', 'Chrome', '120.0.0'],
  syncFullHistory: false,
  shouldSyncHistoryMessage: () => false,
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
