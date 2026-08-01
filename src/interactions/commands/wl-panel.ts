import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getConfig, setConfig } from '../../db/queries.js';
import { CUSTOM_IDS } from '../../lib/customId.js';
import { logger } from '../../lib/logger.js';

export const wlPanelCommand = new SlashCommandBuilder()
  .setName('wl-panel')
  .setDescription('Post the whitelist application panel in the applications channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleWlPanel(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channelId = getConfig('applications_channel_id');
  if (!channelId) {
    await interaction.editReply(
      'Applications channel not configured. Run `/wl-setup applications-channel` first.',
    );
    return;
  }

  const channel = await interaction.guild!.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    await interaction.editReply('Applications channel not found or is not a text channel.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Welcome to HardLight')
    .setDescription(
      'HardLight is a **medium roleplay (MRP)** Space Station 14 community. ' +
      'The whitelist application exists to ensure every member understands and fits our standards of play and conduct.\n\n' +
      'Before applying, please review our documentation at **[docs.hardlight.space](https://docs.hardlight.space)** — ' +
      'it covers our community\'s expectations, culture, and what MRP means to us. ' +
      'Applications are evaluated on how well you demonstrate that understanding.\n\n' +
      '**Minimum requirements:**\n' +
      '• **18 years or older** — no exceptions\n' +
      '• **200+ hours** on LRP servers, **100+ hours** on MRP servers, or **50+ hours** on HRP servers\n' +
      '• An adherence to MRP guidelines and HardLight community expectations\n\n' +
      '**To apply you will also need:**\n' +
      '• A screenshot of your in-game playtime (not Steam hours)\n\n' +
      'When you are ready, click **Apply** below.',
    )
    .setColor(0x5865f2)
    .setFooter({ text: 'Written and maintained by Ok Sam, inspired by Kodey' });

  const button = new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.APPLY_BUTTON)
    .setLabel('Apply')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  const message = await channel.send({ embeds: [embed], components: [row] });
  setConfig('panel_message_id', message.id);

  logger.info(`Panel posted — channel ${channelId}, message ${message.id}`);
  await interaction.editReply(`Panel posted in <#${channelId}>.`);
}
