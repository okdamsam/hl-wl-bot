import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { refreshAdminPanel } from '../../services/admin-panel.js';

const refreshMessages = {
  updated: 'Admin panel refreshed.',
  'no-config': 'No admin panel message found. Run `/wl-admin-panel` to post one first.',
  'message-gone': 'The admin panel message was deleted. Run `/wl-admin-panel` to re-post it.',
  error: 'Failed to refresh the admin panel — check the logs.',
} as const;
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
    const result = await refreshAdminPanel(interaction.client);
    if (result !== 'updated') logger.warn(`wl-refresh: panel not updated — ${result}`);
    await interaction.editReply({ content: refreshMessages[result] });
  } catch (err) {
    logger.error('Failed to force-refresh admin panel', err);
    await interaction.editReply({ content: 'Failed to refresh the admin panel. Check the logs.' });
  }
}
