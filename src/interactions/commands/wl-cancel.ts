import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { cancelApplication, getActiveApplication } from '../../db/queries.js';
import { refreshAdminPanel } from '../../services/admin-panel.js';
import { logger } from '../../lib/logger.js';

export const wlCancelCommand = new SlashCommandBuilder()
  .setName('wl-cancel')
  .setDescription('Cancel a user\'s active whitelist application')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt
      .setName('user')
      .setDescription('The applicant whose application to cancel')
      .setRequired(true)
  );

export async function handleWlCancel(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const target = interaction.options.getUser('user', true);
  const app = getActiveApplication(target.id);

  if (!app) {
    await interaction.editReply(`<@${target.id}> has no active application.`);
    return;
  }

  const cancelled = cancelApplication(app.id);
  if (!cancelled) {
    await interaction.editReply('Could not cancel the application — it may have just been decided.');
    return;
  }

  logger.info(`Application ${app.id} cancelled by admin ${interaction.user.id}`);

  // Archive the thread if it exists
  if (app.thread_id && interaction.guild) {
    try {
      const channel = await interaction.guild.channels.fetch(app.thread_id);
      if (channel?.isThread()) {
        await channel.setArchived(true);
      }
    } catch (err) {
      logger.warn(`Could not archive thread ${app.thread_id} for cancelled app ${app.id}`, err);
    }
  }

  await interaction.editReply(
    `Application #${app.id} for <@${target.id}> has been cancelled.${app.thread_id ? ' Thread archived.' : ''}`
  );

  refreshAdminPanel(interaction.client).catch((e: unknown) =>
    logger.error('Failed to refresh admin panel after cancel', e)
  );
}
