import {
  SlashCommandBuilder,
  EmbedBuilder,
  GuildMemberRoleManager,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getConfig, getStaffStats } from '../../db/queries.js';

export const wlStatsCommand = new SlashCommandBuilder()
  .setName('wl-stats')
  .setDescription('Show per-staff decision counts (ephemeral).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleWlStats(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Staff / mod role gate
  const staffRoleId = getConfig('staff_role_id');
  const modRoleId = getConfig('mod_role_id');
  const roles = interaction.member?.roles;
  const roleIds =
    roles instanceof GuildMemberRoleManager
      ? [...roles.cache.keys()]
      : (roles as string[]) ?? [];
  const hasAccess =
    (staffRoleId && roleIds.includes(staffRoleId)) ||
    (modRoleId && roleIds.includes(modRoleId)) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  if (!hasAccess) {
    await interaction.editReply({ content: 'You need the staff or mod role to view stats.' });
    return;
  }

  const rows = getStaffStats();

  if (rows.length === 0) {
    await interaction.editReply({ content: 'No decisions have been recorded yet.' });
    return;
  }

  const lines = rows.map((r) => {
    const name = `<@${r.staff_id}>`;
    return `${name} — **${r.approved}** approved / **${r.deny_req}** deny-req / **${r.deny_exp}** deny-exp  *(${r.total} total)*`;
  });

  const embed = new EmbedBuilder()
    .setTitle('Staff Decision Counts (All Time)')
    .setDescription(lines.join('\n'))
    .setColor(0x5865f2)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
