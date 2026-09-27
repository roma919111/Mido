import { useMemo } from "react";
import { matchNamedCharacters, normalizeCharacterName } from "@/lib/character-names";
import type { VisualReference } from "@/lib/types";

export type LinkedCharacterRef = VisualReference;

export function useLinkedCharacters(
  prompt: string,
  refs: VisualReference[],
  names: string[],
) {
  const linkedCharacters = useMemo(() => {
    const labeled = refs.map((ref, index) => {
      const name = normalizeCharacterName(names[index] || "");
      return name ? { ...ref, label: name } : ref;
    });
    return matchNamedCharacters(prompt, labeled);
  }, [prompt, refs, names]);

  const linkedIds = useMemo(
    () => new Set(linkedCharacters.map((c) => c.id)),
    [linkedCharacters],
  );

  return { linkedCharacters, linkedIds };
}
