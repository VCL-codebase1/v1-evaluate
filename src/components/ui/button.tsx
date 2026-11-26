import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "white" | "outline" | "quiet" | "danger";
type Size = "sm" | "md" | "lg" | "xl" | "hero";

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 border-transparent whitespace-nowrap leading-none no-underline transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-[0.1875rem] focus-visible:outline-[#2f4bff]";
const interactive =
  "disabled:cursor-not-allowed disabled:opacity-[0.72] enabled:active:translate-y-[0.0625rem]";

const sizes: Record<Size, string> = {
  sm: "h-10 rounded-lg px-[1.0625rem] text-[0.9375rem] font-semibold tracking-normal",
  md: "h-11 rounded-lg px-4 text-[0.9375rem] font-bold",
  lg: "h-12 rounded-lg px-[1.125rem] text-[1.0625rem] font-bold",
  xl: "mt-[1.375rem] h-16 w-full rounded-2xl text-[1.3125rem] font-medium max-[47.5rem]:h-[3.25rem] max-[47.5rem]:text-base",
  hero: "h-[2.125rem] rounded-lg px-3.5 text-[0.8125rem] font-semibold shadow-[0_0.25rem_0.75rem_rgba(10,22,40,0.12)]",
};

function variantClass(variant: Variant) {
  if (variant === "primary") {
    return "border bg-[image:var(--gradient-brand)] text-white hover:bg-[image:var(--gradient-brand-hover)] active:bg-[image:var(--gradient-brand-active)]";
  }

  if (variant === "white") {
    return "border bg-white text-[var(--ink)] hover:bg-[#f4f7ff]";
  }

  if (variant === "outline") {
    return "border-[0.0938rem] border-[#e1e6f2] bg-white text-[#0e0e0e] hover:border-[#2f4bff] hover:bg-[#f3f5ff] hover:text-[#2f4bff]";
  }

  if (variant === "quiet") {
    return "border-[0.0938rem] border-transparent bg-transparent text-[#26344e] hover:bg-[#e9edfa] hover:text-[#2f4bff]";
  }

  return "h-[2.8125rem] rounded-lg border-0 bg-[#da3030] px-[1.375rem] text-[1.0625rem] font-bold tracking-normal text-white shadow-[var(--shadow-signout)] hover:bg-[#c42828] enabled:active:bg-[#b12222] max-[56.25rem]:h-10 max-[56.25rem]:px-[0.9rem] max-[56.25rem]:text-sm";
}

function buttonClass(variant: Variant, size: Size, fill: boolean, className?: string, interactiveState = false) {
  return cn(
    base,
    interactiveState && interactive,
    variant === "danger" ? "" : sizes[size],
    variantClass(variant),
    fill && "max-[47.5rem]:w-full",
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  fill = false,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fill?: boolean;
}) {
  return <button type={type} className={buttonClass(variant, size, fill, className, true)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fill = false,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  fill?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} prefetch={false} className={buttonClass(variant, size, fill, className)}>
      {children}
    </Link>
  );
}
