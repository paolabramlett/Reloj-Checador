import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { ETIQUETA_EVENTO, type TipoEvento } from "@/lib/fichaje";
import { marcasDelEvento, ETIQUETA_ORIGEN } from "@/lib/marcas";
import { obtenerAccesoAdmin } from "@/lib/facturacion";

const COLUMNAS = [
  { titulo: "Empleado", ancho: 100 },
  { titulo: "Tipo", ancho: 70 },
  { titulo: "Origen", ancho: 70 },
  { titulo: "Hora dispositivo", ancho: 95 },
  { titulo: "Hora recepción", ancho: 95 },
  { titulo: "Marcas", ancho: 90 },
];
const MARGEN = 40;

function generarPdf(
  empresaNombre: string,
  desde: string,
  hasta: string,
  filas: string[][],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGEN, layout: "landscape" });
    const trozos: Buffer[] = [];
    doc.on("data", (trozo) => trozos.push(trozo));
    doc.on("end", () => resolve(Buffer.concat(trozos)));
    doc.on("error", reject);

    doc.fontSize(16).text(empresaNombre, { align: "left" });
    doc.fontSize(11).fillColor("#555").text(`Reporte de asistencia — del ${desde} al ${hasta}`);
    doc.moveDown(1);

    function encabezadoTabla() {
      let x = MARGEN;
      const y = doc.y;
      doc.fontSize(9).fillColor("#000");
      for (const columna of COLUMNAS) {
        doc.text(columna.titulo, x, y, { width: columna.ancho, continued: false });
        x += columna.ancho;
      }
      doc.moveDown(0.5);
      doc
        .moveTo(MARGEN, doc.y)
        .lineTo(MARGEN + COLUMNAS.reduce((suma, c) => suma + c.ancho, 0), doc.y)
        .strokeColor("#ccc")
        .stroke();
      doc.moveDown(0.3);
    }

    encabezadoTabla();

    for (const fila of filas) {
      if (doc.y > doc.page.height - MARGEN - 40) {
        doc.addPage();
        encabezadoTabla();
      }
      let x = MARGEN;
      const yFila = doc.y;
      doc.fontSize(8).fillColor("#111");
      fila.forEach((celda, indice) => {
        doc.text(celda, x, yFila, { width: COLUMNAS[indice].ancho });
        x += COLUMNAS[indice].ancho;
      });
      doc.moveDown(0.6);
    }

    if (filas.length === 0) {
      doc.fontSize(10).fillColor("#555").text("No hay fichajes en este periodo.");
    }

    doc.end();
  });
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
      "event_type, source, device_ts, server_ts, flag_late_sync, flag_clock_skew, flag_out_of_fence, flag_sequence_anomaly, employees(full_name)",
    )
    .eq("company_id", empresa.id)
    .gte("device_ts", `${desde}T00:00:00Z`)
    .lte("device_ts", `${hasta}T23:59:59Z`)
    .order("server_ts", { ascending: true });

  if (empleadoId) consulta = consulta.eq("employee_id", empleadoId);

  const { data: eventos } = await consulta;

  const filas = (eventos ?? []).map((evento) => {
    const empleado = evento.employees as unknown as { full_name: string } | null;
    return [
      empleado?.full_name ?? "",
      ETIQUETA_EVENTO[evento.event_type as TipoEvento] ?? evento.event_type,
      ETIQUETA_ORIGEN[evento.source] ?? evento.source,
      new Date(evento.device_ts).toLocaleString("es-MX"),
      new Date(evento.server_ts).toLocaleString("es-MX"),
      marcasDelEvento(evento).join(", "),
    ];
  });

  const pdf = await generarPdf(empresa.nombre, desde, hasta, filas);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fichajes-${empresa.nombre}-${desde}-a-${hasta}.pdf"`,
    },
  });
}
