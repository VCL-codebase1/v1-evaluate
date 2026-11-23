import Image from "next/image";
import { Logo } from "@/components/brand/logo";

export function AuthShowcase() {
  return (
    <div className="auth-showcase">
      <div className="auth-showcase-inner">
        <Logo />
        <Image className="auth-art" src="/brand/quotation.svg" width={600} height={440} alt="" />
      </div>
    </div>
  );
}
