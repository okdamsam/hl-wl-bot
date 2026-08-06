import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { refreshAdminPanel } from '../../services/admin-panel.js';
import { logger } from '../../lib/logger.js';

export const wlRefreshCommand = new SlashCommandBuilder()
  .setName('wl-refresh')
  .setDescription('Force-refresh the pending applications panel to reflect current state.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleWlRefresh(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: 'You need the Administrator permission to use this command.' });
    return;
  }

  try {
    await refreshAdminPanel(interaction.client);
    logger.info(`Admin panel force-refreshed by ${interaction.user.id}`);
    await interaction.editReply({ content: 'Admin panel refreshed.' });
  } catch (err) {
    logger.error('Failed to force-refresh admin panel', err);
    await interaction.editReply({ content: 'Failed to refresh the admin panel. Check the logs.' });
  }
}
