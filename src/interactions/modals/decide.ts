import {
  EmbedBuilder,
  GuildMemberRoleManager,
  MessageFlags,
  type ModalSubmitInteraction,
} from 'discord.js';
import { decode } from '../../lib/customId.js';
import { decideApplication, getConfig, insertDecision } from '../../db/queries.js';
import { buildDecidedPanel } from '../../services/applications.js';
import { refreshAdminPanel } from '../../services/admin-panel.js';
import { logger } from '../../lib/logger.js';

const STATUS_MAP = {
  'deny-req': 'denied_requirements',
  'deny-exp': 'denied_expectations',
} as const;

type DenyOutcome = keyof typeof STATUS_MAP;

export async function handleDecideModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [, , outcome, appIdStr, messageId] = decode(interaction.customId);
  const applicationId = parseInt(appIdStr, 10);

  // Staff role gate
  const staffRoleId = getConfig('staff_role_id');
  if (staffRoleId) {
    const roles = interaction.member?.roles;
    const roleIds =
      roles instanceof GuildMemberRoleManager
        ? [...roles.cache.keys()]
        : (roles as string[]) ?? [];
    if (!roleIds.includes(staffRoleId)) {
      await interaction.editReply('You need the staff role to decide applications.');
      return;
    }
  }

  const newStatus = STATUS_MAP[outcome as DenyOutcome];
  if (!newStatus) {
    await interaction.editReply('Unknown denial type.');
    return;
  }

  const note = interaction.fields.getTextInputValue('note').trim() || null;

  // Conditional write: claimed → denied (changes === 0 means race-lost or already decided)
  const applicantId = decideApplication(applicationId, newStatus);
  if (!applicantId) {
    await interaction.editReply('This application has already been decided.');
    return;
  }

  insertDecision(applicationId, interaction.user.id, outcome, Math.floor(Date.now() / 1000), note);

  // Edit the original claim message to show the decided panel (buttons go dark)
  if (messageId && interaction.channel?.isThread()) {
    try {
      const message = await interaction.channel.messages.fetch(messageId);
      await message.edit(buildDecidedPanel(applicationId, applicantId, interaction.user.id, newStatus));
    } catch (err) {
      logger.error(`Failed to edit claim message ${messageId} for app ${applicationId}`, err);
    }
  }

  // DM the applicant
  const dmEmbed = new EmbedBuilder()
    .setTitle('Whitelist Application — Denied')
    .setDescription(
      outcome === 'deny-req'
        ? 'Your application did not meet our requirements at this time.'
        : 'Your application did not meet our expectations for the server at this time.',
    )
    .setColor(0xed4245)
    .setFooter({ text: `Application #${applicationId}` });
  if (note) dmEmbed.addFields({ name: 'Note from staff', value: note });

  try {
    const applicantUser = await interaction.client.users.fetch(applicantId);
    await applicantUser.send({ embeds: [dmEmbed] });
  } catch (err) {
    logger.warn(`Could not DM applicant ${applicantId} for app ${applicationId} — DMs may be closed`, err);
  }

  // Log decision in thread
  const thread = interaction.channel;
  if (thread?.isThread()) {
    const outcomeLabel = outcome === 'deny-req' ? 'Requirements not met' : 'Expectations not met';
    const logLines = [
      `**Denied** by <@${interaction.user.id}> — ${outcomeLabel}`,
    ];
    if (note) logLines.push(`**Message sent to applicant:** ${note}`);
    await thread.send(logLines.join('\n')).catch((e: unknown) =>
      logger.error(`Failed to post denial log for app ${applicationId}`, e)
    );

    // Archive and lock — never delete
    const base = thread.name.match(/wl-.*/)?.[0] ?? thread.name;
    await thread.setName(`denied-${base}`.slice(0, 100)).catch((e: unknown) =>
      logger.error(`Failed to rename thread ${thread.id}`, e)
    );
    await thread.setLocked(true).catch((e: unknown) => logger.error(`Lock failed for thread ${thread.id}`, e));
    await thread.setArchived(true).catch((e: unknown) => logger.error(`Archive failed for thread ${thread.id}`, e));
  }

  logger.info(`Application ${applicationId} ${newStatus} by ${interaction.user.id}`);
  refreshAdminPanel(interaction.client).catch((e: unknown) =>
    logger.error('Failed to refresh admin panel after deny', e)
  );
  await interaction.editReply('Application denied. The thread has been archived.');
}
