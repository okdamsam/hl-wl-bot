// Runs on each new application submission and on unclaim — no polling timer.
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import {
  getConfig,
  setConfig,
  getPendingOnlyCount,
  getOverdueUnalertedApplications,
  markApplicationsAlertedOverdue,
} from '../db/queries.js';
import { logger } from '../lib/logger.js';

const QUEUE_THRESHOLD = 10;
const OVERDUE_SECONDS = 24 * 60 * 60;

export async function runAlertChecks(client: Client): Promise<void> {
  const channelId = getConfig('admin_panel_channel_id');
  const staffRoleId = getConfig('staff_role_id');
  if (!channelId || !staffRoleId) return;

  let channel: TextChannel;
  try {
    const fetched = await client.channels.fetch(channelId);
    if (!fetched?.isTextBased() || !('send' in fetched)) return;
    channel = fetched as TextChannel;
  } catch (err) {
    logger.error('runAlertChecks: failed to fetch admin panel channel', err);
    return;
  }

  await checkQueueAlert(channel, staffRoleId);
  await checkOverdueAlert(channel, staffRoleId);
}

async function checkQueueAlert(channel: TextChannel, staffRoleId: string): Promise<void> {
  const currentCount = getPendingOnlyCount();
  const previousCount = parseInt(getConfig('queue_alert_last_pending_count') ?? '0', 10);

  // Always persist the current count so the transition is detected correctly across restarts.
  setConfig('queue_alert_last_pending_count', String(currentCount));

  if (currentCount >= QUEUE_THRESHOLD && previousCount < QUEUE_THRESHOLD) {
    try {
      await channel.send({
        content: `<@&${staffRoleId}>`,
        embeds: [
          new EmbedBuilder()
            .setTitle('📋 Application Queue Alert')
            .setDescription(`There are now **${currentCount} unclaimed** whitelist applications waiting for review.`)
            .setColor(0xfee75c)
            .setTimestamp(),
        ],
      });
      logger.info(`Queue alert sent: ${currentCount} pending applications`);
    } catch (err) {
      logger.error('Failed to send queue alert', err);
    }
  }
}

async function checkOverdueAlert(channel: TextChannel, staffRoleId: string): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - OVERDUE_SECONDS;
  const overdueApps = getOverdueUnalertedApplications(cutoff);
  if (overdueApps.length === 0) return;

  markApplicationsAlertedOverdue(overdueApps.map((a) => a.id));

  const lines = overdueApps.map((a) => {
    const thread = a.thread_id ? ` — <#${a.thread_id}>` : '';
    return `• **#${a.id}** <@${a.applicant_id}> — submitted <t:${a.created_at}:R>${thread}`;
  });

  try {
    await channel.send({
      content: `<@&${staffRoleId}>`,
      embeds: [
        new EmbedBuilder()
          .setTitle('⏰ Overdue Application Alert')
          .setDescription(
            `The following ${overdueApps.length === 1 ? 'application has' : `${overdueApps.length} applications have`} been unclaimed for over 24 hours:\n\n${lines.join('\n')}`
          )
          .setColor(0xed4245)
          .setTimestamp(),
      ],
    });
    logger.info(`Overdue alert sent for applications: ${overdueApps.map((a) => a.id).join(', ')}`);
  } catch (err) {
    logger.error('Failed to send overdue alert', err);
  }
}
