import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "V11 Estimate",
    template: "%s · V11 Estimate",
  },
  description:
    "One controlled workspace for sourcing costs, exchange rates, markup and approvals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jakarta.className} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
