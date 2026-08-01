import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { setConfig } from '../../db/queries.js';
import { logger } from '../../lib/logger.js';

export const wlSetupCommand = new SlashCommandBuilder()
  .setName('wl-setup')
  .setDescription('Configure the whitelist bot')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('applications-channel')
      .setDescription('Channel where application threads are created')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('The applications channel')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('stats-channel')
      .setDescription('Channel where the stats embed lives')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('The stats channel')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('whitelist-role')
      .setDescription('Role granted on application approval')
      .addRoleOption((opt) =>
        opt.setName('role').setDescription('The whitelist role').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('staff-role')
      .setDescription('Role that can claim and decide applications')
      .addRoleOption((opt) =>
        opt.setName('role').setDescription('The staff role').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('mod-role')
      .setDescription('Role whose members are silently added to every new application thread')
      .addRoleOption((opt) =>
        opt.setName('role').setDescription('The mod role').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('on-leave-role')
      .setDescription('Members with this role are excluded from new-application pings')
      .addRoleOption((opt) =>
        opt.setName('role').setDescription('The on-leave role').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('staff-ping')
      .setDescription('Enable or disable per-member pings when a new application arrives')
      .addStringOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('on = ping active staff, off = no pings')
          .setRequired(true)
          .addChoices({ name: 'on', value: '1' }, { name: 'off', value: '0' })
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('admin-panel-channel')
      .setDescription('Channel where the live pending-applications panel is posted')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('The admin panel channel')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  );

export async function handleWlSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: 'You need the Administrator permission to use this command.' });
    return;
  }

  const sub = interaction.options.getSubcommand();

  try {
    switch (sub) {
      case 'applications-channel': {
        const channel = interaction.options.getChannel('channel', true);
        setConfig('applications_channel_id', channel.id);
        await interaction.editReply(`Applications channel set to <#${channel.id}>.`);
        break;
      }
      case 'stats-channel': {
        const channel = interaction.options.getChannel('channel', true);
        setConfig('stats_channel_id', channel.id);
        await interaction.editReply(`Stats channel set to <#${channel.id}>.`);
        break;
      }
      case 'whitelist-role': {
        const role = interaction.options.getRole('role', true);
        setConfig('whitelist_role_id', role.id);
        await interaction.editReply(`Whitelist role set to <@&${role.id}>.`);
        break;
      }
      case 'staff-role': {
        const role = interaction.options.getRole('role', true);
        setConfig('staff_role_id', role.id);
        await interaction.editReply(`Staff role set to <@&${role.id}>.`);
        break;
      }
      case 'mod-role': {
        const role = interaction.options.getRole('role', true);
        setConfig('mod_role_id', role.id);
        await interaction.editReply(`Mod role set to <@&${role.id}>. Members of this role will be added to new application threads silently.`);
        break;
      }
      case 'on-leave-role': {
        const role = interaction.options.getRole('role', true);
        setConfig('on_leave_role_id', role.id);
        await interaction.editReply(`On-leave role set to <@&${role.id}>. Members with this role will be skipped when pinging staff.`);
        break;
      }
      case 'staff-ping': {
        const val = interaction.options.getString('enabled', true);
        setConfig('staff_ping_enabled', val);
        await interaction.editReply(`Staff pings are now **${val === '1' ? 'enabled' : 'disabled'}**.`);
        break;
      }
      case 'admin-panel-channel': {
        const channel = interaction.options.getChannel('channel', true);
        setConfig('admin_panel_channel_id', channel.id);
        setConfig('admin_panel_message_id', '');
        await interaction.editReply(`Admin panel channel set to <#${channel.id}>. Run \`/wl-admin-panel\` to post the panel.`);
        break;
      }
    }
  } catch (err) {
    logger.error(`wl-setup/${sub} failed`, err);
    await interaction.editReply('An error occurred while saving the configuration.').catch(() => null);
  }
}
