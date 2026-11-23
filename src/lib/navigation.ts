export type NavIconName =
  | "dashboard"
  | "rfq"
  | "sheet"
  | "approval"
  | "reports"
  | "people"
  | "rates"
  | "rules"
  | "users"
  | "audit";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  description: string;
  roles?: readonly string[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    description: "Workspace overview for the current estimate.",
  },
  {
    href: "/rfqs",
    label: "RFQs and tenders",
    icon: "rfq",
    description: "Requests and tender packs will live here.",
  },
  {
    href: "/estimation",
    label: "Estimation sheet",
    icon: "sheet",
    description: "Local, air, and sea cost sheets will be built here.",
  },
  {
    href: "/approval",
    label: "Approval",
    icon: "approval",
    description: "Line manager and sales director reviews will be tracked here.",
  },
  {
    href: "/reports",
    label: "Reports and quotation",
    icon: "reports",
    description: "Quotations generated after rates are frozen will live here.",
  },
  {
    href: "/clients",
    label: "Clients and suppliers",
    icon: "people",
    description: "Companies you source and quote for will live here.",
  },
  {
    href: "/exchange-rates",
    label: "Exchange rates",
    icon: "rates",
    description: "NGN, USD, EUR, and GBP rates used on estimates.",
  },
  {
    href: "/pricing-rules",
    label: "Pricing rules",
    icon: "rules",
    description: "Percentages used by the pricing engine.",
    roles: ["Sales Director", "Admin", "Super Admin"],
  },
  {
    href: "/admin/users",
    label: "Users & roles",
    icon: "users",
    description: "People who can sign in to this organization.",
    roles: ["Sales Director", "Admin", "Super Admin"],
  },
  {
    href: "/audit",
    label: "Audit trail",
    icon: "audit",
    description: "A record of who changed an estimate, and when.",
  },
];

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
