import Link from "next/link";
import { Boton } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <Logo ancho={200} />
      <p className="text-muted">Registro de asistencia para tu negocio. En construcción.</p>
      <Link href="/login" className="w-full">
        <Boton type="button">Iniciar sesión</Boton>
      </Link>
    </main>
  );
}
