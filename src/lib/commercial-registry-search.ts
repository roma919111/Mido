import type { CommercialRegistryHit } from "@/lib/voice-tenant-types";
import { slugFromRegistryName } from "@/lib/tenant-slug";

const MOCK_REGISTRY: Record<string, Omit<CommercialRegistryHit, "suggestedSlug">> = {
  "4030123456": {
    commercialRegistrationNumber: "4030123456",
    registryNameAr: "Los Mercados للتجارة",
    registryNameEn: "Los Mercados Trading",
    activityCode: "4711",
    activityLabel: "تجزئة — أسواق ومتاجر",
  },
  "1010123456": {
    commercialRegistrationNumber: "1010123456",
    registryNameAr: "مؤسسة نموذجية للتجارة",
    registryNameEn: "Sample Trading Est.",
    activityCode: "6201",
    activityLabel: "تقنية — برمجيات وخدمات",
  },
};

function withSlug(
  row: Omit<CommercialRegistryHit, "suggestedSlug">,
): CommercialRegistryHit {
  const base = row.registryNameEn.trim() || row.registryNameAr.trim();
  return { ...row, suggestedSlug: slugFromRegistryName(base) };
}

/** Mock Saudi CR lookup — replace with official API when credentials are available. */
export function searchCommercialRegistry(crNumber: string): CommercialRegistryHit | null {
  const digits = crNumber.replace(/\D/g, "");
  if (digits.length < 10) return null;

  const hit = MOCK_REGISTRY[digits];
  if (hit) return withSlug(hit);

  return withSlug({
    commercialRegistrationNumber: digits,
    registryNameAr: `منشأة ${digits}`,
    registryNameEn: `Company ${digits}`,
    activityCode: "0000",
    activityLabel: "نشاط عام",
  });
}
