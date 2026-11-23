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
  airBank: 0.35,
  customs: 10.5,
  agency: 5,
  delivery: 0,
  warehouse: 10,
  markup: 25,
  soncap: 0,
  localBank: 0.35,
  localDelivery: 0,
  localMarkup: 25,
  bank1: 0,
  courierBank: 1,
  courierCustoms: 8,
  courierAgency: 10,
  courierDelivery: 0.5,
  courierMarkup: 25,
  seaCustoms: 20,
  seaAgency: 5,
  seaDelivery: 1,
  shipping: 10,
  surcharge: 1,
  insurance: 1,
  installation: 0,
  localInstallation: 0,
  vat: 7.5,
  withholding: 5,
  commission: 1,
  localPurchaseBank: 1,
  localPurchaseMarkup: 20,
  localPurchaseDelivery: 1,
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
