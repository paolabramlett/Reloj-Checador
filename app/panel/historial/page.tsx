import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { ETIQUETA_EVENTO, type TipoEvento } from "@/lib/fichaje";
import { marcasDelEvento, ETIQUETA_ORIGEN } from "@/lib/marcas";
import { FormularioAnotacion } from "@/components/formulario-anotacion";
import { Boton } from "@/components/ui/button";
import { obtenerAccesoAdmin } from "@/lib/facturacion";
import { BloqueoFacturacion } from "@/components/bloqueo-facturacion";
import { formatearFechaHoraCorta, formatearFecha } from "@/lib/formato-fecha";

function haceDias(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

export default async function PaginaHistorial({
  searchParams,
}: {
  searchParams: Promise<{ empleado?: string; desde?: string; hasta?: string }>;
}) {
  const { empleado: empleadoId, desde, hasta } = await searchParams;
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const fechaDesde = desde || haceDias(30);
  const fechaHasta = hasta || haceDias(0);

  const supabase = await crearClienteServidor();

  if (!(await obtenerAccesoAdmin(supabase, empresa.id))) return <BloqueoFacturacion />;

  const { data: empleados } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("company_id", empresa.id)
    .order("full_name");

  let consulta = supabase
    .from("clock_events")
    .select(
      "id, event_type, source, device_ts, server_ts, flag_late_sync, flag_clock_skew, flag_out_of_fence, flag_sequence_anomaly, employees(full_name)",
    )
    .eq("company_id", empresa.id)
    .gte("device_ts", `${fechaDesde}T00:00:00Z`)
    .lte("device_ts", `${fechaHasta}T23:59:59Z`)
    // device_ts (cuándo pasó), no server_ts (cuándo llegó al servidor) —
    // dos fichajes casi simultáneos pueden llegar en desorden y romper
    // la lectura cronológica de la lista.
    .order("device_ts", { ascending: false });

  if (empleadoId) consulta = consulta.eq("employee_id", empleadoId);

  const { data: eventos } = await consulta;

  const idsEventos = (eventos ?? []).map((e) => e.id);
  const { data: anotaciones } =
    idsEventos.length > 0
      ? await supabase
          .from("clock_event_annotations")
          .select("clock_event_id, motivo, created_at")
          .in("clock_event_id", idsEventos)
      : { data: [] };

  const anotacionesPorEvento = new Map<string, { motivo: string; created_at: string }[]>();
  for (const anotacion of anotaciones ?? []) {
    const lista = anotacionesPorEvento.get(anotacion.clock_event_id) ?? [];
    lista.push(anotacion);
    anotacionesPorEvento.set(anotacion.clock_event_id, lista);
  }

  const { data: correcciones } =
    idsEventos.length > 0
      ? await supabase
          .from("clock_event_corrections")
          .select("opens_event_id, corrected_closing_ts, reason, created_at")
          .in("opens_event_id", idsEventos)
          .order("created_at", { ascending: false })
      : { data: [] };

  // La vigente es la más reciente por opens_event_id — al venir ya
  // ordenada desc por created_at, la primera que se ve por id es la que
  // se queda.
  const correccionVigentePorEvento = new Map<string, { corrected_closing_ts: string; reason: string; created_at: string }>();
  for (const correccion of correcciones ?? []) {
    if (!correccionVigentePorEvento.has(correccion.opens_event_id)) {
      correccionVigentePorEvento.set(correccion.opens_event_id, correccion);
    }
  }

  const parametrosExport = new URLSearchParams({ desde: fechaDesde, hasta: fechaHasta });
  if (empleadoId) parametrosExport.set("empleado", empleadoId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-ink">Historial</h1>

      <form className="flex flex-col gap-3" method="get">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="empleado" className="text-sm font-medium text-ink">
            Empleado
          </label>
          <select
            id="empleado"
            name="empleado"
            defaultValue={empleadoId ?? ""}
            className="min-h-12 rounded-md border border-border px-4 text-base text-ink"
          >
            <option value="">Todos</option>
            {(empleados ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="desde" className="text-sm font-medium text-ink">
              Desde
            </label>
            <input
              id="desde"
              type="date"
              name="desde"
              defaultValue={fechaDesde}
              className="min-h-12 w-full rounded-md border border-border px-3 text-sm text-ink"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="hasta" className="text-sm font-medium text-ink">
              Hasta
            </label>
            <input
              id="hasta"
              type="date"
              name="hasta"
              defaultValue={fechaHasta}
              className="min-h-12 w-full rounded-md border border-border px-3 text-sm text-ink"
            />
          </div>
        </div>
        <Boton type="submit" variante="secundario">
          Filtrar
        </Boton>
      </form>

      <div className="flex gap-3 text-sm">
        <a
          href={`/api/panel/reportes/csv?${parametrosExport.toString()}`}
          className="font-medium text-primary hover:underline"
        >
          Exportar CSV
        </a>
        <a
          href={`/api/panel/reportes/pdf?${parametrosExport.toString()}`}
          className="font-medium text-primary hover:underline"
        >
          Exportar PDF
        </a>
      </div>

      {!eventos || eventos.length === 0 ? (
        <p className="text-muted">No hay fichajes en este periodo.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {eventos.map((evento) => {
            const empleadoNombre = (evento.employees as unknown as { full_name: string } | null)?.full_name;
            const misAnotaciones = anotacionesPorEvento.get(evento.id) ?? [];
            const correccion = correccionVigentePorEvento.get(evento.id);
            return (
              <li key={evento.id} className="flex flex-col gap-2 rounded-md border border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">
                    {empleadoNombre} — {ETIQUETA_EVENTO[evento.event_type as TipoEvento]}
                  </span>
                  <span className="text-sm text-muted">{formatearFechaHoraCorta(evento.device_ts)}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted">
                  <span>{ETIQUETA_ORIGEN[evento.source] ?? evento.source}</span>
                  {marcasDelEvento(evento).map((marca) => (
                    <span key={marca} className={marca === "En vivo" ? "" : "font-medium text-danger"}>
                      · {marca}
                    </span>
                  ))}
                </div>

                {misAnotaciones.length > 0 && (
                  <div className="flex flex-col gap-1 rounded-md bg-surface px-3 py-2 text-xs text-ink">
                    {misAnotaciones.map((anotacion, i) => (
                      <p key={i}>
                        <span className="font-medium">Corrección</span> (
                        {formatearFecha(anotacion.created_at)}): {anotacion.motivo}
                      </p>
                    ))}
                  </div>
                )}

                {correccion && (
                  <div className="flex flex-col gap-1 rounded-md bg-primary-tint px-3 py-2 text-xs text-ink">
                    <p>
                      <span className="font-medium">Corrección vigente</span> ({formatearFecha(correccion.created_at)}):
                      cierre real {formatearFechaHoraCorta(correccion.corrected_closing_ts)} — {correccion.reason}
                    </p>
                  </div>
                )}

                <FormularioAnotacion clockEventId={evento.id} />
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/panel" className="text-sm font-medium text-primary hover:underline">
        ← Volver al panel
      </Link>
    </main>
  );
}
