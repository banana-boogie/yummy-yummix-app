export function normalizeFromParam(
  from?: string | string[] | null,
): string | undefined {
  if (Array.isArray(from)) {
    return typeof from[0] === "string" ? from[0] : undefined;
  }
  return typeof from === "string" ? from : undefined;
}

export function isFromChat(
  from?: string | string[] | null,
): boolean {
  return normalizeFromParam(from) === "chat";
}

function withFromChatQuery(path: string, from?: string | string[] | null): string {
  if (!isFromChat(from)) return path;
  return path.includes("?") ? `${path}&from=chat` : `${path}?from=chat`;
}

export function getChatRecipeDetailPath(recipeId: string): string {
  return `/recipe/${encodeURIComponent(recipeId)}?from=chat`;
}

export function getChatCustomCookingGuidePath(recipeId: string): string {
  return `/recipe/custom/${encodeURIComponent(recipeId)}/cooking-guide?from=chat`;
}

export function getCustomCookingGuidePath(
  recipeId: string,
  from?: string | string[] | null,
  segment?: string,
): string {
  const base = isFromChat(from) ? "/recipe/custom" : "/(tabs)/recipes/custom";
  const safeId = encodeURIComponent(recipeId);
  const suffix = segment ? `/${segment}` : "";
  return withFromChatQuery(`${base}/${safeId}/cooking-guide${suffix}`, from);
}

