import { GuildMemberRoleManager, MessageFlags, type ButtonInteraction } from 'discord.js';
import { getAutoRoles } from '../../db/queries.js';
import { decode } from '../../lib/customId.js';
import { logger } from '../../lib/logger.js';

export async function handleAutoroleToggle(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.editReply('This button only works in a server.');
    return;
  }

  const [, , roleId] = decode(interaction.customId);
  const role = getAutoRoles().find((entry) => entry.roleId === roleId);
  if (!role) {
    await interaction.editReply('This role is no longer available.');
    return;
  }

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const roles = member.roles;
    const hasRole = roles instanceof GuildMemberRoleManager
      ? roles.cache.has(roleId)
      : (roles as string[]).includes(roleId);

    if (hasRole) {
      await member.roles.remove(roleId);
      await interaction.editReply(`Removed **${role.label}** from your roles.`);
    } else {
      await member.roles.add(roleId);
      await interaction.editReply(`Added **${role.label}** to your roles.`);
    }
  } catch (err) {
    logger.error(`Failed to toggle autorole ${roleId} for member ${interaction.user.id}`, err);
    await interaction.editReply('I could not update that role. It may have been deleted, or the bot may lack permission to manage it.');
  }
}