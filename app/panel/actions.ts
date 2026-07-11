"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fijarEmpresaActiva, obtenerEmpresaActiva } from "@/lib/empresa-activa";

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function crearEmpresa(_prevState: unknown, formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) {
    return { error: "Escribe el nombre de tu negocio." };
  }

  const supabase = await crearClienteServidor();
  const { data: companyId, error } = await supabase.rpc("create_company_with_owner", {
    company_name: nombre,
  });

  if (error) {
    return { error: "No pudimos crear tu empresa. Intenta de nuevo." };
  }

  await fijarEmpresaActiva(companyId as string);
  redirect("/panel/centros/nuevo?bienvenida=1");
}

export async function actualizarEmpresa(_prevState: unknown, formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) {
    return { error: "El nombre no puede quedar vacío." };
  }

  const empresa = await obtenerEmpresaActiva();
  if (!empresa) return { error: "No encontramos tu empresa." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("companies").update({ name: nombre }).eq("id", empresa.id);

  if (error) {
    return { error: "No pudimos guardar el cambio. Intenta de nuevo." };
  }

  return { error: null, exito: true };
}

export async function seleccionarEmpresa(formData: FormData) {
  const companyId = String(formData.get("company_id") ?? "");
  if (companyId) await fijarEmpresaActiva(companyId);
  redirect("/panel");
}
