import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import { getConfig, getPendingOnlyCount, getAllOverdueApplications } from '../../db/queries.js';
import { logger } from '../../lib/logger.js';

const OVERDUE_SECONDS = 24 * 60 * 60;

export const wlNotifyCommand = new SlashCommandBuilder()
  .setName('wl-notify')
  .setDescription('Manually ping staff with current pending queue status and any overdue applications.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleWlNotify(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: 'You need the Administrator permission to use this command.' });
    return;
  }

  const channelId = getConfig('admin_panel_channel_id');
  const staffRoleId = getConfig('staff_role_id');

  if (!channelId || !staffRoleId) {
    await interaction.editReply({ content: 'Admin panel channel or staff role is not configured. Run `/wl-setup` first.' });
    return;
  }

  let channel: TextChannel;
  try {
    const fetched = await interaction.guild!.channels.fetch(channelId);
    if (!fetched?.isTextBased() || !('send' in fetched)) {
      await interaction.editReply({ content: 'Configured admin panel channel is not a text channel.' });
      return;
    }
    channel = fetched as TextChannel;
  } catch (err) {
    logger.error('wl-notify: failed to fetch admin panel channel', err);
    await interaction.editReply({ content: 'Failed to fetch the admin panel channel.' });
    return;
  }

  const pendingCount = getPendingOnlyCount();
  const cutoff = Math.floor(Date.now() / 1000) - OVERDUE_SECONDS;
  const overdueApps = getAllOverdueApplications(cutoff);

  const embeds: EmbedBuilder[] = [];

  embeds.push(
    new EmbedBuilder()
      .setTitle('📋 Queue Status')
      .setDescription(
        pendingCount === 0
          ? 'No unclaimed applications at this time.'
          : `There ${pendingCount === 1 ? 'is' : 'are'} **${pendingCount} unclaimed** whitelist application${pendingCount === 1 ? '' : 's'} waiting for review.`
      )
      .setColor(pendingCount === 0 ? 0x57f287 : 0xfee75c)
      .setFooter({ text: `Triggered manually by ${interaction.user.tag}` })
      .setTimestamp(),
  );

  if (overdueApps.length > 0) {
    const lines = overdueApps.map((a) => {
      const thread = a.thread_id ? ` — <#${a.thread_id}>` : '';
      return `• **#${a.id}** <@${a.applicant_id}> — submitted <t:${a.created_at}:R>${thread}`;
    });
    embeds.push(
      new EmbedBuilder()
        .setTitle('⏰ Overdue Applications (>24 h)')
        .setDescription(lines.join('\n'))
        .setColor(0xed4245),
    );
  }

  try {
    await channel.send({ content: `<@&${staffRoleId}>`, embeds });
    logger.info(`Manual staff notify sent by ${interaction.user.id}: ${pendingCount} pending, ${overdueApps.length} overdue`);
    await interaction.editReply({ content: `Notification sent to <#${channelId}>.` });
  } catch (err) {
    logger.error('wl-notify: failed to send notification', err);
    await interaction.editReply({ content: 'Failed to send the notification.' });
  }
}
