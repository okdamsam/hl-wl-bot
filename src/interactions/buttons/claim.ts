import {
  GuildMemberRoleManager,
  MessageFlags,
  type ButtonInteraction,
} from 'discord.js';
import { decode } from '../../lib/customId.js';
import { claimApplication, getConfig } from '../../db/queries.js';
import { buildClaimedPanel } from '../../services/applications.js';
import { refreshAdminPanel } from '../../services/admin-panel.js';
import { logger } from '../../lib/logger.js';

export async function handleClaim(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  // Staff role gate
  const staffRoleId = getConfig('staff_role_id');
  if (staffRoleId) {
    const roles = interaction.member?.roles;
    const roleIds =
      roles instanceof GuildMemberRoleManager
        ? [...roles.cache.keys()]
        : (roles as string[]) ?? [];
    if (!roleIds.includes(staffRoleId)) {
      await interaction.followUp({
        content: 'You need the staff role to claim applications.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const [, , appIdStr] = decode(interaction.customId);
  const applicationId = parseInt(appIdStr, 10);

  const applicantId = claimApplication(applicationId, interaction.user.id, Math.floor(Date.now() / 1000));

  if (applicantId === null) {
    await interaction.followUp({
      content: 'This application has already been claimed.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  logger.info(`Application ${applicationId} claimed by ${interaction.user.id}`);
  await interaction.editReply(buildClaimedPanel(applicationId, applicantId, interaction.user.id));

  const thread = interaction.channel;
  if (thread?.isThread()) {
    const base = thread.name.match(/wl-.*/)?.[0] ?? thread.name;
    await thread.setName(`claimed-${base}`.slice(0, 100)).catch((e: unknown) =>
      logger.error(`Failed to rename thread ${thread.id}`, e)
    );
    await thread.send(`Claimed by <@${interaction.user.id}>`).catch((e: unknown) =>
      logger.error(`Failed to send claim message in thread ${thread.id}`, e)
    );
  }

  refreshAdminPanel(interaction.client).catch((e: unknown) =>
    logger.error('Failed to refresh admin panel after claim', e)
  );
}
