// Staff control panel builders for the application state machine.
// Each function returns message options compatible with both thread.send() and interaction.editReply().

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { encode } from '../lib/customId.js';

type PanelMessage = {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
};

/** Initial panel posted when the application thread is created. Shows the Claim button. */
export function buildPendingPanel(applicationId: number, applicantId: string): PanelMessage {
  const embed = new EmbedBuilder()
    .setTitle('New Application — Pending Review')
    .setDescription(`<@${applicantId}> has submitted a whitelist application.\nClaim it to start the review once they have answered all four questions.`)
    .setColor(0xfee75c)
    .setFooter({ text: `Application #${applicationId}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encode('wl', 'claim', String(applicationId)))
      .setLabel('Claim')
      .setStyle(ButtonStyle.Primary),
  );

  return { embeds: [embed], components: [row] };
}

/** Panel shown after a staff member claims the application. Shows Accept / Deny buttons. */
export function buildClaimedPanel(
  applicationId: number,
  applicantId: string,
  staffId: string,
): PanelMessage {
  const embed = new EmbedBuilder()
    .setTitle('Application — In Review')
    .setDescription(`Claimed by <@${staffId}>`)
    .addFields({ name: 'Applicant', value: `<@${applicantId}>`, inline: true })
    .setColor(0x5865f2)
    .setFooter({ text: `Application #${applicationId}` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encode('wl', 'decide', 'accept', String(applicationId)))
      .setLabel('✓ Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(encode('wl', 'decide', 'deny-req', String(applicationId)))
      .setLabel('✗ Deny — Requirements')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(encode('wl', 'decide', 'deny-exp', String(applicationId)))
      .setLabel('✗ Deny — Expectations')
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row] };
}

/** Final panel shown after an application is accepted or denied. No interactive buttons. */
export function buildDecidedPanel(
  applicationId: number,
  applicantId: string,
  staffId: string,
  outcome: 'approved' | 'denied_requirements' | 'denied_expectations',
): PanelMessage {
  const config = {
    approved: { title: 'Application — Approved', color: 0x57f287, icon: '✓' },
    denied_requirements: { title: 'Application — Denied', color: 0xed4245, icon: '✗' },
    denied_expectations: { title: 'Application — Denied', color: 0xed4245, icon: '✗' },
  } as const;

  const { title, color, icon } = config[outcome];

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`${icon} Decided by <@${staffId}>`)
    .addFields({ name: 'Applicant', value: `<@${applicantId}>`, inline: true })
    .setColor(color)
    .setFooter({ text: `Application #${applicationId}` })
    .setTimestamp();

  return { embeds: [embed], components: [] };
}
