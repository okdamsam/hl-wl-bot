// Single source of truth for all customId strings.
// Discord caps customId at 100 characters.
// Format: domain:action[:entityId]  e.g. wl:claim:412

export const CUSTOM_IDS = {
  // Panel button that opens the application modal
  APPLY_BUTTON: 'wl:apply',
  // Modal submit (same value — router distinguishes by interaction type)
  APPLY_MODAL: 'wl:apply',

  // Modal field component IDs (used with interaction.fields.getXxx())
  FIELD_PLAYTIME: 'playtime',
  FIELD_BANNED: 'banned',
  FIELD_AGE: 'age',
  FIELD_SCREENSHOTS: 'screenshots',
  FIELD_RULES: 'rules',
} as const;

/**
 * Build a routing customId from colon-delimited parts.
 * Throws if the result exceeds Discord's 100-character limit.
 */
export function encode(domain: string, ...parts: string[]): string {
  const id = [domain, ...parts].join(':');
  if (id.length > 100) {
    throw new Error(`customId too long (${id.length} chars): ${id}`);
  }
  return id;
}

/**
 * Split a routing customId back into its parts.
 */
export function decode(customId: string): string[] {
  return customId.split(':');
}
