import {
  SlashCommandBuilder,
  EmbedBuilder,
  GuildMemberRoleManager,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getConfig } from '../../db/queries.js';

export const wlRubricCommand = new SlashCommandBuilder()
  .setName('wl-rubric')
  .setDescription('Show the application review rubric (ephemeral).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function handleWlRubric(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Staff / mod role gate
  const staffRoleId = getConfig('staff_role_id');
  const modRoleId = getConfig('mod_role_id');
  const roles = interaction.member?.roles;
  const roleIds =
    roles instanceof GuildMemberRoleManager
      ? [...roles.cache.keys()]
      : (roles as string[]) ?? [];
  const hasAccess =
    (staffRoleId && roleIds.includes(staffRoleId)) ||
    (modRoleId && roleIds.includes(modRoleId));
  if (!hasAccess) {
    await interaction.editReply({ content: 'You need the staff or mod role to view the rubric.' });
    return;
  }

  const q1 = new EmbedBuilder()
    .setTitle('Q1 - Faults')
    .setColor(0x5865f2)
    .setDescription(
      '**Pass:** Names a fault that would plausibly cost them something during a round, and the "makes things worse" example is specific.\n\n' +
      '**Fail:** No fault given, or the fault is a strength wearing a costume - *too loyal, cares too much, works too hard, reckless.* In SS14 "reckless" usually means "charges in," which is the trait you\'re screening against.\n\n' +
      '**The tell to watch for:** a real-sounding fault where the "makes things worse" example is secretly heroic - *"he\'d rush into the fire to pull someone out and get himself killed."* That\'s still main character syndrome, just dressed up. The applicant should be able to describe being unhelpful, not tragically over-helpful.\n\n' +
      '**Borderline:** fault is genuine but generic. Ask a follow-up before deciding.',
    );

  const q2 = new EmbedBuilder()
    .setTitle('Q2 - Literacy and RP competence')
    .setColor(0x5865f2)
    .setDescription(
      '**Pass:** Comprehensible. Uses emotes. Picks a channel on purpose and it makes sense for the situation. Reads as the character talking, not the player describing.\n\n' +
      '**Fail:** Answers out of character (*"my character would probably refuse"*), or writes prose fiction rather than something you\'d actually type into a chat box.\n\n' +
      '**Do not fail for grammar alone.** The bar you set was comprehension, not eloquence. A non-native speaker whose meaning is clear passes. Someone whose writing is polished but who has no idea how in-game communication works does not.',
    );

  const q3 = new EmbedBuilder()
    .setTitle('Q3 - Rolling with it')
    .setColor(0x5865f2)
    .setDescription(
      '**Pass:** Accepts it. Respawns, plays someone else, moves on. Assigns the loss to themselves or to nobody.\n\n' +
      'Frustration is a pass. You asked for honesty, so *"I\'d be pretty annoyed"* is a good sign - it means they answered you rather than the question.\n\n' +
      '**Fail:** Blames others for not coming. Argues the mechanic is unfair. Says they\'d ahelp it, angle for a revival, or log off. Anything where the frustration has somewhere to go besides themselves.',
    );

  const q4 = new EmbedBuilder()
    .setTitle('Q4 - Plays the character, not the player')
    .setColor(0x5865f2)
    .setDescription(
      '**Pass:** The research assistant stays a research assistant. They articulate the gap between what the player could do and what the character would do - and the character\'s response fits the character.\n\n' +
      '**Fail:** Suits up and fights. Or names the right answer but can\'t explain the distinction, which usually means they\'ve learned the phrase rather than the principle.\n\n' +
      '**Still confirm this against your own ruleset** before it goes live. If your rules permit crew arming during a nuke op, an applicant who says they\'d defend the station is reading you correctly, and you\'d be failing them for it.',
    );

  const deciding = new EmbedBuilder()
    .setTitle('Deciding')
    .setColor(0xfee75c)
    .setDescription(
      '**Deny (Requirements)** - objective, no judgment call. Under the hours bar. Undisclosed ban surfaces. Steam screenshot or illegible playtime. Didn\'t answer all four.\n\n' +
      '**Deny (Expectations)** - a fail on **Q3 or Q4 alone is sufficient.** These are the two that predict whether someone becomes a problem in month three, and neither is really coachable.\n\n' +
      '**Q1 or Q2 alone - ask a follow-up first.** Both are about presentation as much as substance, and a nervous applicant can underperform on either. Give them one prompt in the thread before you decide.\n\n' +
      'Whatever the outcome, put your reasoning in the decision note. Six reviewers grading independently will drift within a month otherwise, and the note is what lets you spot it.',
    );

  await interaction.editReply({ embeds: [q1, q2, q3, q4, deciding] });
}
