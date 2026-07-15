"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { generarTokenKiosco, hashTokenKiosco } from "@/lib/kiosco";

const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function registrarKiosco(_prevState: unknown, formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim() || "Kiosco";
  const workCenterId = String(formData.get("work_center_id") ?? "");

  if (!workCenterId) return { error: "Elige a qué centro de trabajo pertenece.", link: null };

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return { error: "No encontramos tu empresa.", link: null };

  const token = generarTokenKiosco();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("kiosk_devices").insert({
    company_id: empresa.id,
    work_center_id: workCenterId,
    name: nombre,
    token_hash: hashTokenKiosco(token),
  });

  if (error) return { error: "No pudimos registrar el kiosco. Intenta de nuevo.", link: null };

  return { error: null, link: `${SITIO_URL}/kiosco/${token}` };
}

export async function revocarKiosco(formData: FormData) {
  const kioscoId = String(formData.get("kiosco_id") ?? "");
  if (!kioscoId) return;

  const supabase = await crearClienteServidor();
  await supabase
    .from("kiosk_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", kioscoId);

  redirect("/panel/kioscos");
}
