"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { interpretarFechaHoraLocalComoUTC } from "@/lib/formato-fecha";

export async function crearCorreccion(_prevState: unknown, formData: FormData) {
  const opensEventId = String(formData.get("opens_event_id") ?? "");
  const employeeId = String(formData.get("employee_id") ?? "");
  const closesEventId = String(formData.get("closes_event_id") ?? "") || null;
  const horaLocal = String(formData.get("corrected_closing_ts") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!opensEventId || !employeeId || !horaLocal || !reason) {
    return { error: "Completa la hora y el motivo de la corrección.", guardadoEn: null };
  }

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return { error: "No encontramos tu empresa.", guardadoEn: null };

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión inválida.", guardadoEn: null };

  const { data: eventoApertura } = await supabase
    .from("clock_events")
    .select("device_ts")
    .eq("id", opensEventId)
    .eq("company_id", empresa.id)
    .single();

  if (!eventoApertura) return { error: "No encontramos el fichaje a corregir.", guardadoEn: null };

  const correctedClosingTs = interpretarFechaHoraLocalComoUTC(horaLocal);
  if (Number.isNaN(correctedClosingTs.getTime())) {
    return { error: "La hora que capturaste no es válida.", guardadoEn: null };
  }
  if (correctedClosingTs.getTime() <= new Date(eventoApertura.device_ts).getTime()) {
    return { error: "La hora corregida tiene que ser después de cuándo empezó el tramo.", guardadoEn: null };
  }
  if (correctedClosingTs.getTime() > Date.now()) {
    return { error: "La hora corregida no puede estar en el futuro.", guardadoEn: null };
  }

  const { error } = await supabase.from("clock_event_corrections").insert({
    company_id: empresa.id,
    employee_id: employeeId,
    opens_event_id: opensEventId,
    closes_event_id: closesEventId,
    corrected_closing_ts: correctedClosingTs.toISOString(),
    reason,
    created_by: user.id,
  });

  if (error) return { error: "No pudimos guardar la corrección. Intenta de nuevo.", guardadoEn: null };

  return { error: null, guardadoEn: Date.now() };
}
