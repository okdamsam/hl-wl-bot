import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { logger } from '../../lib/logger.js';

export const massroleCommand = new SlashCommandBuilder()
  .setName('massrole')
  .setDescription('Give a role to every member who already has another role')
  .addRoleOption((opt) => opt.setName('if_has_role').setDescription('Only affect members who have this role').setRequired(true))
  .addRoleOption((opt) => opt.setName('give_role').setDescription('Role to grant to matching members').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleMassrole(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: 'You need the Administrator permission to use this command.' });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: 'This command must be used in a server.' });
    return;
  }

  const ifHasRole = interaction.options.getRole('if_has_role', true);
  const giveRole = interaction.options.getRole('give_role', true);

  if (ifHasRole.id === giveRole.id) {
    await interaction.editReply({ content: 'The source and target roles must be different.' });
    return;
  }

  const botMember = guild.members.me ?? (await guild.members.fetchMe());
  if (giveRole.position >= botMember.roles.highest.position) {
    await interaction.editReply({ content: `My highest role must be positioned above <@&${giveRole.id}> to grant it.` });
    return;
  }

  await interaction.editReply({ content: `Fetching members with <@&${ifHasRole.id}>…` });

  let members;
  try {
    members = await guild.members.fetch();
  } catch (err) {
    logger.error('massrole: failed to fetch guild members', err);
    await interaction.editReply({ content: 'Failed to fetch the full member list.' });
    return;
  }

  const targets = members.filter((m) => m.roles.cache.has(ifHasRole.id) && !m.roles.cache.has(giveRole.id));

  if (targets.size === 0) {
    await interaction.editReply({ content: `No members with <@&${ifHasRole.id}> are missing <@&${giveRole.id}>.` });
    return;
  }

  let succeeded = 0;
  const failed: string[] = [];

  for (const member of targets.values()) {
    try {
      await member.roles.add(giveRole.id, `/massrole by ${interaction.user.tag}`);
      succeeded += 1;
    } catch (err) {
      failed.push(member.id);
      logger.error(`massrole: failed to grant role to ${member.id}`, err);
    }
  }

  const summary = [`Granted <@&${giveRole.id}> to **${succeeded}** member(s) who had <@&${ifHasRole.id}>.`];
  if (failed.length > 0) {
    summary.push(`Failed for **${failed.length}**: ${failed.map((id) => `<@${id}>`).join(', ')}`);
  }

  await interaction.editReply({ content: summary.join('\n') });
}
