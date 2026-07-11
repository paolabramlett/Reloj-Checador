import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

// Ruta a la que apuntan los links de confirmación de registro y de
// recuperación de contraseña que Supabase envía por correo.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      redirect(type === "recovery" ? "/actualizar-password" : "/panel");
    }
  }

  redirect("/login?error=enlace-invalido");
}
