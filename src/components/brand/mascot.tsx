import Image from "next/image";

export function Mascot() {
  return (
    <div className="mascot" aria-hidden>
      <Image
        src="/brand/mascot.png"
        alt=""
        fill
        priority
        sizes="13.75rem"
        className="mascot-img"
      />
    </div>
  );
}
