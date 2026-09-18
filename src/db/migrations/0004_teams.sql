CREATE TABLE IF NOT EXISTS teams (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id         INTEGER NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  team_role       TEXT NOT NULL CHECK (team_role IN ('leader', 'senior', 'member')),
  speciality      TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE (team_id, discord_user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_role
  ON team_members (team_id, team_role);

CREATE TABLE IF NOT EXISTS team_managers (
  team_id         INTEGER NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  PRIMARY KEY (team_id, discord_user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_managers_user
  ON team_managers (discord_user_id);