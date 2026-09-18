import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from './config.js';
import { db } from './db/index.js';
import { logger } from './lib/logger.js';
import { registerRouter } from './interactions/router.js';
import { startApiServer } from './api.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

registerRouter(client);
const apiServer = startApiServer();

client.once(Events.ClientReady, (c) => {
  logger.info(`Ready! Logged in as ${c.user.tag}`);
});

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully`);
  apiServer?.close();
  db.close();
  client.destroy();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

await client.login(config.DISCORD_TOKEN);
