import Image from "next/image";
import { cn } from "@/lib/cn";

export function Logo({
  children,
  className,
  mark = false,
}: {
  children?: string;
  className?: string;
  mark?: boolean;
}) {
  if (mark) {
    return (
      <Image
        src="/brand/logo.png"
        alt="V1i-Evaluate"
        width={117}
        height={15}
        priority
        className={cn("brand-logo", className)}
        style={{ width: "auto", height: "1.25rem" }}
      />
    );
  }

  return <p className={cn("brand-mark", className)}>{children}</p>;
}
