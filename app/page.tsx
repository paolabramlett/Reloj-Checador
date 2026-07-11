import Link from "next/link";
import { Boton } from "@/components/ui/button";

export default function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-3xl font-bold text-ink">Reloj Checador</h1>
      <p className="text-muted">Registro de asistencia para tu negocio. En construcción.</p>
      <Link href="/login" className="w-full">
        <Boton type="button">Iniciar sesión</Boton>
      </Link>
    </main>
  );
}
