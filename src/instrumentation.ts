export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { getAppBaseUrl } = await import("@/lib/app-url");
    const { syncStripeWebhookToPublicUrl } = await import("@/lib/stripe-webhook-sync");
    const origin = getAppBaseUrl();
    if (origin && !/localhost|127\.0\.0\.1/i.test(origin)) {
      const result = await syncStripeWebhookToPublicUrl(origin);
      if (result.ok) {
        console.info("[veronix] Stripe webhook synced to", result.webhookUrl);
      }
    }
  } catch (error) {
    console.warn(
      "[veronix] Stripe webhook sync skipped:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    const { recoverDbFromBackupsIfNeeded, backupCustomerDb } = await import(
      "@/lib/db-backup"
    );
    const recovered = await recoverDbFromBackupsIfNeeded();
    if (recovered.recovered) {
      console.info("[veronix] Customer DB recovered from backup:", recovered.detail);
    }
    const backup = await backupCustomerDb("startup", { force: true });
    if (backup.ok) {
      console.info("[veronix] Customer DB backup ready");
    } else if (backup.skipped) {
      console.info("[veronix] Customer DB backup skipped:", backup.skipped);
    }
  } catch (error) {
    console.warn(
      "[veronix] Customer DB backup skipped:",
      error instanceof Error ? error.message : error,
    );
  }
}
