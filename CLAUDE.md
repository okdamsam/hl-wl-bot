# Whitelist Application Bot

A Discord bot that runs whitelist applications for a single guild: users apply via a
modal, each application gets a private thread, staff claim and decide, approved users
get a role, and a stats channel shows live approval counts per staff member.

Single guild. Low volume (tens to low hundreds of applications per month). Reliability
and auditability matter far more than throughput.

## Stack

- Node.js 24.17+ (required by discord.js 14.27)
- TypeScript, strict mode
- discord.js ^14.27
- better-sqlite3 (synchronous, single-file DB)
- Deployed on Railway with a persistent volume mounted for the SQLite file

Do not add a web framework, an ORM, Redis, or a message queue. This bot does not need them.

## Commands

```bash
npm run dev            # tsx watch, local development
npm run build          # tsc to dist/
npm start              # node dist/index.js
npm run register       # push slash commands to the guild (run after changing command defs)
npm run migrate        # apply pending SQL migrations
npm test               # vitest
```

## Layout

```
src/
  index.ts             # client bootstrap, login, graceful shutdown
  config.ts            # env parsing + validation, fail fast on missing vars
  db/
    index.ts           # better-sqlite3 connection, WAL mode, pragmas
    migrations/        # NNNN_name.sql, applied in filename order
    queries.ts         # every SQL statement lives here, nowhere else
  interactions/
    router.ts          # single InteractionCreate handler, dispatches by customId prefix
    commands/          # one file per slash command
    buttons/           # one file per button action
    modals/            # one file per modal submit
  services/
    applications.ts    # create/claim/decide state machine
    threads.ts         # private thread creation and membership
    stats.ts           # aggregation queries + debounced embed refresh
  lib/
    customId.ts        # encode/decode helpers, single source of truth for the format
    logger.ts
```

## Non-negotiable rules

These exist because each one is a bug that has already been reasoned through. Do not
"simplify" past them.

**Never use `createMessageComponentCollector` or awaitMessageComponent.** Collectors die
when the process restarts and the buttons go permanently dead. All component state is
encoded in `customId` and routed through the single handler in `interactions/router.ts`.

**customId format is `domain:action:entityId`**, e.g. `wl:claim:412`, `wl:decide:accept:412`.
Parsing and building both go through `lib/customId.ts`. Discord caps customId at 100 chars.

**Always acknowledge within 3 seconds.** Call `deferReply({ flags: MessageFlags.Ephemeral })`
or `deferUpdate()` as the first statement in every handler, before any DB or REST work.

**State transitions are conditional writes.** Two staff clicking Accept simultaneously
must not double-grant. Every transition is
`UPDATE applications SET status = ? WHERE id = ? AND status = ?`, and the handler checks
`changes === 1` before doing anything with side effects. If `changes === 0`, tell the
user the application was already decided and refresh the message.

**Private threads, not forum posts.** Forum threads inherit the parent channel's
permissions and cannot be made per-post private. Use
`ChannelType.PrivateThread` in a normal text channel. Staff see all of them via the
`ManageThreads` permission on the parent channel; the applicant and the vouch user are
added explicitly.

**Re-upload attachments from modal submissions.** Discord CDN URLs are signed and expire.
Fetch the bytes from the interaction's resolved attachments and re-upload them into the
thread message, or the screenshots will 404 in a week.

**No privileged intents.** `GatewayIntentBits.Guilds` only. Everything needed arrives in
interaction payloads, and member data can be fetched over REST on demand. Adding
`GuildMembers` or `MessageContent` would drag this app into Discord's privileged intent
review for no benefit.

**Stats come from the database, never from scanning channel history.** Every decision
writes an append-only row to `decisions`. The stats embed is two `GROUP BY` queries.

**The stats embed refreshes on a timer, not per decision.** Mark state dirty, flush every
60 seconds via `setInterval`. Editing the same message on every click will hit channel
rate limits on a busy evening.

**Month boundaries use a fixed timezone.** Store all timestamps as UTC epoch seconds.
Compute "this month" against the timezone in `config.STATS_TIMEZONE` (default
`America/New_York`), or the monthly leaderboard silently shifts.

## Discord API notes

Modals are more capable than most training data suggests. As of Sept 2025 modals support
User/Role/Mentionable/Channel selects, as of Oct 2025 a File Upload component (0–10
files), and as of Feb 2026 radio groups, checkbox groups, and checkboxes. All of these
must be wrapped in a `Label` component. **Verify the exact discord.js builder class names
against https://discord.js.org/docs before using them** — these are recent additions and
the API surface is easy to guess wrong.

The whole application form should be one modal: text inputs, a user select for the vouch
person, checkboxes for rule acknowledgment, and a file upload for screenshots.

Bot permissions required: View Channel, Send Messages, Create Private Threads, Send
Messages in Threads, Manage Threads, Manage Roles, Embed Links, Attach Files, Pin
Messages. As of 23 Feb 2026 `Manage Messages` no longer grants pinning, so `Pin Messages`
must be requested explicitly.

The bot's own role must be positioned **above** the whitelist role in the guild role list,
or role grants fail at runtime with a permissions error.

## Data model

`applications` — one row per submission. Status is one of `pending`, `claimed`,
`approved`, `denied_requirements`, `denied_expectations`, `cancelled`. Answers stored as
JSON in a single column; do not normalize the form fields into columns, the form will change.

`decisions` — append-only audit log: `application_id`, `staff_id`, `action`, `note`,
`created_at`. Never updated or deleted. This table is the source of truth for stats.

`guild_config` — key/value for channel IDs, message IDs, and role IDs. These are set at
runtime via `/wl-setup`, not hardcoded and not in env.

Indexes: `(applicant_id, status)`, `(status)`, `(staff_id, created_at)` on decisions.

## Conventions

- Secrets come from environment variables only. Never commit a `.env`. `.env.example`
  documents the required keys with placeholder values.
- Everything user-facing that could fail (role grant, thread creation, DM) is wrapped and
  logged with the application ID. A silent failure here means a member sits in limbo.
- No `any` on interaction objects. Narrow with the `isChatInputCommand()` /
  `isButton()` / `isModalSubmit()` type guards.
- Prefer explicit SQL in `db/queries.ts` over query builders.

## Out of scope

Do not build: a web dashboard, multi-guild support, an appeals workflow, DM-based
applications, or a plugin system. If a change seems to require one of these, stop and ask.