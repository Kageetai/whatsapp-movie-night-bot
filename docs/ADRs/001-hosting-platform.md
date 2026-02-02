# ADR-001: Hosting Platform Selection

## Status
Accepted

## Date
2026-02-02

## Context
We need to deploy a WhatsApp bot that:
- Maintains a persistent WebSocket connection to WhatsApp servers (via Baileys)
- Runs continuously to receive incoming messages
- Stores authentication session data (`auth_info/` folder)
- Executes scheduled tasks (Friday noon polls via node-cron)

### Options Considered

#### 1. Vercel
**Rejected** - Serverless architecture incompatible with our requirements:
- Functions timeout after 10-60 seconds
- No persistent connections
- No long-running processes
- Ephemeral filesystem

#### 2. Fly.io
**Considered** - Viable option with trade-offs:

| Pros | Cons |
|------|------|
| Free persistent volumes (1GB) | Credit card required for free tier |
| Can disable auto-sleep | More complex setup (Dockerfile + fly.toml + CLI) |
| Good free tier (3 VMs, 256MB each) | No auto-deploy from GitHub |
| Frankfurt region available | Steeper learning curve |
| | Risk of unexpected billing |

#### 3. Render
**Selected** - Best balance for this project:

| Pros | Cons |
|------|------|
| Simple GitHub integration | Free tier sleeps after 15 min inactivity |
| No credit card for free tier | Ephemeral filesystem (session lost on redeploy) |
| Familiar Heroku-like model | Persistent disk costs $0.25/GB/month |
| Easy web dashboard | |
| Minimal configuration (`render.yaml`) | |

## Decision
We will use **Render** for hosting.

### Mitigations for Render Limitations

1. **Sleep after inactivity**: Use [cron-job.org](https://cron-job.org) to ping `/health` every 14 minutes (free tier allows 15 min before sleep).

2. **Ephemeral filesystem**: Accept that QR code re-scan is needed after deploys. For a hobby project with infrequent deploys, this is acceptable. If it becomes problematic, we can:
   - Add Render persistent disk ($0.25/GB/month)
   - Store auth state in environment variable (base64 encoded)
   - Migrate to Fly.io

## Consequences

### Positive
- Quick setup and deployment
- No upfront costs or credit card required
- Auto-deploy on git push
- Simple operational model

### Negative
- Need external cron service for keep-alive
- Must re-authenticate WhatsApp after each deploy
- Limited to 750 free hours/month (sufficient for one always-on service)

### Neutral
- Vendor lock-in is minimal; can migrate to Fly.io or other platforms if needed
