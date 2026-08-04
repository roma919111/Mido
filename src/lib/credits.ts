import {
  callOpenArtTool,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";

export const INSUFFICIENT_CREDITS_MESSAGE = "Insufficient credit balance";

export async function fetchOwnerCreditBalance(): Promise<number> {
  const result = await callOpenArtTool("openart_account_get", {});
  const payload = parseToolPayload(result);

  if (result.isError) {
    const message =
      typeof payload.rawText === "string"
        ? payload.rawText
        : "Failed to load platform credit balance";
    throw new OpenArtConfigError(message);
  }

  const user = (payload.user as Record<string, unknown> | undefined) ?? payload;
  if (typeof payload.credits === "number") return payload.credits;
  if (typeof user.credits === "number") return user.credits;
  return 0;
}

export type CreditBalanceCheck = {
  ok: boolean;
  balance: number;
  required: number;
  error?: string;
};

export async function checkSufficientCredits(required: number): Promise<CreditBalanceCheck> {
  const balance = await fetchOwnerCreditBalance();
  if (balance < required) {
    return {
      ok: false,
      balance,
      required,
      error: INSUFFICIENT_CREDITS_MESSAGE,
    };
  }
  return { ok: true, balance, required };
}
