"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";

type CamposCentro =
  | { ok: false; error: string }
  | { ok: true; nombre: string; lat: number; lng: number; radioM: number };

function leerCampos(formData: FormData): CamposCentro {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const radioM = Number(formData.get("radio_m"));

  if (!nombre) return { ok: false, error: "Ponle un nombre a este centro de trabajo." };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "Toca el mapa para marcar la ubicación." };
  }
  if (!Number.isFinite(radioM) || radioM < 10 || radioM > 5000) {
    return { ok: false, error: "El radio debe estar entre 10 y 5000 metros." };
  }

  return { ok: true, nombre, lat, lng, radioM };
}

export async function crearCentroTrabajo(_prevState: unknown, formData: FormData) {
  const campos = leerCampos(formData);
  if (!campos.ok) return { error: campos.error };

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return { error: "No encontramos tu empresa." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("work_centers").insert({
    company_id: empresa.id,
    name: campos.nombre,
    lat: campos.lat,
    lng: campos.lng,
    geofence_radius_m: campos.radioM,
  });

  if (error) {
    return { error: "No pudimos guardar el centro de trabajo. Intenta de nuevo." };
  }

  redirect("/panel");
}

export async function actualizarCentroTrabajo(_prevState: unknown, formData: FormData) {
  const centroId = String(formData.get("centro_id") ?? "");
  const campos = leerCampos(formData);
  if (!campos.ok) return { error: campos.error };
  if (!centroId) return { error: "Falta identificar el centro de trabajo." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("work_centers")
    .update({
      name: campos.nombre,
      lat: campos.lat,
      lng: campos.lng,
      geofence_radius_m: campos.radioM,
    })
    .eq("id", centroId);

  if (error) {
    return { error: "No pudimos guardar los cambios. Intenta de nuevo." };
  }

  redirect("/panel");
}
