import Image from "next/image";

export function Logo() {
  return (
    <Image
      src="/brand/estimate.png"
      alt="Estimate"
      width={600}
      height={134}
      sizes="144px"
      className="brand-logo"
    />
  );
}
