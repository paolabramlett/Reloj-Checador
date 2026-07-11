import { createClient } from "@supabase/supabase-js";

// Solo para el canje de invitaciones: el visitante todavía no tiene sesión,
// así que este es el único punto del código que deliberadamente pasa por
// encima de RLS. La posesión del token (validado a mano en cada consulta)
// es la única autorización que importa acá.
export function crearClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
