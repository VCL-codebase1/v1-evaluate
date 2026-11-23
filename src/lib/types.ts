export type SessionUser = {
  email: string;
  role: string;
  name: string;
  estimateId: string;
  version: string;
  organizationId: string;
  organizationName: string;
};

export type EstimateStatus = "pending" | "approved" | "rejected";

export type ReviewStage = "draft" | "in_review" | "approved" | "returned";

export type SourceMode = "Local" | "Air" | "Sea";

export type SheetCurrency = "NGN" | "USD" | "EUR" | "GBP";

export type EstimateRecord = {
  id: string;
  title: string;
  clientName: string;
  tenderNumber: string;
  contact: string;
  department: string;
  dateReceived: string;
  deadline: string;
  accountManager: string;
  originator: string;
  ownerUserId: string | null;
  description: string;
  remarks: string;
  attachments: string[];
  mode: string;
  status: EstimateStatus;
  reviewStage: ReviewStage;
  workflowStep?: string;
  version: string;
  submittedAt: string | null;
  submittedBy: string | null;
  totalNgn: number | null;
  createdAt: string;
};

export type SourcingType = "Local" | "Foreign";

export type SheetLine = {
  id: string;
  item: string;
  source: SourceMode;
  currency: SheetCurrency;
  qty: string;
  base: string;
  freight: string;
  msc: string;
  itemNumber?: string;
  manufacturer?: string;
  model?: string;
  partNumber?: string;
  specification?: string;
  unit?: string;
  supplier?: string;
  sourcing?: SourcingType;
  delivery?: string;
  warehouse?: string;
  markup?: string;
  freightType?: "Courier" | "Airport";
  installation?: string;
  applyVat?: boolean;
  applySoncap?: boolean;
  customsRate?: string;
  agencyRate?: string;
  shippingRate?: string;
  bank1Amount?: string;
  localType?: "Standard" | "Purchase";
  soncapAmount?: string;
};

export type SheetRecord = {
  estimateId: string;
  version: string;
  reviewStage: ReviewStage;
  lines: SheetLine[];
  submittedAt: string | null;
  submittedBy: string | null;
  pricingSnapshot?: import("@/lib/commercial-types").PricingRules | null;
  rateSnapshot?: ExchangeRateTable | null;
};

export type ExchangeRateTable = Record<SheetCurrency, number>;

export type ExchangeFloatation = Record<Exclude<SheetCurrency, "NGN">, number>;

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  estimateId: string;
  detail: string;
};

export type StatTone = "purple" | "orange" | "green" | "red";

export type DashboardStat = {
  key: string;
  label: string;
  value: number;
  tone: StatTone;
};

export type DashboardSummary = {
  steps: readonly string[];
  progress: number;
  stats: DashboardStat[];
};

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};
