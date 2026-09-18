import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js';
import {
  archiveTeam,
  createTeam,
  getActiveTeams,
  getTeam,
  getTeamManagers,
  getTeamMembers,
  isTeamManager,
  removeTeamManager,
  removeTeamMember,
  setTeamManager,
  upsertTeamMember,
  updateTeamMemberRole,
  type TeamRole,
} from '../../db/queries.js';

const teamRoleChoices = [
  { name: 'Leader', value: 'leader' },
  { name: 'Senior', value: 'senior' },
  { name: 'Member', value: 'member' },
];

export const teamCommand = new SlashCommandBuilder()
  .setName('team')
  .setDescription('Manage modular team rosters')
  .addSubcommand((sub) => sub.setName('list').setDescription('List active teams'))
  .addSubcommand((sub) =>
    sub.setName('create').setDescription('Create a team')
      .addStringOption((opt) => opt.setName('slug').setDescription('URL-safe team identifier').setRequired(true))
      .addStringOption((opt) => opt.setName('name').setDescription('Public team name').setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub.setName('archive').setDescription('Archive a team')
      .addStringOption((opt) => opt.setName('team').setDescription('Team slug').setRequired(true).setAutocomplete(true)),
  )
  .addSubcommandGroup((group) =>
    group.setName('manager').setDescription('Manage team managers')
      .addSubcommand((sub) => sub.setName('set').setDescription('Assign a team manager')
        .addStringOption((opt) => opt.setName('team').setDescription('Team slug').setRequired(true).setAutocomplete(true))
        .addUserOption((opt) => opt.setName('member').setDescription('Manager').setRequired(true)))
      .addSubcommand((sub) => sub.setName('remove').setDescription('Remove a team manager')
        .addStringOption((opt) => opt.setName('team').setDescription('Team slug').setRequired(true).setAutocomplete(true))
        .addUserOption((opt) => opt.setName('member').setDescription('Manager').setRequired(true)))
      .addSubcommand((sub) => sub.setName('list').setDescription('List team managers')
        .addStringOption((opt) => opt.setName('team').setDescription('Team slug').setRequired(true).setAutocomplete(true))),
  )
  .addSubcommandGroup((group) =>
    group.setName('member').setDescription('Manage team members')
      .addSubcommand((sub) => sub.setName('add').setDescription('Add or update a team member')
        .addStringOption((opt) => opt.setName('team').setDescription('Team slug').setRequired(true).setAutocomplete(true))
        .addUserOption((opt) => opt.setName('member').setDescription('Discord member').setRequired(true))
        .addStringOption((opt) => opt.setName('role').setDescription('Team position').setRequired(true).addChoices(...teamRoleChoices))
        .addStringOption((opt) => opt.setName('speciality').setDescription('Optional speciality').setRequired(false)))
      .addSubcommand((sub) => sub.setName('remove').setDescription('Remove a team member')
        .addStringOption((opt) => opt.setName('team').setDescription('Team slug').setRequired(true).setAutocomplete(true))
        .addUserOption((opt) => opt.setName('member').setDescription('Discord member').setRequired(true)))
      .addSubcommand((sub) => sub.setName('role').setDescription('Change a team member role')
        .addStringOption((opt) => opt.setName('team').setDescription('Team slug').setRequired(true).setAutocomplete(true))
        .addUserOption((opt) => opt.setName('member').setDescription('Discord member').setRequired(true))
        .addStringOption((opt) => opt.setName('role').setDescription('New team position').setRequired(true).addChoices(...teamRoleChoices))
        .addStringOption((opt) => opt.setName('speciality').setDescription('Optional new speciality').setRequired(false)))
      .addSubcommand((sub) => sub.setName('list').setDescription('List team members')
        .addStringOption((opt) => opt.setName('team').setDescription('Team slug').setRequired(true).setAutocomplete(true))),
  );

function isAdministrator(interaction: ChatInputCommandInteraction): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

function validSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export async function handleTeam(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  if (!group && subcommand === 'list') {
    const teams = getActiveTeams();
    await interaction.editReply(teams.length === 0
      ? 'No active teams.'
      : teams.map((team) => `**${team.display_name}** (${team.slug})`).join('\n'));
    return;
  }

  if (!group && subcommand === 'create') {
    if (!isAdministrator(interaction)) {
      await interaction.editReply('You need the Administrator permission to create teams.');
      return;
    }
    const slug = interaction.options.getString('slug', true).toLowerCase();
    const displayName = interaction.options.getString('name', true).trim();
    if (!validSlug(slug) || displayName.length === 0) {
      await interaction.editReply('Use a URL-safe slug and a non-empty team name.');
      return;
    }
    try {
      createTeam(slug, displayName);
      await interaction.editReply(`Created team **${slug}**.`);
    } catch {
      await interaction.editReply('That team slug already exists.');
    }
    return;
  }

  if (!group && subcommand === 'archive') {
    if (!isAdministrator(interaction)) {
      await interaction.editReply('You need the Administrator permission to archive teams.');
      return;
    }
    const slug = interaction.options.getString('team', true).toLowerCase();
    await interaction.editReply(archiveTeam(slug) ? `Archived team **${slug}**.` : 'Active team not found.');
    return;
  }

  const slug = interaction.options.getString('team', true).toLowerCase();
  const team = getTeam(slug);
  if (!team || !team.active) {
    await interaction.editReply('Active team not found.');
    return;
  }

  if (group === 'manager') {
    if (!isAdministrator(interaction)) {
      await interaction.editReply('Only administrators can change or view team managers.');
      return;
    }
    if (subcommand === 'set') {
      const member = interaction.options.getUser('member', true);
      setTeamManager(team.id, member.id);
      await interaction.editReply(`<@${member.id}> can now manage **${team.display_name}**.`);
    } else if (subcommand === 'remove') {
      const member = interaction.options.getUser('member', true);
      await interaction.editReply(removeTeamManager(team.id, member.id)
        ? `Removed <@${member.id}> as a manager.`
        : 'That user is not a manager for this team.');
    } else {
      const managers = getTeamManagers(team.id);
      await interaction.editReply(managers.length === 0 ? 'No managers configured.' : managers.map((id) => `<@${id}>`).join(', '));
    }
    return;
  }

  if (group === 'member') {
    if (!isAdministrator(interaction) && !isTeamManager(team.id, interaction.user.id)) {
      await interaction.editReply('You must be an administrator or a manager of this team.');
      return;
    }
    if (subcommand === 'list') {
      const members = getTeamMembers(team.id);
      await interaction.editReply(members.length === 0
        ? 'No members configured.'
        : members.map((member) => `<@${member.discord_user_id}> - ${member.team_role}${member.speciality ? ` (${member.speciality})` : ''}`).join('\n'));
      return;
    }
    const member = interaction.options.getUser('member', true);
    if (subcommand === 'add') {
      const role = interaction.options.getString('role', true) as TeamRole;
      const speciality = interaction.options.getString('speciality', false)?.trim() || null;
      upsertTeamMember(team.id, member.id, member.globalName ?? member.username, role, speciality);
      await interaction.editReply(`Added <@${member.id}> to **${team.display_name}** as **${role}**.`);
    } else if (subcommand === 'role') {
      const role = interaction.options.getString('role', true) as TeamRole;
      const speciality = interaction.options.getString('speciality', false)?.trim();
      await interaction.editReply(updateTeamMemberRole(team.id, member.id, role, speciality)
        ? `Updated <@${member.id}> to **${role}**${speciality ? ` with speciality **${speciality}**` : ''} on **${team.display_name}**.`
        : 'That user is not on this team.');
    } else {
      await interaction.editReply(removeTeamMember(team.id, member.id)
        ? `Removed <@${member.id}> from **${team.display_name}**.`
        : 'That user is not on this team.');
    }
  }
}

export async function handleTeamAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = getActiveTeams()
    .filter((team) => team.slug.includes(focused) || team.display_name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((team) => ({ name: `${team.display_name} (${team.slug})`, value: team.slug }));
  await interaction.respond(choices);
}