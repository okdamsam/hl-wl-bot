import {
  CheckboxGroupBuilder,
  CheckboxGroupOptionBuilder,
  FileUploadBuilder,
  GuildMember,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from 'discord.js';
import { CUSTOM_IDS } from '../../lib/customId.js';
import { getConfig, hasActiveApplication } from '../../db/queries.js';

export async function handleApplyButton(interaction: ButtonInteraction): Promise<void> {
  // Check: user already has a pending or claimed application.
  if (hasActiveApplication(interaction.user.id)) {
    await interaction.reply({
      content: 'You already have an application in progress.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check: user already holds the whitelist role.
  // interaction.member is populated from the interaction payload without needing GuildMembers intent.
  const whitelistRoleId = getConfig('whitelist_role_id');
  if (whitelistRoleId) {
    const member = interaction.member;
    const roleIds: string[] =
      member instanceof GuildMember
        ? [...member.roles.cache.keys()]
        : Array.isArray(member?.roles)
          ? (member.roles as string[])
          : [];

    if (roleIds.includes(whitelistRoleId)) {
      await interaction.reply({
        content: 'You are already whitelisted.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  await interaction.showModal(buildApplyModal());
}

function buildApplyModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(CUSTOM_IDS.APPLY_MODAL)
    .setTitle('HardLight Whitelist Application')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('SS14 in-game username')
        .setDescription('Your exact ckey / character name as it appears in-game.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(CUSTOM_IDS.FIELD_USERNAME)
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(64)
            .setRequired(true)
            .setPlaceholder('e.g. John Smith'),
        ),
      new LabelBuilder()
        .setLabel('Before you submit — please confirm')
        .setCheckboxGroupComponent(
          new CheckboxGroupBuilder()
            .setCustomId(CUSTOM_IDS.FIELD_ACKNOWLEDGEMENTS)
            .setMinValues(2)
            .setMaxValues(2)
            .addOptions(
              new CheckboxGroupOptionBuilder()
                .setLabel('I will upload evidence of my playtime (server playtime, not Steam app runtime)')
                .setValue('evidence'),
              new CheckboxGroupOptionBuilder()
                .setLabel('I understand there are four questions to answer following this form')
                .setValue('questions'),
            ),
        ),
      new LabelBuilder()
        .setLabel('Are you currently banned anywhere?')
        .setDescription('SS13 or SS14. If yes, name the server and why. Hiding a ban is worse than the ban.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(CUSTOM_IDS.FIELD_BANNED)
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(2)
            .setRequired(true)
            .setPlaceholder('No — or — Yes: [server], [reason]'),
        ),
      new LabelBuilder()
        .setLabel('How old are you?')
        .setDescription('You must be 18 or older to apply. Applications from minors are declined without review.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(CUSTOM_IDS.FIELD_AGE)
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(3)
            .setRequired(true)
            .setPlaceholder('e.g. 24'),
        ),
      new LabelBuilder()
        .setLabel('Screenshot of your playtime')
        .setDescription(
          'Open the character menu \u2192 playtime tab. Must be legible. Not Steam hours \u2014 use the in-game tracker.',
        )
        .setFileUploadComponent(
          new FileUploadBuilder()
            .setCustomId(CUSTOM_IDS.FIELD_SCREENSHOTS)
            .setMinValues(1)
            .setMaxValues(3)
            .setRequired(true),
        ),
    );
}
