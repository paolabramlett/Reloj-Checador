"use server";

import { crearClienteServidor } from "@/lib/supabase/server";

const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function registrarCuenta(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completa tu correo y tu contraseña.", exito: false };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres.", exito: false };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${SITIO_URL}/auth/confirm?type=signup` },
  });

  if (error) {
    return {
      error:
        error.code === "user_already_exists"
          ? "Ya existe una cuenta con ese correo. Inicia sesión."
          : "No pudimos crear tu cuenta. Intenta de nuevo.",
      exito: false,
    };
  }

  return { error: null, exito: true };
}
