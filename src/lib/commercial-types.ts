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
};

export const DEFAULT_RULES: PricingRules = {
  airBank: 0.25,
  customs: 10.5,
  agency: 7.5,
  delivery: 1.5,
  warehouse: 12.5,
  markup: 30,
  soncap: 650,
  localBank: 0.5,
  localDelivery: 1,
  localMarkup: 15,
  bank1: 15,
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
