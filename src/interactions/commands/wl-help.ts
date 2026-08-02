import {
  SlashCommandBuilder,
  EmbedBuilder,
  GuildMemberRoleManager,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getConfig } from '../../db/queries.js';

export const wlHelpCommand = new SlashCommandBuilder()
  .setName('wl-help')
  .setDescription('Show the staff review workflow (ephemeral).');

export async function handleWlHelp(interaction: ChatInputCommandInteraction): Promise<void> {
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
    await interaction.editReply({ content: 'You need the staff or mod role to use this command.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Staff Review Workflow')
    .setColor(0x5865f2)
    .addFields(
      {
        name: '1. Claim the application',
        value:
          'Open the application thread and click **Claim**. This locks the application to you — no one else can decide it until you release it. ' +
          'Only one person should work a ticket at a time.',
      },
      {
        name: '2. Review the answers',
        value:
          'Read the applicant\'s responses. Use `/wl-rubric` for the full grading guide. ' +
          'If something is unclear, ask in the thread before deciding.',
      },
      {
        name: '3. Decide',
        value:
          '**Accept** — meets requirements and expectations. Role is granted automatically.\n' +
          '**Deny (Requirements)** — objective shortfall: under the hours bar, undisclosed ban, missing screenshot, or incomplete answers.\n' +
          '**Deny (Expectations)** — subjective fail: answers show poor RP understanding, blame-shifting on death, or main character behaviour.\n\n' +
          'Both deny buttons open a note box. Fill it in — your reasoning goes on record and keeps reviewers consistent.',
      },
      {
        name: 'Commands',
        value:
          '`/wl-rubric` — grading criteria for each question\n' +
          '`/wl-stats` — per-staff decision counts\n' +
          '`/wl-cancel` — cancel an active application (admin use)',
      },
    )
    .setFooter({ text: 'When in doubt, ask a follow-up in the thread before denying.' });

  await interaction.editReply({ embeds: [embed] });
}
