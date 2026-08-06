import { Events, MessageFlags } from 'discord.js';
import type { Client, Interaction } from 'discord.js';
import { logger } from '../lib/logger.js';
import { decode } from '../lib/customId.js';
import { handleWlSetup } from './commands/wl-setup.js';
import { handleWlConfig } from './commands/wl-config.js';
import { handleWlPanel } from './commands/wl-panel.js';
import { handleWlCancel } from './commands/wl-cancel.js';
import { handleWlRubric } from './commands/wl-rubric.js';
import { handleWlStats } from './commands/wl-stats.js';
import { handleWlHelp } from './commands/wl-help.js';
import { handleWlAdminPanel } from './commands/wl-admin-panel.js';
import { handleWlQuery } from './commands/wl-query.js';
import { handleWlUnclaim } from './commands/wl-unclaim.js';
import { handleWlRefresh } from './commands/wl-refresh.js';
import { handleApplyButton } from './buttons/apply.js';
import { handleClaim } from './buttons/claim.js';
import { handleDecide } from './buttons/decide.js';
import { handleApplyModal } from './modals/apply.js';
import { handleDecideModal } from './modals/decide.js';

export function registerRouter(client: Client): void {
  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    void dispatch(interaction);
  });
}

async function dispatch(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'wl-setup':
          await handleWlSetup(interaction);
          break;
        case 'wl-config':
          await handleWlConfig(interaction);
          break;
        case 'wl-panel':
          await handleWlPanel(interaction);
          break;
        case 'wl-cancel':
          await handleWlCancel(interaction);
          break;
        case 'wl-rubric':
          await handleWlRubric(interaction);
          break;
        case 'wl-stats':
          await handleWlStats(interaction);
          break;
        case 'wl-help':
          await handleWlHelp(interaction);
          break;
        case 'wl-admin-panel':
          await handleWlAdminPanel(interaction);
          break;
        case 'wl-query':
          await handleWlQuery(interaction);
          break;
        case 'wl-unclaim':
          await handleWlUnclaim(interaction);
          break;
        case 'wl-refresh':
          await handleWlRefresh(interaction);
          break;
        default:
          await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral });
      }
      return;
    }

    if (interaction.isButton()) {
      const [, action] = decode(interaction.customId);
      switch (action) {
        case 'apply':
          await handleApplyButton(interaction);
          break;
        case 'claim':
          await handleClaim(interaction);
          break;
        case 'decide':
          await handleDecide(interaction);
          break;
        default:
          await interaction.reply({ content: 'Unknown button.', flags: MessageFlags.Ephemeral });
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      const [, action] = decode(interaction.customId);
      switch (action) {
        case 'apply':
          await handleApplyModal(interaction);
          break;
        case 'decide':
          await handleDecideModal(interaction);
          break;
        default:
          await interaction.reply({ content: 'Unknown modal.', flags: MessageFlags.Ephemeral });
      }
      return;
    }
  } catch (err) {
    logger.error('Unhandled error in interaction dispatch', err);
  }
}
