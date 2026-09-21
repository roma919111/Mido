import { CANONICAL_HOST } from "@/lib/site";

const TENANT_ROOT = CANONICAL_HOST;

/** Subdomain slug from Host header, or null for apex / www / localhost. */
export function parseTenantSlugFromHost(hostHeader: string | null | undefined): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.split(",")[0]?.trim().split(":")[0]?.toLowerCase() || "";
  if (!host || host === TENANT_ROOT || host === `www.${TENANT_ROOT}`) return null;
  if (host === "localhost" || host === "127.0.0.1") return null;

  const suffix = `.${TENANT_ROOT}`;
  if (!host.endsWith(suffix)) return null;

  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes(".")) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) return null;
  return slug;
}

export function isTenantHost(hostHeader: string | null | undefined): boolean {
  return parseTenantSlugFromHost(hostHeader) !== null;
}
