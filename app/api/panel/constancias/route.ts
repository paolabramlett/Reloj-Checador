import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";

const ETIQUETA_TIPO: Record<string, string> = {
  system_agreement: "Acuerdo con el sistema de registro",
  privacy_notice: "Aviso de privacidad",
};

const ETIQUETA_ORIGEN: Record<string, string> = {
  personal_phone: "Teléfono personal",
  kiosk: "Kiosco",
};

function celdaCsv(valor: string) {
  return `"${valor.replace(/"/g, '""')}"`;
}

export async function GET() {
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return NextResponse.json({ error: "No encontramos tu empresa." }, { status: 403 });

  const supabase = await crearClienteServidor();
  const { data: registros } = await supabase
    .from("consent_records")
    .select("accepted_at, source, employees(full_name), consent_documents(type, version)")
    .eq("company_id", empresa.id)
    .order("accepted_at", { ascending: true });

  const encabezado = ["Empleado", "Documento", "Versión", "Origen", "Fecha de aceptación"];
  const filas = (registros ?? []).map((registro) => {
    const empleado = registro.employees as unknown as { full_name: string } | null;
    const documento = registro.consent_documents as unknown as { type: string; version: number } | null;
    return [
      celdaCsv(empleado?.full_name ?? ""),
      celdaCsv(ETIQUETA_TIPO[documento?.type ?? ""] ?? documento?.type ?? ""),
      celdaCsv(String(documento?.version ?? "")),
      celdaCsv(ETIQUETA_ORIGEN[registro.source] ?? registro.source),
      celdaCsv(new Date(registro.accepted_at).toLocaleString("es-MX")),
    ].join(",");
  });

  const csv = [encabezado.map(celdaCsv).join(","), ...filas].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="constancias-${empresa.nombre}.csv"`,
    },
  });
}
