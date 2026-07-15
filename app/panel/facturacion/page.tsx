import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { diasDeTrialRestantes } from "@/lib/facturacion";
import { Boton } from "@/components/ui/button";
import { Mensaje } from "@/components/ui/mensaje";
import { iniciarCheckout, abrirPortal } from "./actions";

const ETIQUETA_ESTADO: Record<string, string> = {
  trialing: "En periodo de prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
};

const RANGOS = [
  {
    key: "hasta_10",
    etiqueta: "Hasta 10 empleados",
    mensual: "$179 MXN / mes",
    anual: "$1,790 MXN / año (2 meses gratis)",
  },
  {
    key: "hasta_25",
    etiqueta: "Hasta 25 empleados",
    mensual: "$349 MXN / mes",
    anual: "$3,490 MXN / año (2 meses gratis)",
  },
] as const;

export default async function PaginaFacturacion({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const empresaActiva = await obtenerEmpresaActiva();
  if (!empresaActiva) redirect("/panel");

  const supabase = await crearClienteServidor();
  const { data: empresa } = await supabase
    .from("companies")
    .select("subscription_status, trial_ends_at, stripe_customer_id")
    .eq("id", empresaActiva.id)
    .single();

  if (!empresa) redirect("/panel");

  const diasRestantes = diasDeTrialRestantes(empresa.trial_ends_at);
  const yaTieneSuscripcion = Boolean(empresa.stripe_customer_id);
  // Suscribirse siempre debe estar disponible, no solo cuando ya está
  // bloqueado — alguien en trial también puede querer pagar ahora.
  const puedeSuscribirse = empresa.subscription_status !== "active";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-ink">Facturación</h1>

      {checkout === "exito" && (
        <Mensaje tono="exito">
          ¡Listo! Puede tardar un momento en reflejarse mientras confirmamos el pago.
        </Mensaje>
      )}
      {checkout === "cancelado" && <Mensaje tono="error">No se completó el pago.</Mensaje>}

      <div className="flex flex-col gap-1 rounded-md border border-border px-4 py-3">
        <p className="text-sm text-muted">Estado</p>
        <p className="text-lg font-medium text-ink">{ETIQUETA_ESTADO[empresa.subscription_status]}</p>
        {empresa.subscription_status === "trialing" && (
          <p className="text-sm text-muted">
            {diasRestantes > 0
              ? `${diasRestantes} ${diasRestantes === 1 ? "día" : "días"} de prueba restantes.`
              : "Tu prueba terminó."}
          </p>
        )}
        {empresa.subscription_status === "past_due" && (
          <p className="text-sm text-danger">
            Tu pago no se completó. Los tableros y reportes están bloqueados hasta que se regularice.
          </p>
        )}
      </div>

      {puedeSuscribirse && (
        <div className="flex flex-col gap-6">
          {RANGOS.map((rango) => (
            <form key={rango.key} action={iniciarCheckout} className="flex flex-col gap-3">
              <input type="hidden" name="rango" value={rango.key} />
              <p className="text-sm text-ink">{rango.etiqueta}:</p>
              <Boton type="submit" name="plan" value="monthly">
                {rango.mensual}
              </Boton>
              <Boton type="submit" name="plan" value="annual" variante="secundario">
                {rango.anual}
              </Boton>
            </form>
          ))}
          <p className="text-xs text-muted">
            Por ahora, pago con tarjeta. OXXO y SPEI llegan pronto.
          </p>
        </div>
      )}

      {yaTieneSuscripcion && (
        <form action={abrirPortal}>
          <Boton type="submit" variante="secundario">
            Gestionar suscripción
          </Boton>
        </form>
      )}
    </main>
  );
}
