import Image from "next/image";

interface LogoProps {
  className?: string;
  ancho?: number;
}

export function Logo({ className = "", ancho = 160 }: LogoProps) {
  const alto = Math.round(ancho * (494 / 2310));
  return (
    <Image
      src="/logo.png"
      alt="Chekly"
      width={ancho}
      height={alto}
      priority
      className={className}
    />
  );
}
