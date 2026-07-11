"use server";

import { redirect } from "next/navigation";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hashTokenInvitacion } from "@/lib/invitacion";

async function buscarInvitacionValida(token: string) {
  const admin = crearClienteAdmin();
  const tokenHash = hashTokenInvitacion(token);

  const { data: invitacion } = await admin
    .from("employee_invitations")
    .select("id, employee_id, expires_at, used_at, employees(auth_user_id, status)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const empleado = invitacion?.employees as unknown as {
    auth_user_id: string | null;
    status: string;
  } | null;

  const valida =
    !!invitacion &&
    !invitacion.used_at &&
    new Date(invitacion.expires_at) > new Date() &&
    !!empleado &&
    !empleado.auth_user_id &&
    empleado.status === "active";

  return valida ? { admin, invitacion } : null;
}

export async function reclamarInvitacion(_prevState: unknown, formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Completa tu correo y tu contraseña." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const resultado = await buscarInvitacionValida(token);
  if (!resultado) return { error: "Este enlace ya no es válido. Pide uno nuevo." };
  const { admin, invitacion } = resultado;

  const { data: nuevoUsuario, error: errorCrear } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (errorCrear || !nuevoUsuario.user) {
    return {
      error:
        errorCrear?.code === "email_exists"
          ? "Ya existe una cuenta con ese correo. Usa otro."
          : "No pudimos crear tu acceso. Intenta de nuevo.",
    };
  }

  await admin
    .from("employees")
    .update({ auth_user_id: nuevoUsuario.user.id })
    .eq("id", invitacion.employee_id);
  await admin
    .from("employee_invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("id", invitacion.id);

  // Inicia sesión en ESTE navegador — el del empleado, no el del administrador.
  const supabase = await crearClienteServidor();
  await supabase.auth.signInWithPassword({ email, password });

  redirect("/mi-cuenta");
}
