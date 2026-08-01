import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getConfig } from '../../db/queries.js';

export const wlConfigCommand = new SlashCommandBuilder()
  .setName('wl-config')
  .setDescription('Show current whitelist bot configuration')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleWlConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: 'You need the Administrator permission to use this command.' });
    return;
  }

  const applicationsChannelId = getConfig('applications_channel_id');
  const statsChannelId = getConfig('stats_channel_id');
  const whitelistRoleId = getConfig('whitelist_role_id');
  const staffRoleId = getConfig('staff_role_id');
  const modRoleId = getConfig('mod_role_id');
  const onLeaveRoleId = getConfig('on_leave_role_id');
  const staffPingEnabled = getConfig('staff_ping_enabled') ?? '1';
  const adminPanelChannelId = getConfig('admin_panel_channel_id');

  const ch = (id: string | null) => (id ? `<#${id}>` : '*Not set*');
  const ro = (id: string | null) => (id ? `<@&${id}>` : '*Not set*');

  const embed = new EmbedBuilder()
    .setTitle('Whitelist Bot Configuration')
    .addFields(
      { name: 'Applications Channel', value: ch(applicationsChannelId), inline: true },
      { name: 'Stats Channel', value: ch(statsChannelId), inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Whitelist Role', value: ro(whitelistRoleId), inline: true },
      { name: 'Staff Role', value: ro(staffRoleId), inline: true },
      { name: 'Mod Role', value: ro(modRoleId), inline: true },
      { name: 'On-Leave Role', value: ro(onLeaveRoleId), inline: true },
      { name: 'Staff Pings', value: staffPingEnabled === '1' ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Admin Panel Channel', value: ch(adminPanelChannelId), inline: true },
    )
    .setColor(0x5865f2);

  await interaction.editReply({ embeds: [embed] });
}
