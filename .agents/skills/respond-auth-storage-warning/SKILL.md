---
name: respond-auth-storage-warning
description: Use when the WhatsApp Movie Night Bot reports an auth_info storage warning, or the user asks to inspect growing Baileys authentication storage or assess selective cleanup.
---

# Respond to an auth storage warning

Diagnose allocated disk usage, identify defensible cleanup candidates, and preserve working WhatsApp encryption state. A warning is an investigation threshold, not evidence that files are stale.

## Locate and inspect

The local project is `~/whatsapp-movie-night-bot`. The known deployment is Uberspace 7 over SSH at `kagee7ai@kageetai.net`, with the project under the remote user's home and Supervisor service `whatsapp-movie-night-bot`. Verify these before acting; distinguish local files from the deployed auth directory. Read applicable AGENTS.md instructions.

Consult the project's README section "Responding to an auth storage warning" and the deployed `src/services/auth-storage.ts`, `src/bot.ts`, and installed Baileys auth/Signal implementation. Filename formats and filtering behavior depend on the installed version. Check only the relevant configuration values, such as `GROUP_JID` and `PORT`; keep credentials and unrelated environment values out of output.

From the deployed project directory, collect:

```sh
du -sk auth_info
du -sh auth_info
df -h .
find auth_info -maxdepth 1 -type f | wc -l
supervisorctl status
```

Summarize file counts, logical bytes, and allocated space by auth key category using filenames and file metadata. Match complete category prefixes: `sender-key-memory-` before `sender-key-`, and `app-state-sync-key-` separately from `app-state-sync-version-`. Inspect key filenames without printing their contents or publishing user/device identifiers. Disk free space from `df` describes the filesystem, not the user's individual hosting quota.

The current monitor uses `du -sk`, warns at 10 MiB, checks at startup and hourly, and sends email through `ALERT_EMAIL_TO`. Verify the implementation rather than assuming these defaults persist. Warnings are suppressed until usage falls below the threshold or the process restarts; failed email is retried. Explain that file contents and allocated space differ: a 950-byte file often occupies a 4 KiB block, plus directory overhead.

## Classify candidates

Confirm the configured group filter is deployed and active. It preserves the configured group, own-device traffic, and system messages; it reduces future unrelated sessions without removing existing ones.

| Stored state | Treatment |
|---|---|
| Configured group's sender keys and sender-key memory | Keep |
| Shared `session-` files | Keep; user/device sessions are not scoped to one chat |
| Pre-keys, credentials, app-state and unknown key types | Keep |
| Sender keys positively attributed to excluded groups or status broadcasts | Candidates for quarantine, subject to the active filter and installed filename format |

In Baileys 6.7.24, group sender-key filenames have the form `sender-key-<group>@g.us--<user>--<device>.json`, because the auth writer replaces `:` with `-`. Status keys use `status@broadcast`. Verify this derivation in the installed code before classifying. Use anchored, exact formats; preserve unrecognized files. Timestamps, unfamiliar identifiers, and absence from a current device list do not establish that shared sessions are disposable.

Trace preserved own-device message handling before labeling excluded-group keys unused: account synchronization can still carry state for other chats. Treat the filename classification as quarantine candidates, not proof of permanent disuse. If retained traffic recreates a key, investigate that path rather than repeatedly removing it.

Report candidate counts and reclaimable allocation before making changes. If usage is stable and quota is sufficient, leaving it alone is reasonable. For ongoing growth, inspect connection/decryption errors and account traffic instead of hiding the issue by raising the threshold.

## Quarantine when authorized

An assessment request authorizes read-only diagnosis. Follow the current user's authorization for stopping services and moving files; this skill does not authorize deletion, re-pairing, sending group messages, or deployment by itself.

1. Prepare an explicit filename manifest and a private, uniquely named directory outside `auth_info`, such as `~/whatsapp-auth-quarantine/<UTC timestamp>/`. Use restrictive permissions (directory 0700, manifest 0600). Leave auth contents out of logs and Git.
2. Stop the verified bot service and confirm it stopped. Recheck the candidates against `GROUP_JID` after stopping; if the selection changed unexpectedly, restart unchanged and reassess. Keep one process per auth directory.
3. Move only the reviewed files. Keep a record of completed moves; roll them back if any move fails. Ensure the bot is restarted even if the operation fails, and report any restart failure immediately. Preserve the quarantine for recovery.
4. Compare before/after `du` measurements. A same-filesystem move reduces the monitored directory but does not free account disk space while the quarantine remains.

## Verify and report

Confirm Supervisor reports RUNNING and the latest startup logs show a WhatsApp connection. Read only relevant log lines; distinguish old errors from new ones. Check `/health` and `/status` on localhost using the configured port. HTTP health alone does not prove WhatsApp messaging works.

Ask the user to send `/status` in the configured group, or use an already authorized messaging path. A real reply verifies incoming decryption and outgoing messages. Test polls only when authorized; report when poll delivery remains untested. Check whether quarantined filenames reappear.

If cleanup causes a failure, stop the bot, restore only the quarantined filenames to their original paths without overwriting newly created state, then restart and verify. If paths conflict, retain both copies and assess rather than overwriting encryption state. A full auth reset requires a planned outage and phone access for re-pairing; treat it as a separate recovery action.

Report moved count, quarantine path, before/after allocated size, connection and message evidence, any unresolved errors, and untested behavior. Delete quarantine only with user authorization after successful verification. Do not claim long-term growth is solved from one snapshot.
