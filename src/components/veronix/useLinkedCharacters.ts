"use client";

import { useMemo } from "react";
import { matchNamedCharacters, normalizeCharacterName } from "@/lib/character-names";
import type { VisualReference } from "@/lib/types";

/** Character refs whose (typed) name appears in the prompt. `names[i]` overrides `refs[i].label`. */
export function useLinkedCharacters(
  prompt: string,
  refs: VisualReference[],
  names: string[],
) {
  const linkedCharacters = useMemo(() => {
    const labelled = refs.map((ref, i) => {
      const name = normalizeCharacterName(names[i] || "");
      return name ? { ...ref, label: name } : ref;
    });
    return matchNamedCharacters(prompt, labelled);
  }, [prompt, refs, names]);

  const linkedIds = useMemo(
    () => new Set(linkedCharacters.map((ref) => ref.id)),
    [linkedCharacters],
  );

  return { linkedCharacters, linkedIds };
}
