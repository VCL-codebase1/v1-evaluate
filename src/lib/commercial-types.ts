export type DirectoryKind = "client" | "supplier";

export type DirectoryRecord = {
  id: string;
  kind: DirectoryKind;
  name: string;
  contact: string;
  email: string;
  status: string;
};

export type PricingRules = {
  airBank: number;
  customs: number;
  agency: number;
  delivery: number;
  warehouse: number;
  markup: number;
  soncap: number;
  localBank: number;
  localDelivery: number;
  localMarkup: number;
  bank1: number;
  courierBank: number;
  courierCustoms: number;
  courierAgency: number;
  courierDelivery: number;
  courierMarkup: number;
  seaCustoms: number;
  seaBank: number;
  seaSurcharge: number;
  seaMarkup: number;
  seaAgency: number;
  seaDelivery: number;
  shipping: number;
  surcharge: number;
  insurance: number;
  installation: number;
  localInstallation: number;
  vat: number;
  withholding: number;
  commission: number;
  localPurchaseBank: number;
  localPurchaseMarkup: number;
  localPurchaseDelivery: number;
};

export const DEFAULT_RULES: PricingRules = {
  airBank: 0,
  customs: 0,
  agency: 0,
  delivery: 0,
  warehouse: 0,
  markup: 0,
  soncap: 0,
  localBank: 0,
  localDelivery: 0,
  localMarkup: 0,
  bank1: 0,
  courierBank: 0,
  courierCustoms: 0,
  courierAgency: 0,
  courierDelivery: 0,
  courierMarkup: 0,
  seaCustoms: 0,
  seaBank: 0,
  seaSurcharge: 0,
  seaMarkup: 0,
  seaAgency: 0,
  seaDelivery: 0,
  shipping: 0,
  surcharge: 0,
  insurance: 0,
  installation: 0,
  localInstallation: 0,
  vat: 0,
  withholding: 0,
  commission: 0,
  localPurchaseBank: 0,
  localPurchaseMarkup: 0,
  localPurchaseDelivery: 0,
};

export type QuotationDraft = {
  estimateId: string;
  scope: string;
  delivery: string;
  payment: string;
  validity: string;
  exclusions: string;
  warranty: string;
  terms: string;
  recipient: string;
  issued: string[];
};
