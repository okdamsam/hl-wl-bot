import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
  ChannelType,
} from 'discord.js';
import { getApplicationById, unclaimApplication, insertDecision } from '../../db/queries.js';
import { buildPendingPanel } from '../../services/applications.js';
import { refreshAdminPanel } from '../../services/admin-panel.js';
import { encode } from '../../lib/customId.js';
import { logger } from '../../lib/logger.js';

export const wlUnclaimCommand = new SlashCommandBuilder()
  .setName('wl-unclaim')
  .setDescription('Unassign a claimed application so it can be claimed again.')
  .addIntegerOption((opt) =>
    opt.setName('id').setDescription('Application ID to unclaim').setRequired(true).setMinValue(1)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleWlUnclaim(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({ content: 'You need the Administrator permission to use this command.' });
    return;
  }

  const applicationId = interaction.options.getInteger('id', true);
  const app = getApplicationById(applicationId);

  if (!app) {
    await interaction.editReply({ content: `Application #${applicationId} does not exist.` });
    return;
  }

  if (app.status !== 'claimed') {
    await interaction.editReply({
      content: `Application #${applicationId} is not currently claimed (status: \`${app.status}\`).`,
    });
    return;
  }

  const applicantId = unclaimApplication(applicationId);
  if (applicantId === null) {
    // Race condition: another action changed status between the check and the update.
    await interaction.editReply({
      content: `Application #${applicationId} is no longer claimed. No changes made.`,
    });
    return;
  }

  logger.info(`Application ${applicationId} unclaimed by admin ${interaction.user.id} (was claimed by ${app.claimed_by ?? 'unknown'})`);

  insertDecision(applicationId, interaction.user.id, 'unclaimed', Math.floor(Date.now() / 1000));

  // Update the panel message in the thread back to the pending state.
  if (app.thread_id) {
    try {
      const thread = await interaction.guild!.channels.fetch(app.thread_id);
      if (thread?.type === ChannelType.PrivateThread || thread?.type === ChannelType.PublicThread) {
        // Find the panel message by scanning for our customId buttons.
        const decideCustomIdPrefix = encode('wl', 'decide', 'accept', String(applicationId));
        const claimCustomId = encode('wl', 'claim', String(applicationId));

        const messages = await thread.messages.fetch({ limit: 50 });
        const panelMessage = messages.find((msg) => {
          if (!msg.components.length) return false;
          for (const row of msg.components) {
            if (!('components' in row)) continue;
            for (const component of (row as { components: { customId?: string }[] }).components) {
              const cid = component.customId ?? null;
              if (cid && (cid.startsWith('wl:decide:') || cid === claimCustomId || cid === decideCustomIdPrefix)) {
                return true;
              }
            }
          }
          return false;
        });

        if (panelMessage) {
          await panelMessage.edit(buildPendingPanel(applicationId, applicantId));
        } else {
          // Panel not found (e.g. deleted); post a fresh one.
          await thread.send(buildPendingPanel(applicationId, applicantId));
        }

        // Rename thread: strip "claimed-" prefix if present.
        const currentName = thread.name;
        const newName = currentName.startsWith('claimed-')
          ? currentName.slice('claimed-'.length)
          : currentName;
        if (newName !== currentName) {
          await thread.setName(newName.slice(0, 100)).catch((e: unknown) =>
            logger.error(`Failed to rename thread ${thread.id} during unclaim`, e)
          );
        }

        await thread
          .send(`Application unclaimed by <@${interaction.user.id}>. It is now available to claim again.`)
          .catch((e: unknown) =>
            logger.error(`Failed to post unclaim notice in thread ${thread.id}`, e)
          );
      }
    } catch (err) {
      logger.error(`Failed to update thread ${app.thread_id} during unclaim of app ${applicationId}`, err);
    }
  }

  refreshAdminPanel(interaction.client).catch((e: unknown) =>
    logger.error('Failed to refresh admin panel after unclaim', e)
  );

  const previousClaimer = app.claimed_by ? `<@${app.claimed_by}>` : 'unknown';
  await interaction.editReply({
    content: `Application #${applicationId} has been unclaimed (was held by ${previousClaimer}). It is now available to claim.`,
  });
}
