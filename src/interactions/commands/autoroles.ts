import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type APIMessageComponentEmoji,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getAutoRoles, setAutoRoles, type AutoRoleConfig } from '../../db/queries.js';
import { encode } from '../../lib/customId.js';
import { logger } from '../../lib/logger.js';

export const autorolesCommand = new SlashCommandBuilder()
  .setName('autoroles')
  .setDescription('Configure and post the self-assignable roles panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('embed')
      .setDescription('Post the joinable roles panel')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('Channel where the panel will be posted')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName('configure')
      .setDescription('Manage roles available in the panel')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a joinable role')
          .addRoleOption((option) =>
            option.setName('role').setDescription('Role users can join').setRequired(true),
          )
          .addStringOption((option) =>
            option.setName('label').setDescription('Button text').setMaxLength(80).setRequired(true),
          )
          .addStringOption((option) =>
            option.setName('icon').setDescription('Optional emoji or custom emoji').setMaxLength(100),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('modify')
          .setDescription('Change a joinable role button')
          .addRoleOption((option) =>
            option.setName('role').setDescription('Role to modify').setRequired(true),
          )
          .addStringOption((option) =>
            option.setName('label').setDescription('New button text').setMaxLength(80),
          )
          .addStringOption((option) =>
            option.setName('icon').setDescription('New emoji or custom emoji').setMaxLength(100),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a joinable role button')
          .addRoleOption((option) =>
            option.setName('role').setDescription('Role to remove').setRequired(true),
          ),
      ),
  );

export async function handleAutoroles(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply('You need the Administrator permission to use this command.');
    return;
  }

  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  if (group === 'configure') {
    const role = interaction.options.getRole('role', true);
    const roles = getAutoRoles();
    const existingIndex = roles.findIndex((entry) => entry.roleId === role.id);

    if (subcommand === 'add') {
      if (role.id === interaction.guild.id) {
        await interaction.editReply('The @everyone role cannot be self-assigned.');
        return;
      }
      if (existingIndex !== -1) {
        await interaction.editReply('That role is already configured. Use `modify` to change it.');
        return;
      }
      if (roles.length >= 25) {
        await interaction.editReply('Discord panels support at most 25 role buttons. Remove a role before adding another.');
        return;
      }
      const label = interaction.options.getString('label', true).trim();
      if (!label) {
        await interaction.editReply('Button text cannot be empty.');
        return;
      }
      const emoji = interaction.options.getString('icon');
      roles.push({ roleId: role.id, label, ...(emoji ? { emoji } : {}) });
      setAutoRoles(roles);
      await interaction.editReply(`Added **${label}** for <@&${role.id}>. Run /autoroles embed to post the updated panel.`);
      return;
    }

    if (subcommand === 'modify') {
      if (existingIndex === -1) {
        await interaction.editReply('That role is not configured. Use `add` first.');
        return;
      }
      const label = interaction.options.getString('label');
      const emoji = interaction.options.getString('icon');
      if (label === null && emoji === null) {
        await interaction.editReply('Provide a new label, icon, or both.');
        return;
      }
      if (label !== null && !label.trim()) {
        await interaction.editReply('Button text cannot be empty.');
        return;
      }
      roles[existingIndex] = {
        ...roles[existingIndex],
        ...(label !== null ? { label: label.trim() } : {}),
        ...(emoji !== null ? { emoji } : {}),
      };
      setAutoRoles(roles);
      await interaction.editReply(`Updated the button for <@&${role.id}>. Run /autoroles embed to post the updated panel.`);
      return;
    }

    if (existingIndex === -1) {
      await interaction.editReply('That role is not configured.');
      return;
    }
    setAutoRoles(roles.filter((entry) => entry.roleId !== role.id));
    await interaction.editReply(`Removed <@&${role.id}> from the role panel. Existing panel messages will remain unchanged.`);
    return;
  }

  const channelId = interaction.options.getChannel('channel', true).id;
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !('send' in channel)) {
    await interaction.editReply('That channel could not be found or cannot accept messages.');
    return;
  }

  const roles = getAutoRoles();
  if (roles.length === 0) {
    await interaction.editReply('No joinable roles are configured. Use `/autoroles configure add` first.');
    return;
  }

  try {
    const message = await channel.send({
      embeds: [buildAutorolesEmbed()],
      components: buildAutorolesRows(roles),
    });
    logger.info(`Autoroles panel posted in channel ${channel.id} (message ${message.id})`);
    await interaction.editReply(`Joinable roles panel posted in <#${channel.id}>.`);
  } catch (err) {
    logger.error(`Failed to post autoroles panel in channel ${channel.id}`, err);
    await interaction.editReply('Failed to post the panel. Check that the bot can view the channel, send messages, and embed links.');
  }
}

function buildAutorolesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Joinable Roles')
    .setDescription('Choose a role below to add it to your profile. Press the button again to remove it.')
    .setColor(0x57a773);
}

function buildAutorolesRows(roles: AutoRoleConfig[]): ActionRowBuilder<ButtonBuilder>[] {
  const buttons = roles.map((role) => {
    const button = new ButtonBuilder()
      .setCustomId(encode('autoroles', 'toggle', role.roleId))
      .setLabel(role.label)
      .setStyle(ButtonStyle.Secondary);
    if (role.emoji) button.setEmoji(toComponentEmoji(role.emoji));
    return button;
  });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(index, index + 5)));
  }
  return rows;
}

function toComponentEmoji(value: string): APIMessageComponentEmoji {
  const customEmoji = value.match(/^<(a?):([^:]+):(\d+)>$/);
  if (!customEmoji) return { name: value };
  return {
    name: customEmoji[2],
    id: customEmoji[3],
    ...(customEmoji[1] ? { animated: true } : {}),
  };
}