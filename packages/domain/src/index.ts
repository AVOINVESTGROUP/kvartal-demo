export type LanguageCode = "ru" | "en" | "ka" | "hy" | "ar";

export type CurrencyCode = "RUB" | "USD" | "EUR" | "GEL" | "AMD" | "AED";

export type LocalizedText = Partial<Record<LanguageCode, string>>;

export type PlatformRole = "platform_owner" | "platform_admin" | "platform_analyst" | "platform_viewer";

export type OrganizationRole = "organization_owner" | "organization_admin";

export type OfficeRole = "office_owner" | "office_admin" | "broker" | "office_analyst" | "office_viewer";

export type AssetClass =
  | "land"
  | "apartment"
  | "house"
  | "warehouse"
  | "industrial_site"
  | "factory"
  | "hotel"
  | "office"
  | "retail"
  | "mixed_use"
  | "development_project"
  | "investment_project"
  | "other";

export type PublicationStatus = "draft" | "published" | "archived";

export type Visibility = "private" | "office_network" | "public";

export type Confidence = "high" | "medium" | "low";

export type VerificationResult = "confirmed" | "not_found" | "conflict" | "outdated" | "unsupported";

export type LegalDocumentScope = "organization" | "office" | "property_object" | "client_intent" | "deal_room" | "transaction" | "other";

export type LegalDocumentKind =
  | "ownership_certificate"
  | "cadastral_extract"
  | "title_document"
  | "lease_agreement"
  | "sale_purchase_agreement"
  | "power_of_attorney"
  | "corporate_document"
  | "passport_or_id"
  | "tax_document"
  | "encumbrance_certificate"
  | "technical_passport"
  | "floor_plan"
  | "permit"
  | "due_diligence_report"
  | "valuation_report"
  | "nda"
  | "broker_agreement"
  | "commission_agreement"
  | "other";

export type LegalReviewStatus = "not_reviewed" | "pending_review" | "needs_clarification" | "verified" | "rejected" | "expired";

export type DocumentConfidentiality = "public" | "office_private" | "organization_private" | "deal_participants" | "platform_private";
