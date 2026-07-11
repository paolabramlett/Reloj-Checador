"use server";

import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";

export async function agregarAnotacion(_prevState: unknown, formData: FormData) {
  const clockEventId = String(formData.get("clock_event_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!clockEventId || !motivo) return { error: "Escribe el motivo de la corrección.", guardadoEn: null };

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return { error: "No encontramos tu empresa.", guardadoEn: null };

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión inválida.", guardadoEn: null };

  const { error } = await supabase.from("clock_event_annotations").insert({
    clock_event_id: clockEventId,
    company_id: empresa.id,
    created_by: user.id,
    motivo,
  });

  if (error) return { error: "No pudimos guardar la anotación. Intenta de nuevo.", guardadoEn: null };

  return { error: null, guardadoEn: Date.now() };
}
