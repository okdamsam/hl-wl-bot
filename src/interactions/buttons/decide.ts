import {
  ActionRowBuilder,
  EmbedBuilder,
  GuildMemberRoleManager,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from 'discord.js';
import { decode, encode } from '../../lib/customId.js';
import {
  decideApplication,
  getClaimedBy,
  getConfig,
  insertDecision,
} from '../../db/queries.js';
import { buildDecidedPanel } from '../../services/applications.js';import { refreshAdminPanel } from '../../services/admin-panel.js';import { logger } from '../../lib/logger.js';

function staffCheck(interaction: ButtonInteraction): boolean {
  const staffRoleId = getConfig('staff_role_id');
  if (!staffRoleId) return true;
  const roles = interaction.member?.roles;
  const roleIds =
    roles instanceof GuildMemberRoleManager
      ? [...roles.cache.keys()]
      : (roles as string[]) ?? [];
  return roleIds.includes(staffRoleId);
}

export async function handleDecide(interaction: ButtonInteraction): Promise<void> {
  const [, , outcome, appIdStr] = decode(interaction.customId);
  const applicationId = parseInt(appIdStr, 10);

  // ── Accept ──────────────────────────────────────────────────────────────────
  if (outcome === 'accept') {
    await interaction.deferUpdate();

    if (!staffCheck(interaction)) {
      await interaction.followUp({ content: 'You need the staff role to decide applications.', flags: MessageFlags.Ephemeral });
      return;
    }

    const claimedBy = getClaimedBy(applicationId);
    if (claimedBy !== interaction.user.id) {
      await interaction.followUp({ content: 'Only the staff member who claimed this application can decide it.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Conditional write: claimed → approved (changes === 0 means race-lost)
    const applicantId = decideApplication(applicationId, 'approved');
    if (!applicantId) {
      await interaction.followUp({ content: 'This application has already been decided.', flags: MessageFlags.Ephemeral });
      return;
    }

    insertDecision(applicationId, interaction.user.id, 'approved', Math.floor(Date.now() / 1000));

    // Grant whitelist role — wrap separately so a role failure never loses the decision
    const whitelistRoleId = getConfig('whitelist_role_id');
    if (whitelistRoleId) {
      try {
        const member = await interaction.guild!.members.fetch(applicantId);
        await member.roles.add(whitelistRoleId);
      } catch (err) {
        logger.error(`Failed to grant whitelist role to ${applicantId} for app ${applicationId}`, err);
        if (interaction.channel?.isThread()) {
          await interaction.channel.send(
            `⚠️ **Action required:** Could not grant the whitelist role to <@${applicantId}> automatically. Please grant it manually.`
          );
        }
      }
    }

    await interaction.editReply(buildDecidedPanel(applicationId, applicantId, interaction.user.id, 'approved'));

    // DM the applicant
    try {
      const applicantUser = await interaction.client.users.fetch(applicantId);
      await applicantUser.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('Whitelist Application — Approved')
            .setDescription('Congratulations! Your whitelist application has been approved. Welcome to the server.')
            .setColor(0x57f287)
            .setFooter({ text: `Application #${applicationId}` }),
        ],
      });
    } catch (err) {
      logger.warn(`Could not DM applicant ${applicantId} for app ${applicationId} — DMs may be closed`, err);
    }

    const thread = interaction.channel;
    if (thread?.isThread()) {
      const base = thread.name.match(/wl-.*/)?.[0] ?? thread.name;
      await thread.setName(`accepted-${base}`.slice(0, 100)).catch((e: unknown) =>
        logger.error(`Failed to rename thread ${thread.id}`, e)
      );
      await thread.setLocked(true).catch((e: unknown) => logger.error(`Lock failed for thread ${thread.id}`, e));
      await thread.setArchived(true).catch((e: unknown) => logger.error(`Archive failed for thread ${thread.id}`, e));
    }

    logger.info(`Application ${applicationId} approved by ${interaction.user.id}`);
    refreshAdminPanel(interaction.client).catch((e: unknown) =>
      logger.error('Failed to refresh admin panel after approve', e)
    );
    return;
  }

  // ── Deny (Requirements or Expectations) ────────────────────────────────────
  // showModal() is the acknowledgment — no deferUpdate before it.

  if (!staffCheck(interaction)) {
    await interaction.reply({ content: 'You need the staff role to decide applications.', flags: MessageFlags.Ephemeral });
    return;
  }

  const claimedBy = getClaimedBy(applicationId);
  if (claimedBy !== interaction.user.id) {
    await interaction.reply({ content: 'Only the staff member who claimed this application can decide it.', flags: MessageFlags.Ephemeral });
    return;
  }

  const title = outcome === 'deny-req' ? 'Deny — Requirements' : 'Deny — Expectations';
  const modal = new ModalBuilder()
    .setCustomId(encode('wl', 'decide', outcome, appIdStr, interaction.message.id))
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('note')
          .setLabel('Denial reason — sent to applicant via DM')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000)
          .setPlaceholder('This message will be DM’d to the applicant. Leave blank to send no message.')
      )
    );

  await interaction.showModal(modal);
}
