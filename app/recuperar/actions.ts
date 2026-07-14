"use server";

import { crearClienteServidor } from "@/lib/supabase/server";

const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function solicitarRecuperacion(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Escribe el correo de tu cuenta.", exito: false };
  }

  const supabase = await crearClienteServidor();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITIO_URL}/auth/confirm?type=recovery`,
  });

  // Misma respuesta exista o no la cuenta: no revelamos qué correos están registrados.
  return { error: null, exito: true };
}
