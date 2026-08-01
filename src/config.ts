import { configDotenv } from 'dotenv';

// Loads .env into process.env for local development.
// In production (Railway) env vars are already present; dotenv is a no-op.
configDotenv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  DISCORD_TOKEN: requireEnv('DISCORD_TOKEN'),
  DISCORD_CLIENT_ID: requireEnv('DISCORD_CLIENT_ID'),
  GUILD_ID: process.env['GUILD_ID'] ?? null,
  DATABASE_PATH: requireEnv('DATABASE_PATH'),
  STATS_TIMEZONE: process.env['STATS_TIMEZONE'] ?? 'America/New_York',
} as const;
