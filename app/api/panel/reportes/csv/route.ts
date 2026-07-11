import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { ETIQUETA_EVENTO, type TipoEvento } from "@/lib/fichaje";
import { marcasDelEvento, ETIQUETA_ORIGEN } from "@/lib/marcas";
import { obtenerAccesoAdmin } from "@/lib/facturacion";

function celdaCsv(valor: string) {
  return `"${valor.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return NextResponse.json({ error: "No encontramos tu empresa." }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const empleadoId = searchParams.get("empleado");
  const desde = searchParams.get("desde") ?? new Date().toISOString().slice(0, 10);
  const hasta = searchParams.get("hasta") ?? new Date().toISOString().slice(0, 10);

  const supabase = await crearClienteServidor();

  if (!(await obtenerAccesoAdmin(supabase, empresa.id))) {
    return NextResponse.redirect(new URL("/panel/facturacion", request.url));
  }
  let consulta = supabase
    .from("clock_events")
    .select(
      "event_type, source, device_ts, server_ts, flag_late_sync, flag_clock_skew, flag_out_of_fence, flag_sequence_anomaly, employees(full_name), work_centers(name)",
    )
    .eq("company_id", empresa.id)
    .gte("device_ts", `${desde}T00:00:00Z`)
    .lte("device_ts", `${hasta}T23:59:59Z`)
    .order("server_ts", { ascending: true });

  if (empleadoId) consulta = consulta.eq("employee_id", empleadoId);

  const { data: eventos } = await consulta;

  const encabezado = [
    "Empleado",
    "Centro de trabajo",
    "Tipo",
    "Origen",
    "Hora del dispositivo",
    "Hora de recepción",
    "Marcas",
  ];

  const filas = (eventos ?? []).map((evento) => {
    const empleado = evento.employees as unknown as { full_name: string } | null;
    const centro = evento.work_centers as unknown as { name: string } | null;
    return [
      celdaCsv(empleado?.full_name ?? ""),
      celdaCsv(centro?.name ?? ""),
      celdaCsv(ETIQUETA_EVENTO[evento.event_type as TipoEvento] ?? evento.event_type),
      celdaCsv(ETIQUETA_ORIGEN[evento.source] ?? evento.source),
      celdaCsv(new Date(evento.device_ts).toLocaleString("es-MX")),
      celdaCsv(new Date(evento.server_ts).toLocaleString("es-MX")),
      celdaCsv(marcasDelEvento(evento).join("; ")),
    ].join(",");
  });

  const csv = [encabezado.map(celdaCsv).join(","), ...filas].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fichajes-${empresa.nombre}-${desde}-a-${hasta}.csv"`,
    },
  });
}
