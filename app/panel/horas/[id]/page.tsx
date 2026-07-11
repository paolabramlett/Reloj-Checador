import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { inicioSemanaActual, calcularNivelAlerta } from "@/lib/semana";
import { ETIQUETA_EVENTO, type TipoEvento } from "@/lib/fichaje";
import { marcasDelEvento, ETIQUETA_ORIGEN } from "@/lib/marcas";
import { obtenerAccesoAdmin } from "@/lib/facturacion";
import { BloqueoFacturacion } from "@/components/bloqueo-facturacion";

export default async function PaginaDetalleHoras({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const supabase = await crearClienteServidor();

  if (!(await obtenerAccesoAdmin(supabase, empresa.id))) return <BloqueoFacturacion />;

  const inicioSemana = inicioSemanaActual();
  const anioActual = new Date().getUTCFullYear();

  const [{ data: empleado }, { data: limite }, { data: horas }, { data: eventos }] = await Promise.all([
    supabase.from("employees").select("id, full_name").eq("id", id).eq("company_id", empresa.id).maybeSingle(),
    supabase.rpc("legal_weekly_hours", { p_year: anioActual }),
    supabase.rpc("weekly_hours_for_employee", { p_employee_id: id, p_week_start: inicioSemana }),
    supabase
      .from("clock_events")
      .select("event_type, source, device_ts, server_ts, flag_late_sync, flag_clock_skew, flag_out_of_fence, flag_sequence_anomaly")
      .eq("employee_id", id)
      .gte("server_ts", `${inicioSemana}T00:00:00Z`)
      .order("server_ts", { ascending: true }),
  ]);

  if (!empleado) notFound();

  const limiteSemanal = Number(limite ?? 40);
  const horasNumero = Number(horas ?? 0);
  const nivel = calcularNivelAlerta(horasNumero, limiteSemanal);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">{empleado.full_name}</h1>
        <p className="text-sm text-muted">
          {horasNumero.toFixed(1)} de {limiteSemanal} horas esta semana
          {nivel === "exceso" && " — excedido"}
          {nivel === "proximidad" && " — cerca del límite"}
        </p>
      </div>

      {!eventos || eventos.length === 0 ? (
        <p className="text-muted">Sin fichajes esta semana.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {eventos.map((evento, indice) => (
            <li key={indice} className="flex flex-col gap-1 rounded-md border border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">{ETIQUETA_EVENTO[evento.event_type as TipoEvento]}</span>
                <span className="text-sm text-muted">
                  {new Date(evento.device_ts).toLocaleString("es-MX", {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <span>{ETIQUETA_ORIGEN[evento.source] ?? evento.source}</span>
                {marcasDelEvento(evento).map((marca) => (
                  <span
                    key={marca}
                    className={marca === "En vivo" ? "" : "font-medium text-danger"}
                  >
                    · {marca}
                  </span>
                ))}
              </div>
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
