import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_EVENTO, type TipoEvento } from "@/lib/fichaje";
import { marcasDelEvento, ETIQUETA_ORIGEN } from "@/lib/marcas";
import { formatearFechaHoraCorta, formatearFecha } from "@/lib/formato-fecha";

export default async function PaginaHistorialPropio() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: empleado } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!empleado) redirect("/panel");

  const desde = new Date();
  desde.setUTCDate(desde.getUTCDate() - 30);

  const { data: eventos } = await supabase
    .from("clock_events")
    .select("id, event_type, source, device_ts, flag_late_sync, flag_clock_skew, flag_out_of_fence, flag_sequence_anomaly")
    .eq("employee_id", empleado.id)
    .gte("device_ts", desde.toISOString())
    .order("device_ts", { ascending: false });

  const idsEventos = (eventos ?? []).map((e) => e.id);
  const { data: correcciones } =
    idsEventos.length > 0
      ? await supabase
          .from("clock_event_corrections")
          .select("opens_event_id, corrected_closing_ts, reason, created_at")
          .in("opens_event_id", idsEventos)
          .order("created_at", { ascending: false })
      : { data: [] };

  const correccionVigentePorEvento = new Map<string, { corrected_closing_ts: string; reason: string; created_at: string }>();
  for (const correccion of correcciones ?? []) {
    if (!correccionVigentePorEvento.has(correccion.opens_event_id)) {
      correccionVigentePorEvento.set(correccion.opens_event_id, correccion);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-ink">Tu historial</h1>
      <p className="text-sm text-muted">Últimos 30 días.</p>

      {!eventos || eventos.length === 0 ? (
        <p className="text-muted">No hay fichajes en este periodo.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {eventos.map((evento) => {
            const correccion = correccionVigentePorEvento.get(evento.id);
            return (
              <li key={evento.id} className="flex flex-col gap-2 rounded-md border border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{ETIQUETA_EVENTO[evento.event_type as TipoEvento]}</span>
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
                {correccion && (
                  <div className="flex flex-col gap-1 rounded-md bg-primary-tint px-3 py-2 text-xs text-ink">
                    <p>
                      <span className="font-medium">Corrección</span> ({formatearFecha(correccion.created_at)}): cierre real{" "}
                      {formatearFechaHoraCorta(correccion.corrected_closing_ts)} — {correccion.reason}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/mi-cuenta" className="text-sm font-medium text-primary hover:underline">
        ← Volver
      </Link>
    </main>
  );
}
