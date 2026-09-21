export type VoiceTenantStatus =
  | "pending_approval"
  | "approved"
  | "awaiting_payment"
  | "active"
  | "rejected";

export interface VoiceTenantUploadRecord {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storage: "s3" | "local";
  storageKey: string;
  uploadedAt: string;
}

export interface VoiceTenantRecord {
  id: string;
  commercialRegistrationNumber: string;
  registryNameAr: string;
  registryNameEn: string;
  activityCode: string;
  activityLabel: string;
  slug: string;
  status: VoiceTenantStatus;
  phone?: string;
  assistantId?: string;
  /** Shown to admin after activation — portal settings + uploads. */
  portalAccessToken?: string;
  s3Prefix: string;
  uploads: VoiceTenantUploadRecord[];
  adminNote?: string;
  rejectedReason?: string;
  approvedAt?: string;
  paidAt?: string;
  activatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialRegistryHit {
  commercialRegistrationNumber: string;
  registryNameAr: string;
  registryNameEn: string;
  activityCode: string;
  activityLabel: string;
  suggestedSlug: string;
}
