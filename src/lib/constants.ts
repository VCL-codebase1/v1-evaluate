export const SESSION_COOKIE = "v11_session";

export const WORKFLOW_STEPS = [
  "Estimate Created",
  "Approved by Line Manager",
  "Approved by Sales Director",
  "Quotation Generated",
] as const;

export const MARKETING_STATS = [
  { value: "3 sourcing templates", detail: "Local · Air · Sea" },
  { value: "4 currencies", detail: "NGN · USD · EUR · GBP" },
  { value: "3-level approval", detail: "Rep · Manager · Director" },
] as const;
