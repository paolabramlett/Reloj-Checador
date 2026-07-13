import { type NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: [
    /*
     * Corre en todas las rutas salvo assets estáticos, para que la sesión
     * se refresque en cada navegación.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon_app.svg|icon_tab.svg|logo.png|manifest.webmanifest|sw.js).*)",
  ],
};
