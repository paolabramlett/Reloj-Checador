import { NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { validarTokenDispositivo } from "@/lib/kiosco";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;
  if (typeof token !== "string") {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const admin = crearClienteAdmin();
  const dispositivo = await validarTokenDispositivo(admin, token);
  if (!dispositivo) {
    return NextResponse.json({ error: "Este kiosco no está registrado o fue revocado." }, { status: 403 });
  }

  const [{ data: empresa }, { data: centro }, { data: empleados }] = await Promise.all([
    admin.from("companies").select("name").eq("id", dispositivo.companyId).single(),
    admin.from("work_centers").select("name").eq("id", dispositivo.workCenterId).single(),
    admin
      .from("employees")
      .select("id, full_name")
      .eq("work_center_id", dispositivo.workCenterId)
      .eq("status", "active")
      .order("full_name"),
  ]);

  await admin
    .from("kiosk_devices")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", dispositivo.deviceId);

  return NextResponse.json({
    companyName: empresa?.name ?? "",
    workCenterName: centro?.name ?? "",
    employees: (empleados ?? []).map((e) => ({ id: e.id, fullName: e.full_name })),
  });
}
