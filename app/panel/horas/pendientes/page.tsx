import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { obtenerAccesoAdmin } from "@/lib/facturacion";
import { BloqueoFacturacion } from "@/components/bloqueo-facturacion";
import { FormularioCorreccion } from "@/components/formulario-correccion";
import { ETIQUETA_EVENTO, type TipoEvento } from "@/lib/fichaje";
import { formatearFechaHoraCorta } from "@/lib/formato-fecha";

const ETIQUETA_MOTIVO: Record<string, string> = {
  abierto: "Sigue abierto",
  anomalia: "Cierre marcado como anomalía",
};

export default async function PaginaPendientes() {
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const supabase = await crearClienteServidor();
  if (!(await obtenerAccesoAdmin(supabase, empresa.id))) return <BloqueoFacturacion />;

  const { data: pendientes, error: errorPendientes } = await supabase.rpc("tramos_pendientes_revision", {
    p_company_id: empresa.id,
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Pendientes de revisión</h1>
        <p className="text-sm text-muted">
          Turnos o descansos que se quedaron abiertos, o que se cerraron sospechosamente tarde.
        </p>
      </div>

      {errorPendientes ? (
        // No mostrar "nada pendiente" cuando en realidad no pudimos
        // consultar: en una página de cumplimiento, confundir un error
        // con "todo en orden" es peor que no decir nada.
        <p className="text-sm font-medium text-danger">
          No pudimos cargar los pendientes de revisión. Intenta de nuevo más tarde.
        </p>
      ) : !pendientes || pendientes.length === 0 ? (
        <p className="text-muted">No hay nada pendiente de revisión.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pendientes.map((tramo: {
            employee_id: string;
            employee_name: string;
            opens_event_id: string;
            opens_type: string;
            opens_device_ts: string;
            horas_abierto: number;
            motivo: string;
          }) => (
            <li key={tramo.opens_event_id} className="flex flex-col gap-2 rounded-md border border-border px-4 py-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-ink">{tramo.employee_name}</span>
                <span className="text-sm text-muted">
                  {ETIQUETA_EVENTO[tramo.opens_type as TipoEvento]} — {formatearFechaHoraCorta(tramo.opens_device_ts)}
                </span>
                <span className="text-sm font-medium text-danger">
                  {ETIQUETA_MOTIVO[tramo.motivo] ?? tramo.motivo} · {tramo.horas_abierto.toFixed(1)} h
                </span>
              </div>
              <FormularioCorreccion opensEventId={tramo.opens_event_id} employeeId={tramo.employee_id} />
            </li>
          ))}
        </ul>
      )}

      <Link href="/panel/horas" className="text-sm font-medium text-primary hover:underline">
        ← Volver al tablero de horas
      </Link>
    </main>
  );
}
