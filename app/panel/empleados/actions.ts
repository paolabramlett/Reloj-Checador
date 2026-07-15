"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { hashPin, PIN_REGEX } from "@/lib/pin";
import { limiteEfectivoDeEmpleados } from "@/lib/facturacion";

type CamposEmpleado =
  | { ok: false; error: string }
  | { ok: true; nombre: string; workCenterId: string; pin: string | null };

function leerCampos(formData: FormData): CamposEmpleado {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const workCenterId = String(formData.get("work_center_id") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();

  if (!nombre) return { ok: false, error: "Escribe el nombre del empleado." };
  if (!workCenterId) return { ok: false, error: "Elige a qué centro de trabajo pertenece." };
  if (pin && !PIN_REGEX.test(pin)) {
    return { ok: false, error: "El PIN debe ser de 4 dígitos." };
  }

  return { ok: true, nombre, workCenterId, pin: pin || null };
}

// Los códigos 23505 (PIN duplicado en la empresa) y 23503 (centro de
// trabajo de otra empresa, imposible de todos modos por RLS) son los
// únicos que puede disparar esta tabla; cualquier otro es un error genérico.
function mensajeDeErrorDb(error: { code?: string }): string {
  if (error.code === "23505") return "Ese PIN ya lo tiene otro empleado. Elige otro.";
  return "No pudimos guardar. Intenta de nuevo.";
}

// Cuenta empleados activos y compara contra el tope efectivo del rango
// contratado (spec: docs/superpowers/specs/2026-07-14-plan-hasta-25-empleados-design.md,
// decisión 6 — bloqueo duro sobre altas nuevas, nunca sobre el fichaje).
async function limiteAlcanzado(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ alcanzado: boolean; limite: number | null }> {
  const { data: empresa } = await supabase
    .from("companies")
    .select("subscription_status, employee_range")
    .eq("id", companyId)
    .single();

  if (!empresa) return { alcanzado: false, limite: null };

  const limite = limiteEfectivoDeEmpleados(empresa);
  if (limite === null) return { alcanzado: false, limite: null };

  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "active");

  return { alcanzado: (count ?? 0) >= limite, limite };
}

export async function crearEmpleado(_prevState: unknown, formData: FormData) {
  const campos = leerCampos(formData);
  if (!campos.ok) return { error: campos.error };

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return { error: "No encontramos tu empresa." };

  const supabase = await crearClienteServidor();

  const { alcanzado, limite } = await limiteAlcanzado(supabase, empresa.id);
  if (alcanzado) {
    return {
      error: `Llegaste al límite de tu plan (${limite} empleados). Sube de plan en Facturación para agregar más.`,
    };
  }

  const { error } = await supabase.from("employees").insert({
    company_id: empresa.id,
    work_center_id: campos.workCenterId,
    full_name: campos.nombre,
    pin_hash: campos.pin ? hashPin(empresa.id, campos.pin) : null,
  });

  if (error) return { error: mensajeDeErrorDb(error) };

  redirect("/panel/empleados");
}

export async function actualizarEmpleado(_prevState: unknown, formData: FormData) {
  const empleadoId = String(formData.get("empleado_id") ?? "");
  const campos = leerCampos(formData);
  if (!campos.ok) return { error: campos.error };
  if (!empleadoId) return { error: "Falta identificar al empleado." };

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return { error: "No encontramos tu empresa." };

  const cambios: Record<string, unknown> = {
    full_name: campos.nombre,
    work_center_id: campos.workCenterId,
  };
  // Blanco = no tocar el PIN existente; "quitar PIN" es una acción aparte.
  if (campos.pin) cambios.pin_hash = hashPin(empresa.id, campos.pin);

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("employees").update(cambios).eq("id", empleadoId);

  if (error) return { error: mensajeDeErrorDb(error) };

  redirect("/panel/empleados");
}

export async function quitarPin(formData: FormData) {
  const empleadoId = String(formData.get("empleado_id") ?? "");
  if (!empleadoId) return;

  const supabase = await crearClienteServidor();
  await supabase.from("employees").update({ pin_hash: null }).eq("id", empleadoId);
  redirect(`/panel/empleados/${empleadoId}`);
}

export async function darDeBaja(formData: FormData) {
  const empleadoId = String(formData.get("empleado_id") ?? "");
  if (!empleadoId) return;

  const supabase = await crearClienteServidor();
  await supabase
    .from("employees")
    .update({ status: "terminated", terminated_at: new Date().toISOString() })
    .eq("id", empleadoId);

  redirect("/panel/empleados");
}

export async function reactivar(formData: FormData) {
  const empleadoId = String(formData.get("empleado_id") ?? "");
  if (!empleadoId) return;

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return;

  const supabase = await crearClienteServidor();

  const { alcanzado, limite } = await limiteAlcanzado(supabase, empresa.id);
  if (alcanzado) {
    redirect(`/panel/empleados/${empleadoId}?error=limite&limite=${limite}`);
  }

  await supabase
    .from("employees")
    .update({ status: "active", terminated_at: null })
    .eq("id", empleadoId);

  redirect("/panel/empleados");
}
