import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "white" | "outline" | "quiet" | "danger";
type Size = "sm" | "md" | "lg" | "xl" | "hero";

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 border-transparent whitespace-nowrap leading-none no-underline transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-[0.1875rem] focus-visible:outline-[#2f4bff] disabled:cursor-progress disabled:opacity-[0.72] enabled:active:translate-y-[0.0625rem]";

const sizes: Record<Size, string> = {
  sm: "h-10 rounded-lg px-[1.0625rem] text-[0.9375rem] font-semibold tracking-normal",
  md: "h-11 rounded-full px-4 text-[0.9375rem] font-bold",
  lg: "h-12 rounded-full px-[1.125rem] text-[1.0625rem] font-bold",
  xl: "mt-[1.375rem] h-16 w-full rounded-2xl text-[1.3125rem] font-medium max-[47.5rem]:h-[3.25rem] max-[47.5rem]:text-base",
  hero: "h-[2.125rem] rounded-full px-3.5 text-[0.8125rem] font-semibold shadow-[0_0.25rem_0.75rem_rgba(10,22,40,0.12)]",
};

function variantClass(variant: Variant, size: Size) {
  if (variant === "primary") {
    return cn(
      "border-[0.0938rem] bg-[image:var(--gradient-brand)] text-white enabled:hover:bg-[image:var(--gradient-brand-hover)] enabled:active:bg-[image:var(--gradient-brand-active)]",
      size === "sm"
        ? "shadow-[0_0.25rem_0.75rem_rgba(47,75,255,0.22)]"
        : "shadow-[0_0.625rem_1.5rem_rgba(47,75,255,0.28)] enabled:hover:shadow-[0_0.875rem_1.75rem_rgba(47,75,255,0.34)]",
    );
  }

  if (variant === "white") {
    return cn(
      "border-[0.0938rem] bg-white text-[#0e0e0e] enabled:hover:bg-[#f4f7ff] enabled:hover:text-[#2f4bff]",
      size === "hero" ? "" : "shadow-[0_0.5rem_1.25rem_rgba(10,22,40,0.08)]",
    );
  }

  if (variant === "outline") {
    return "border-[0.0938rem] border-[#e1e6f2] bg-white text-[#0e0e0e] enabled:hover:border-[#2f4bff] enabled:hover:bg-[#f3f5ff] enabled:hover:text-[#2f4bff]";
  }

  if (variant === "quiet") {
    return "border-[0.0938rem] border-[#e7ebf4] bg-white text-[#171717] shadow-[0_0.125rem_0.625rem_#00000014] enabled:hover:border-[#d9dfec] enabled:hover:bg-[#f7f8fc]";
  }

  return "h-[2.8125rem] rounded-lg border-0 bg-[#da3030] px-[1.375rem] text-[1.0625rem] font-bold tracking-normal text-white shadow-[var(--shadow-signout)] enabled:hover:bg-[#c42828] enabled:active:bg-[#b12222] max-[56.25rem]:h-10 max-[56.25rem]:px-[0.9rem] max-[56.25rem]:text-sm";
}

function buttonClass(variant: Variant, size: Size, fill: boolean, className?: string) {
  return cn(
    base,
    variant === "danger" ? "" : sizes[size],
    variantClass(variant, size),
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
  return <button type={type} className={buttonClass(variant, size, fill, className)} {...props} />;
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
    <Link href={href} className={buttonClass(variant, size, fill, className)}>
      {children}
    </Link>
  );
}
