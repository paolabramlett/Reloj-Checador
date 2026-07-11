import { NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { validarTokenDispositivo } from "@/lib/kiosco";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const { token, employee_id: employeeId, document_ids: documentIds } = body;
  if (
    typeof token !== "string" ||
    typeof employeeId !== "string" ||
    !Array.isArray(documentIds) ||
    documentIds.length === 0
  ) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const admin = crearClienteAdmin();
  const dispositivo = await validarTokenDispositivo(admin, token);
  if (!dispositivo) return NextResponse.json({ error: "Kiosco no válido." }, { status: 403 });

  const { data: empleado } = await admin
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("work_center_id", dispositivo.workCenterId)
    .eq("company_id", dispositivo.companyId)
    .maybeSingle();

  if (!empleado) return NextResponse.json({ error: "Empleado no válido." }, { status: 403 });

  const { error } = await admin.from("consent_records").insert(
    documentIds.map((documentId: string) => ({
      company_id: dispositivo.companyId,
      employee_id: empleado.id,
      document_id: documentId,
      source: "kiosk" as const,
    })),
  );

  if (error) return NextResponse.json({ error: "No pudimos guardar la aceptación." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
