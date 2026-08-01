# Build Plan

Eight phases. Each has an explicit acceptance check. **Do not start a phase until the
previous one's check passes in a real Discord server.** Report the check result and stop
at the end of each phase rather than continuing.

---

## Phase 1 — Skeleton

Set up the project so it starts, connects, and exits cleanly.

- `package.json` with the scripts listed in CLAUDE.md, `"type": "module"`
- `tsconfig.json`, strict, target ES2023, `moduleResolution: "bundler"`
- `src/config.ts` parsing and validating: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`,
  `GUILD_ID`, `DATABASE_PATH`, `STATS_TIMEZONE`. Throw on startup if any are missing.
- `src/index.ts` — client with `GatewayIntentBits.Guilds` only, `ClientReady` log,
  SIGTERM/SIGINT handler that closes the DB and destroys the client
- `.env.example`, `.gitignore` (must include `.env`, `node_modules`, `dist`, `*.db*`)
- `src/db/index.ts` — better-sqlite3 connection with `journal_mode = WAL` and
  `foreign_keys = ON`, plus a migration runner that applies `migrations/*.sql` in order
  and records applied filenames in a `_migrations` table

**Acceptance:** `npm run dev` connects and logs the bot's tag. Ctrl+C exits without an
unhandled rejection. The SQLite file is created on first run.

---

## Phase 2 — Schema and setup command

- Migration `0001_init.sql` creating `applications`, `decisions`, `guild_config` per the
  data model in CLAUDE.md, with the specified indexes
- `db/queries.ts` with typed prepared statements for config get/set
- `/wl-setup` slash command, `Administrator`-gated via `setDefaultMemberPermissions`,
  with subcommands or options to set: applications channel, stats channel, whitelist role,
  staff role
- `npm run register` script that pushes commands to `GUILD_ID` (guild-scoped, so they
  appear instantly rather than taking an hour to propagate)
- A `/wl-config` command that prints current config so setup is verifiable

**Acceptance:** Run `/wl-setup`, then `/wl-config` and see the values echoed back.
Restart the bot; `/wl-config` still shows them.

---

## Phase 3 — Panel and modal

- `/wl-panel` admin command that posts the application embed with an "Apply" button into
  the configured applications channel, and stores the message ID in `guild_config`
- `interactions/router.ts` — the single `InteractionCreate` handler. Dispatch on
  interaction type, then on the customId prefix parsed by `lib/customId.ts`. Every branch
  defers first.
- The apply modal: 2–3 text inputs (however the form should read), a **user select** for
  the vouch person, a **checkbox** for rules acknowledgment, and a **file upload**
  accepting up to 5 screenshots. All wrapped in `Label` components.
- Before opening the modal, reject with an ephemeral message if the user already has a
  `pending` or `claimed` application, or if they already hold the whitelist role.

Check the current discord.js docs for the builder classes for select-in-modal, checkbox,
and file upload — these shipped recently and the names are not guessable.

**Acceptance:** Clicking Apply opens the modal with all field types rendering. Submitting
logs the parsed values including the selected user ID and attachment metadata. Clicking
Apply a second time is refused.

---

## Phase 4 — Thread creation

- On modal submit: insert the `applications` row with status `pending`, then create a
  private thread in the applications channel named `wl-<username>`
- Add the applicant and the vouch user to the thread
- Post the application embed as the first message: answers, applicant, vouch user, submitted
  timestamp, application ID in the footer
- **Download each uploaded attachment and re-upload it** into the thread as a second
  message. Do not link the CDN URL.
- Store `thread_id` on the application row
- If thread creation fails, roll back the application row so the user can retry

**Acceptance:** Submit an application from a non-staff test account. The thread appears,
is invisible to a third unrelated account, and visible to the applicant, the vouched user,
and anyone with Manage Threads. Screenshots render. Re-check the thread the next day and
images still load.

---

## Phase 5 — Claim

- `/claim` command, usable only inside an application thread, restricted to the staff role
- Conditional write `pending -> claimed` recording `claimed_by` and `claimed_at`
- On success post a **non-ephemeral** message in the thread: "Claimed by @staffer" with
  three buttons: Approve, Deny (Requirements), Deny (Expectations)
- Button handlers verify `interaction.user.id === application.claimed_by` and reject
  others ephemerally
- `/unclaim` to release back to `pending`, deleting or disabling the claim message

**Acceptance:** Staffer A claims. Staffer B running `/claim` is told it's already claimed
by A. Staffer B clicking A's buttons is refused. `/unclaim` frees it for B.

---

## Phase 6 — Decisions

- Approve: conditional write `claimed -> approved`, insert a `decisions` row, add the
  whitelist role, edit the claim message to disable all buttons, post an outcome message,
  then archive **and** lock the thread. Never delete the thread.
- Deny (Requirements) and Deny (Expectations): open a short modal for an optional note,
  then the same flow with the respective status and no role grant
- All three verify `changes === 1` before any side effect
- Wrap the role grant specifically: if it throws, do not lose the decision — the DB write
  already happened, so post an error in the thread telling staff to grant manually, and log it

**Acceptance:** Approve an application end to end. Role is granted, thread locks, buttons
grey out. Manually set a row back to `claimed` in SQLite, then have two accounts click
Approve within the same second — exactly one succeeds and the other gets "already decided".

---

## Phase 7 — Stats

- `services/stats.ts` with queries: approvals this month, approvals all time, per-staff
  decision counts this month and all time, current pending/claimed counts
- Month boundary computed in `STATS_TIMEZONE`, not UTC
- `/wl-stats-panel` admin command posting the initial embed to the stats channel, storing
  its message ID
- A dirty flag set by every decision, and a `setInterval` flushing every 60 seconds that
  edits the stored message only when dirty
- On startup, refresh once so the embed is never stale after a deploy
- Handle the message having been deleted: catch `Unknown Message`, clear the stored ID,
  and log a warning rather than crashing the interval

**Acceptance:** Approve an application, wait a minute, see the embed update. Restart the
bot and confirm the embed is refreshed on boot and the interval resumes. Delete the stats
message manually and confirm the bot logs a warning instead of crash-looping.

---

## Phase 8 — Hardening and deploy

- Cooldown: block reapplication for N days after a denial (configurable, default 7)
- `Dockerfile` (node:24-slim, multi-stage, non-root user) and `railway.json` or
  `railway.toml` declaring the volume mount path matching `DATABASE_PATH`
- `README.md`: required bot permissions, OAuth2 invite URL scopes (`bot`,
  `applications.commands`), the role-position requirement, setup command order, and
  environment variables
- A `npm run backup` script that runs SQLite's `.backup` to a timestamped file
- Basic vitest coverage for: customId round-tripping, the state machine's conditional
  transitions, and the month-boundary calculation

**Acceptance:** `docker build` succeeds and the container starts locally against a test
token. A fresh reader can follow the README and get a working install.