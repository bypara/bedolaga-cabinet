export interface LegalDocumentState {
  content: string;
  updated_at: string | null;
}

/**
 * The backend returns short built-in placeholder documents when an operator has
 * not saved legal content yet. Those placeholders have no `updated_at` value,
 * which lets the login footer distinguish configured documents from defaults.
 */
export function isConfiguredLegalDocument(
  visible: boolean,
  result: PromiseSettledResult<LegalDocumentState> | undefined,
): boolean {
  if (!visible || !result || result.status !== 'fulfilled') return false;

  return result.value.content.trim().length > 0 && Boolean(result.value.updated_at?.trim());
}
