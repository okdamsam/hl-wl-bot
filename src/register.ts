// Pushes slash commands to the configured guild. Run after changing command definitions.
// Usage: npm run register
import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { wlSetupCommand } from './interactions/commands/wl-setup.js';
import { wlConfigCommand } from './interactions/commands/wl-config.js';
import { wlPanelCommand } from './interactions/commands/wl-panel.js';
import { wlCancelCommand } from './interactions/commands/wl-cancel.js';
import { wlRubricCommand } from './interactions/commands/wl-rubric.js';
import { wlStatsCommand } from './interactions/commands/wl-stats.js';
import { wlHelpCommand } from './interactions/commands/wl-help.js';
import { wlAdminPanelCommand } from './interactions/commands/wl-admin-panel.js';
import { wlQueryCommand } from './interactions/commands/wl-query.js';
import { wlUnclaimCommand } from './interactions/commands/wl-unclaim.js';
import { wlRefreshCommand } from './interactions/commands/wl-refresh.js';
import { wlNotifyCommand } from './interactions/commands/wl-notify.js';

const commands = [wlSetupCommand, wlConfigCommand, wlPanelCommand, wlCancelCommand, wlRubricCommand, wlStatsCommand, wlHelpCommand, wlAdminPanelCommand, wlQueryCommand, wlUnclaimCommand, wlRefreshCommand, wlNotifyCommand].map((cmd) => cmd.toJSON());

const rest = new REST().setToken(config.DISCORD_TOKEN);

if (config.GUILD_ID) {
  logger.info(`Registering ${commands.length} command(s) to guild ${config.GUILD_ID} (guild-scoped, instant)…`);
  await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.GUILD_ID), { body: commands });
} else {
  logger.info(`Registering ${commands.length} command(s) globally (no GUILD_ID set — may take up to 1 hour to propagate)…`);
  await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commands });
}

logger.info('Commands registered successfully.');
