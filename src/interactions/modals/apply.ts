import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  type ModalSubmitInteraction,
  type TextChannel,
} from 'discord.js';
import { CUSTOM_IDS } from '../../lib/customId.js';
import {
  deleteApplication,
  getConfig,
  insertApplication,
  updateApplicationThread,
} from '../../db/queries.js';
import { buildPendingPanel } from '../../services/applications.js';
import { refreshAdminPanel } from '../../services/admin-panel.js';
import { logger } from '../../lib/logger.js';

function truncate(text: string, max = 1024): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function buildQuestionsEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Thanks for applying.')
    .setDescription(
      'Answer the four questions below in this thread — one message per question is fine, or one long post, whichever you prefer.\n\n' +
      "Take your time. There's no clock on this, and we'd rather wait a day for a considered answer than get one in ten minutes. " +
      'A staff member will pick this up once you have answered all four.',
    )
    .addFields(
      {
        name: 'Question 1 — Your character',
        value:
          'Tell us about a character you intend to play here.\n' +
          '- What are they competent at?\n' +
          '- What are they bad at, or simply wrong about?\n' +
          '- Name one specific situation where this character would make things **worse** rather than better.\n\n' +
          'We are not looking for someone who is the best at their job.',
      },
      {
        name: 'Question 2 — In character',
        value:
          "Mid-shift, your character is approached by someone offering 15,000 spesos in cash for the SCAF hardsuit your character is wearing. The offer is serious and the buyer is in a hurry.\n\n" +
          'Write your character\'s response **exactly as you would type it in game.** Use emotes, and make it clear whether you\'re speaking aloud, using the radio, or whispering.\n\n' +
          "We're reading for how you write in character — not for whether you take the deal.",
      },
      {
        name: 'Question 3 — Losing',
        value:
          "You take a ship out on expedition alone. You don't tell anyone where you're going. The enemies there turn out to be far more than you can handle and they kill your character. Nobody knows your location. Nobody is coming. Your ship is gone with you.\n\n" +
          'You are round-removed with most of the shift still to go.\n\n' +
          'What do you do, and how do you actually feel about it?\n\n' +
          "Be honest here. We're more interested in your real reaction than the answer you think we want to hear.",
      },
      {
        name: 'Question 4 — Scenario',
        value:
          "You're playing a Research Assistant. Your character has no combat training and has never been in a fight.\n\n" +
          "Outside the game, you main Security. You're one of the stronger combat players on the server and you know it.\n\n" +
          'Nuclear operatives have boarded. Science has finished the full research tree, and you personally have the materials and the know-how to kit yourself out and go fight them. You would probably win.\n\n' +
          '- What does your character do?\n' +
          '- Explain the difference between what **you** could do here and what your **character** would do.',
      },
    )
    .setColor(0x5865f2);
}

