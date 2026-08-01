import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from './config.js';
import { db, runMigrations } from './db/index.js';
import { logger } from './lib/logger.js';
import { registerRouter } from './interactions/router.js';

runMigrations();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

registerRouter(client);

client.once(Events.ClientReady, (c) => {
  logger.info(`Ready! Logged in as ${c.user.tag}`);
});

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully`);
  db.close();
  client.destroy();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

await client.login(config.DISCORD_TOKEN);
