import { NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { validarTokenDispositivo, verificarPinConBloqueo } from "@/lib/kiosco";
import { faltanAceptar } from "@/lib/consentimiento";
import { estadoDesdeUltimoEvento, type EstadoFichaje, type TipoEvento } from "@/lib/fichaje";

const SIGUIENTE_POR_DEFECTO: Record<EstadoFichaje, TipoEvento> = {
  out: "clock_in",
  working: "clock_out",
  on_break: "break_end",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });

  const { token, employee_id: employeeId, pin } = body;
  if (typeof token !== "string" || typeof employeeId !== "string" || typeof pin !== "string") {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }

  const admin = crearClienteAdmin();
  const dispositivo = await validarTokenDispositivo(admin, token);
  if (!dispositivo) {
    return NextResponse.json({ ok: false, error: "Kiosco no válido." }, { status: 403 });
  }

  const { data: empleado } = await admin
    .from("employees")
    .select("id, full_name, pin_hash, status")
    .eq("id", employeeId)
    .eq("work_center_id", dispositivo.workCenterId)
    .eq("company_id", dispositivo.companyId)
    .maybeSingle();

  if (!empleado || empleado.status !== "active") {
    return NextResponse.json({ ok: false, error: "Empleado no válido." }, { status: 403 });
  }

  const { data: config } = await admin
    .from("system_settings")
    .select("pin_lockout_attempts, pin_lockout_minutes")
    .single();

  const resultado = await verificarPinConBloqueo(
    admin,
    empleado.id,
    dispositivo.companyId,
    pin,
    empleado.pin_hash,
    config?.pin_lockout_attempts ?? 5,
    config?.pin_lockout_minutes ?? 5,
  );

  if (!resultado.ok) return NextResponse.json(resultado, { status: 401 });

  const { data: ultimoEvento } = await admin
    .from("clock_events")
    .select("event_type")
    .eq("employee_id", empleado.id)
    .order("server_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const estadoActual = estadoDesdeUltimoEvento((ultimoEvento?.event_type as TipoEvento) ?? null);
  const documentosFaltantes = await faltanAceptar(admin, empleado.id);

  return NextResponse.json({
    ok: true,
    nombre: empleado.full_name,
    estadoActual,
    eventoSugerido: SIGUIENTE_POR_DEFECTO[estadoActual],
    documentosFaltantes,
  });
}
