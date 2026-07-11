import { crearClienteServidor } from "./supabase/server";

export async function obtenerEmpleadoVinculado() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("employees")
    .select("id, full_name, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data;
}