export async function handleApplyModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.editReply('This can only be used in a server.');
    return;
  }

  // ── Extract fields ──────────────────────────────────────────────────────────
  const username = interaction.fields.getTextInputValue(CUSTOM_IDS.FIELD_USERNAME);
  const playtime = interaction.fields.getTextInputValue(CUSTOM_IDS.FIELD_PLAYTIME);
  const banned = interaction.fields.getTextInputValue(CUSTOM_IDS.FIELD_BANNED);
  const age = interaction.fields.getTextInputValue(CUSTOM_IDS.FIELD_AGE);

  const uploadedFiles = interaction.fields.getUploadedFiles(CUSTOM_IDS.FIELD_SCREENSHOTS);

  // ── Insert application row ──────────────────────────────────────────
  const answers = JSON.stringify({ username, playtime, banned, age });
  const applicationId = insertApplication(interaction.user.id, answers);

  // ── Resolve applications channel ────────────────────────────────────────────
  const channelId = getConfig('applications_channel_id');
  if (!channelId) {
    deleteApplication(applicationId);
    await interaction.editReply('The applications channel is not configured. Contact an administrator.');
    return;
  }

  let appsChannel: TextChannel;
  try {
    const fetched = await interaction.guild.channels.fetch(channelId);
    if (!fetched || fetched.type !== ChannelType.GuildText) throw new Error('Not a text channel');
    appsChannel = fetched as TextChannel;
  } catch (err) {
    logger.error(`Could not fetch applications channel ${channelId} for app ${applicationId}`, err);
    deleteApplication(applicationId);
    await interaction.editReply('Failed to find the applications channel. Contact an administrator.');
    return;
  }

  // ── Create private thread ───────────────────────────────────────────────────
  const threadName = `NEW-wl-${interaction.user.username}`.slice(0, 100);
  let thread;
  try {
    thread = await appsChannel.threads.create({
      name: threadName,
      type: ChannelType.PrivateThread,
      invitable: false,
    });
  } catch (err) {
    logger.error(`Thread creation failed for app ${applicationId}`, err);
    deleteApplication(applicationId);
    await interaction.editReply('Failed to create your application thread. Please try again in a moment.');
    return;
  }

  // ── Add members ─────────────────────────────────────────────────────────────
  await thread.members.add(interaction.user.id).catch((err: unknown) => {
    logger.error(`Failed to add applicant ${interaction.user.id} to thread ${thread.id} (app ${applicationId})`, err);
  });


  // ── Post application embed ──────────────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setTitle('Whitelist Application')
    .setAuthor({
      name: interaction.user.displayName,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .addFields(
      { name: 'SS14 username', value: username, inline: true },
      { name: 'SS14 playtime and servers', value: truncate(playtime) },
      { name: 'Currently banned anywhere?', value: truncate(banned) },
      { name: 'Age', value: age, inline: true },
      { name: 'Applicant', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setFooter({ text: `Application #${applicationId}` })
    .setTimestamp()
    .setColor(0x5865f2);

  await thread.send({ embeds: [embed] }).catch((err: unknown) => {
    logger.error(`Failed to post embed in thread ${thread.id} (app ${applicationId})`, err);
  });

  // ── Re-upload screenshots (CDN URLs expire ~24 h) ───────────────────────────
  if (uploadedFiles && uploadedFiles.size > 0) {
    const attachments: AttachmentBuilder[] = [];
    for (const file of uploadedFiles.values()) {
      try {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        attachments.push(new AttachmentBuilder(buffer, { name: file.name }));
      } catch (err) {
        logger.error(`Failed to re-upload attachment "${file.name}" for app ${applicationId}`, err);
      }
    }
    if (attachments.length > 0) {
      await thread.send({ content: '**Screenshots:**', files: attachments }).catch((err: unknown) => {
        logger.error(`Failed to send screenshots to thread ${thread.id} (app ${applicationId})`, err);
      });
    }
  }

  // ── Post opening questions ──────────────────────────────────────────────────
  await thread.send({ embeds: [buildQuestionsEmbed()] }).catch((err: unknown) => {
    logger.error(`Failed to post thread questions for app ${applicationId}`, err);
  });

  // ── Staff control panel (Claim button) ─────────────────────────────────────
  await thread.send(buildPendingPanel(applicationId, interaction.user.id)).catch((err: unknown) => {
    logger.error(`Failed to post pending panel for app ${applicationId}`, err);
  });

  // ── Notify active staff (staff role, excluding on-leave) ────────────────────
  const staffRoleId = getConfig('staff_role_id');
  const pingEnabled = getConfig('staff_ping_enabled') ?? '1';
  if (staffRoleId && pingEnabled === '1') {
    try {
      const onLeaveRoleId = getConfig('on_leave_role_id');
      const allMembers = await interaction.guild.members.fetch();
      const activeStaff = allMembers.filter(
        (m) =>
          m.roles.cache.has(staffRoleId) &&
          (!onLeaveRoleId || !m.roles.cache.has(onLeaveRoleId)),
      );
      if (activeStaff.size > 0) {
        const mentions = activeStaff.map((m) => `<@${m.id}>`).join(' ');
        const notifyMsg = await thread.send(mentions);
        await notifyMsg.edit('New application — use the Claim button above to pick it up.');
      }
    } catch (err) {
      logger.warn(`Failed to send staff notify for app ${applicationId}`, err);
    }
  }

  // ── Store thread ID on the application row ──────────────────────────────────
  try {
    updateApplicationThread(applicationId, thread.id);
  } catch (err) {
    logger.error(`CRITICAL: could not store thread_id for app ${applicationId} (thread ${thread.id})`, err);
  }

  // ── Refresh admin panel ──────────────────────────────────────────────────────
  refreshAdminPanel(interaction.client).catch((err: unknown) =>
    logger.warn(`Failed to refresh admin panel for app ${applicationId}`, err)
  );

  logger.info(`Application ${applicationId} created — thread ${thread.id} — user ${interaction.user.id}`);

  const confirmEmbed = new EmbedBuilder()
    .setTitle('Application Submitted')
    .setDescription(
      `Your thread: ${thread.toString()}\n\nAnswer the four questions posted there to complete your application. A staff member will pick it up once you have.`,
    )
    .addFields(
      { name: 'SS14 username', value: username, inline: true },
      { name: 'SS14 playtime and servers', value: truncate(playtime, 512) },
      { name: 'Currently banned anywhere?', value: truncate(banned, 512) },
    )
    .setColor(0x57f287)
    .setFooter({ text: `Application #${applicationId}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });
}

