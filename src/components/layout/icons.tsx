import Image from "next/image";
import type { SVGProps } from "react";
import type { NavIconName } from "@/lib/navigation";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" {...stroke} />
    </Svg>
  );
}

export function RfqIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3.5h7.2L18.5 8v11.2a1.3 1.3 0 0 1-1.3 1.3H7A1.3 1.3 0 0 1 5.7 19.2V4.8A1.3 1.3 0 0 1 7 3.5Z" {...stroke} />
      <path d="M14 3.8V8h4.2M8.2 12.2h7.6M8.2 15.8h5" {...stroke} />
    </Svg>
  );
}

export function AuditIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7.5" {...stroke} />
      <path d="M12 8.2V12l2.8 2" {...stroke} />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" fill="#3DDC97" />
      <path d="M8 12.2 10.7 14.9 16 9.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function DocumentGlyph(props: IconProps) {
  return <RfqIcon {...props} />;
}

export function ClockGlyph(props: IconProps) {
  return <AuditIcon {...props} />;
}

export function CheckGlyph(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" {...stroke} />
      <path d="M8.2 12.2 10.8 14.8 15.8 9.6" {...stroke} />
    </Svg>
  );
}

export function ReturnGlyph(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 8.5H16a4 4 0 0 1 0 8H8" {...stroke} />
      <path d="M10.5 6 7 8.5 10.5 11" {...stroke} />
    </Svg>
  );
}

const NAV_ICON_SRC: Record<NavIconName, string> = {
  dashboard: "/icons/dashboard.png",
  rfq: "/icons/document.png",
  sheet: "/icons/table.png",
  approval: "/icons/tick.png",
  reports: "/icons/chart.png",
  people: "/icons/person.png",
  rates: "/icons/exchange.png",
  audit: "/icons/audit.png",
};

export function NavIcon({ name }: { name: NavIconName }) {
  return <Image src={NAV_ICON_SRC[name]} alt="" width={22} height={22} />;
}
