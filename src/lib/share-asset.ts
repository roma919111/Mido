import { buildReferralSignupUrl } from "@/lib/referral-shared";

export type ShareChannel = "native" | "copy" | "whatsapp" | "twitter";

export type ShareAssetInput = {
  prompt?: string;
  referralCode?: string | null;
  locale?: "ar" | "en";
};

function clientAppBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }
  return (
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim()?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, "") ||
    "https://vyronix.app"
  );
}

export function buildGrowthShareUrl(referralCode?: string | null): string {
  const base = clientAppBaseUrl();
  if (referralCode?.trim()) {
    return buildReferralSignupUrl(referralCode.trim(), base);
  }
  return `${base}/signup`;
}

export function buildShareMessage(input: ShareAssetInput): string {
  const locale = input.locale ?? "ar";
  const prompt = input.prompt?.trim();
  const url = buildGrowthShareUrl(input.referralCode);
  if (locale === "ar") {
    return prompt
      ? `شاهد ما أنشأته بالذكاء الاصطناعي على Veronix.ai ✨\n«${prompt.slice(0, 120)}»\nجرّب مجانًا: ${url}`
      : `أنشئ فيديو وصورة بالذكاء الاصطناعي على Veronix.ai ✨\nجرّب مجانًا: ${url}`;
  }
  return prompt
    ? `See what I made with AI on Veronix.ai ✨\n"${prompt.slice(0, 120)}"\nTry free: ${url}`
    : `Create AI video & images on Veronix.ai ✨\nTry free: ${url}`;
}

export function whatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function twitterShareUrl(message: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
}

export async function shareAsset(
  input: ShareAssetInput,
  channel: ShareChannel = "native",
): Promise<{ ok: boolean; channel: ShareChannel }> {
  const message = buildShareMessage(input);
  const url = buildGrowthShareUrl(input.referralCode);

  if (channel === "whatsapp") {
    window.open(whatsAppShareUrl(message), "_blank", "noopener,noreferrer");
    return { ok: true, channel };
  }
  if (channel === "twitter") {
    window.open(twitterShareUrl(message), "_blank", "noopener,noreferrer");
    return { ok: true, channel };
  }
  if (channel === "copy") {
    await navigator.clipboard.writeText(message);
    return { ok: true, channel };
  }

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Veronix.ai",
        text: message,
        url,
      });
      return { ok: true, channel: "native" };
    }
    await navigator.clipboard.writeText(message);
    return { ok: true, channel: "copy" };
  } catch {
    try {
      await navigator.clipboard.writeText(message);
      return { ok: true, channel: "copy" };
    } catch {
      return { ok: false, channel };
    }
  }
}
