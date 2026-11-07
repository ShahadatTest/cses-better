export const LAST_ACCESSED_QUESTION_KEY = 'cses_last_accessed_question';

export function isKnownQuestionId(id: string | null | undefined, knownIds: ReadonlySet<string>): id is string {
  return Boolean(id && knownIds.has(id));
}

export function questionPath(id: string): string {
  return `/practice/${encodeURIComponent(id)}`;
}

export function resolveInitialQuestionId(options: {
  explicitId?: string | null;
  legacyHash?: string | null;
  savedId?: string | null;
  knownIds: ReadonlySet<string>;
  fallbackId: string;
}): { id: string; invalidExplicit: boolean } {
  const { explicitId, legacyHash, savedId, knownIds, fallbackId } = options;
  if (explicitId !== undefined && explicitId !== null) {
    return isKnownQuestionId(explicitId, knownIds)
      ? { id: explicitId, invalidExplicit: false }
      : { id: fallbackId, invalidExplicit: true };
  }
  if (isKnownQuestionId(legacyHash, knownIds)) return { id: legacyHash, invalidExplicit: false };
  if (isKnownQuestionId(savedId, knownIds)) return { id: savedId, invalidExplicit: false };
  return { id: fallbackId, invalidExplicit: false };
}
