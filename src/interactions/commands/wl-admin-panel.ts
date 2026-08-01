import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getConfig, setConfig } from '../../db/queries.js';
import { buildAdminPanelEmbed } from '../../services/admin-panel.js';
import { logger } from '../../lib/logger.js';

export const wlAdminPanelCommand = new SlashCommandBuilder()
  .setName('wl-admin-panel')
  .setDescription('Post (or re-post) the live pending-applications panel in the admin panel channel.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleWlAdminPanel(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: 'You need the Administrator permission to use this command.' });
    return;
  }

  const channelId = getConfig('admin_panel_channel_id');
  if (!channelId) {
    await interaction.editReply('No admin panel channel configured. Run `/wl-setup admin-panel-channel` first.');
    return;
  }

  try {
    const channel = await interaction.guild!.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      await interaction.editReply('Configured admin panel channel is not a text channel.');
      return;
    }

    const message = await channel.send({ embeds: [buildAdminPanelEmbed()] });
    setConfig('admin_panel_message_id', message.id);
    logger.info(`Admin panel posted to channel ${channelId} as message ${message.id}`);
    await interaction.editReply(`Admin panel posted in <#${channelId}>. It will update automatically as applications change state.`);
  } catch (err) {
    logger.error('Failed to post admin panel', err);
    await interaction.editReply('Failed to post the admin panel. Check bot permissions in that channel.').catch(() => null);
  }
}
