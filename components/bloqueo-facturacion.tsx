import Link from "next/link";
import { Boton } from "@/components/ui/button";

// Bloqueo suave (spec billing): tableros y reportes se pausan, pero el
// fichaje de los empleados y el guardado de sus registros nunca se tocan.
export function BloqueoFacturacion() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-xl font-semibold text-ink">Esta sección está pausada</h1>
      <p className="text-muted">
        Tu periodo de prueba terminó o tu pago no se completó. Tus empleados pueden seguir
        fichando sin problema — solo los tableros y reportes quedan pausados hasta regularizar el
        pago.
      </p>
      <Link href="/panel/facturacion" className="w-full">
        <Boton type="button">Ir a facturación</Boton>
      </Link>
    </main>
  );
}
