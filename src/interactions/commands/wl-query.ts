import {
  SlashCommandBuilder,
  EmbedBuilder,
  GuildMemberRoleManager,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getConfig, queryByUsername } from '../../db/queries.js';

export const wlQueryCommand = new SlashCommandBuilder()
  .setName('wl-query')
  .setDescription('Search applications by SS14 username.')
  .addStringOption((opt) =>
    opt.setName('username').setDescription('SS14 in-game username to search for').setRequired(true)
  );

export async function handleWlQuery(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
    await interaction.editReply({ content: 'You need the staff or mod role to use this command.' });
    return;
  }

  const search = interaction.options.getString('username', true).trim();
  const rows = queryByUsername(search);

  if (rows.length === 0) {
    await interaction.editReply({ content: `No applications found matching \`${search}\`.` });
    return;
  }

  const statusEmoji: Record<string, string> = {
    pending: '🟡',
    claimed: '🔵',
    approved: '🟢',
    denied_requirements: '🔴',
    denied_expectations: '🔴',
    cancelled: '⚫',
  };

  const lines = rows.map((r) => {
    const emoji = statusEmoji[r.status] ?? '⚪';
    const thread = r.thread_id ? ` — <#${r.thread_id}>` : '';
    return `${emoji} **#${r.id}** \`${r.username ?? '—'}\` — <@${r.applicant_id}> — \`${r.status}\` — <t:${r.created_at}:d>${thread}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`Query: "${search}"`)
    .setDescription(lines.join('\n'))
    .setColor(0x5865f2)
    .setFooter({ text: `${rows.length} result${rows.length === 1 ? '' : 's'}` });

  await interaction.editReply({ embeds: [embed] });
}
