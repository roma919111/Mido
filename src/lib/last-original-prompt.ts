/** Shared last original prompt (CreateStudio + future H3LabClient). */

const STORAGE_KEY = "vyronix-last-original-prompt";

export function readLastOriginalPrompt(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function writeLastOriginalPrompt(prompt: string): void {
  if (typeof window === "undefined") return;
  const trimmed = prompt.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    /* quota / private mode */
  }
}
