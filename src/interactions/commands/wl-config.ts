import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getConfig, getRoleIds } from '../../db/queries.js';

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
  const staffRoleIds = getRoleIds('staff_role_ids');
  const modRoleIds = getRoleIds('mod_role_ids');
  const onLeaveRoleIds = getRoleIds('on_leave_role_ids');
  const staffPingEnabled = getConfig('staff_ping_enabled') ?? '1';
  const adminPanelChannelId = getConfig('admin_panel_channel_id');

  const ch = (id: string | null) => (id ? `<#${id}>` : '*Not set*');
  const ro = (id: string | null) => (id ? `<@&${id}>` : '*Not set*');
  const ros = (ids: string[]) => ids.length > 0 ? ids.map((id) => `<@&${id}>`).join(', ') : '*Not set*';

  const embed = new EmbedBuilder()
    .setTitle('Whitelist Bot Configuration')
    .addFields(
      { name: 'Applications Channel', value: ch(applicationsChannelId), inline: true },
      { name: 'Stats Channel', value: ch(statsChannelId), inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Whitelist Role', value: ro(whitelistRoleId), inline: true },
      { name: 'Staff Roles', value: ros(staffRoleIds), inline: true },
      { name: 'Mod Roles', value: ros(modRoleIds), inline: true },
      { name: 'On-Leave Roles', value: ros(onLeaveRoleIds), inline: true },
      { name: 'Staff Pings', value: staffPingEnabled === '1' ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Admin Panel Channel', value: ch(adminPanelChannelId), inline: true },
    )
    .setColor(0x5865f2);

  await interaction.editReply({ embeds: [embed] });
}
