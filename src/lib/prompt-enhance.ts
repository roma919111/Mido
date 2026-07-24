const CINEMATIC_SUFFIXES = [
  "cinematic lighting, rich color grading, sharp detail, shallow depth of field",
  "dramatic atmosphere, high dynamic range, filmic contrast, meticulous composition",
  "studio-quality finish, coherent subject focus, natural motion cues, polished texture",
];

const STYLE_HINTS = [
  "photorealistic",
  "soft volumetric light",
  "clean background separation",
  "premium production aesthetic",
];

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function enhancePrompt(prompt: string, mode: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  const seed = hashSeed(cleaned + mode);
  const suffix = CINEMATIC_SUFFIXES[seed % CINEMATIC_SUFFIXES.length];
  const style = STYLE_HINTS[seed % STYLE_HINTS.length];

  const alreadyEnhanced =
    /cinematic|photorealistic|volumetric|film grain|depth of field/i.test(cleaned);

  if (alreadyEnhanced) {
    return `${cleaned}. Refined for ${mode.replaceAll("-", " ")} generation with tighter subject clarity and balanced lighting.`;
  }

  const framing =
    mode === "text-to-image"
      ? "Centered subject, intentional framing"
      : "Smooth camera movement, temporally consistent subject";

  return `${cleaned}. ${framing}, ${style}, ${suffix}.`;
}
