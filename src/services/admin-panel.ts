import { EmbedBuilder, type Client, type TextBasedChannel } from 'discord.js';
import { getConfig, getPendingApplications, setConfig } from '../db/queries.js';
import { logger } from '../lib/logger.js';

export function buildAdminPanelEmbed(): EmbedBuilder {
  const apps = getPendingApplications();

  const embed = new EmbedBuilder()
    .setTitle('Pending Whitelist Applications')
    .setColor(0x5865f2)
    .setTimestamp()
    .setFooter({ text: 'Last refreshed' });

  if (apps.length === 0) {
    embed.setDescription('No pending applications.');
    return embed;
  }

  const lines = apps.map((app) => {
    const thread = app.thread_id ? `<#${app.thread_id}>` : '*no thread*';
    const status = app.status === 'claimed' ? '🔵 claimed' : '🟡 pending';
    const time = `<t:${app.created_at}:R>`;
    return `**#${app.id}** <@${app.applicant_id}> — ${thread} — ${status} — ${time}`;
  });

  embed.setDescription(lines.join('\n'));
  return embed;
}

export async function refreshAdminPanel(client: Client): Promise<void> {
  const channelId = getConfig('admin_panel_channel_id');
  const messageId = getConfig('admin_panel_message_id');
  if (!channelId || !messageId) return;

  try {
    const channel = (await client.channels.fetch(channelId)) as TextBasedChannel | null;
    if (!channel?.isTextBased()) return;
    const message = await channel.messages.fetch(messageId);
    await message.edit({ embeds: [buildAdminPanelEmbed()] });
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 10008) {
      // Unknown Message — panel was deleted, clear stored ID
      setConfig('admin_panel_message_id', '');
      logger.warn('Admin panel message was deleted — clearing stored message ID');
    } else {
      logger.error('Failed to refresh admin panel', err);
    }
  }
}
