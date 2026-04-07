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

function withFromChatQuery(path: string, from?: string | string[] | null, session?: string | string[] | null): string {
  if (!isFromChat(from)) return path;
  let result = path.includes("?") ? `${path}&from=chat` : `${path}?from=chat`;
  const sessionStr = Array.isArray(session) ? session[0] : session;
  if (sessionStr) {
    result += `&session=${encodeURIComponent(sessionStr)}`;
  }
  return result;
}

export function getChatRecipeDetailPath(recipeId: string): string {
  return `/recipe/${encodeURIComponent(recipeId)}?from=chat`;
}

export function getChatCustomCookingGuidePath(recipeId: string, sessionId?: string | null): string {
  const base = `/recipe/custom/${encodeURIComponent(recipeId)}/cooking-guide?from=chat`;
  return sessionId ? `${base}&session=${encodeURIComponent(sessionId)}` : base;
}

export function getCustomCookingGuidePath(
  recipeId: string,
  from?: string | string[] | null,
  segment?: string,
  session?: string | string[] | null,
): string {
  const base = isFromChat(from) ? "/recipe/custom" : "/(tabs)/recipes/custom";
  const safeId = encodeURIComponent(recipeId);
  const suffix = segment ? `/${segment}` : "";
  return withFromChatQuery(`${base}/${safeId}/cooking-guide${suffix}`, from, session);
}

