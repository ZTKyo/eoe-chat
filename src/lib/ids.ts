export function createId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}_${random}`;
}

export function makeConversationTitle(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "新对话";
  return compact.length > 22 ? `${compact.slice(0, 22)}…` : compact;
}
