import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { setConfig, getRoleIds, addRoleId, removeRoleId } from '../../db/queries.js';
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
  .addSubcommandGroup((group) =>
    group
      .setName('staff-role')
      .setDescription('Roles that can claim and decide applications')
      .addSubcommand((sub) =>
        sub.setName('add').setDescription('Add a role to the staff list')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to add').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub.setName('remove').setDescription('Remove a role from the staff list')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub.setName('list').setDescription('List configured staff roles')
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName('mod-role')
      .setDescription('Roles whose members are silently added to every new application thread')
      .addSubcommand((sub) =>
        sub.setName('add').setDescription('Add a role to the mod list')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to add').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub.setName('remove').setDescription('Remove a role from the mod list')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub.setName('list').setDescription('List configured mod roles')
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName('on-leave-role')
      .setDescription('Members with any of these roles are excluded from new-application pings')
      .addSubcommand((sub) =>
        sub.setName('add').setDescription('Add a role to the on-leave list')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to add').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub.setName('remove').setDescription('Remove a role from the on-leave list')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub.setName('list').setDescription('List configured on-leave roles')
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

  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  try {
    // ── Multi-role subcommand groups ──────────────────────────────────────────
    if (group) {
      const keyMap: Record<string, string> = {
        'staff-role': 'staff_role_ids',
        'mod-role': 'mod_role_ids',
        'on-leave-role': 'on_leave_role_ids',
      };
      const labelMap: Record<string, string> = {
        'staff-role': 'Staff',
        'mod-role': 'Mod',
        'on-leave-role': 'On-leave',
      };
      const key = keyMap[group];
      const label = labelMap[group];
      switch (sub) {
        case 'add': {
          const role = interaction.options.getRole('role', true);
          addRoleId(key, role.id);
          await interaction.editReply(`Added <@&${role.id}> to the ${label.toLowerCase()} role list.`);
          break;
        }
        case 'remove': {
          const role = interaction.options.getRole('role', true);
          removeRoleId(key, role.id);
          await interaction.editReply(`Removed <@&${role.id}> from the ${label.toLowerCase()} role list.`);
          break;
        }
        case 'list': {
          const ids = getRoleIds(key);
          await interaction.editReply(
            ids.length === 0
              ? `No ${label.toLowerCase()} roles configured.`
              : `${label} roles: ${ids.map((id) => `<@&${id}>`).join(', ')}`,
          );
          break;
        }
      }
      return;
    }

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
