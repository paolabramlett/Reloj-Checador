import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { estadoDesdeUltimoEvento, type TipoEvento } from "@/lib/fichaje";
import { faltanAceptar } from "@/lib/consentimiento";
import { cerrarSesion } from "@/app/panel/actions";
import { Boton } from "@/components/ui/button";
import { PantallaFichaje } from "@/components/pantalla-fichaje";
import { PantallaConsentimiento } from "@/components/pantalla-consentimiento";
import { Logo } from "@/components/logo";

export default async function PaginaMiCuenta() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: empleado } = await supabase
    .from("employees")
    .select("id, full_name, status, company_id, work_centers(lat, lng, geofence_radius_m)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!empleado) redirect("/panel");

  if (empleado.status !== "active") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-2xl font-semibold text-ink">Tu cuenta está dada de baja</h1>
        <p className="text-muted">Habla con tu empleador si crees que esto es un error.</p>
        <form action={cerrarSesion}>
          <Boton type="submit" variante="secundario">
            Cerrar sesión
          </Boton>
        </form>
      </main>
    );
  }

  const documentosFaltantes = await faltanAceptar(supabase, empleado.id);
  if (documentosFaltantes.length > 0) {
    return (
      <PantallaConsentimiento
        documentos={documentosFaltantes}
        empleadoId={empleado.id}
        companyId={empleado.company_id}
      />
    );
  }

  const { data: ultimoEvento } = await supabase
    .from("clock_events")
    .select("event_type")
    .eq("employee_id", empleado.id)
    .order("server_ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const estadoInicial = estadoDesdeUltimoEvento((ultimoEvento?.event_type as TipoEvento) ?? null);
  const centro = empleado.work_centers as unknown as {
    lat: number;
    lng: number;
    geofence_radius_m: number;
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <Logo ancho={110} className="self-center" />
      <h1 className="text-center text-xl font-medium text-ink">Hola, {empleado.full_name}</h1>

      <PantallaFichaje
        estadoInicial={estadoInicial}
        centro={{ lat: centro.lat, lng: centro.lng, geofenceRadiusM: centro.geofence_radius_m }}
      />

      <form action={cerrarSesion}>
        <Boton type="submit" variante="secundario">
          Cerrar sesión
        </Boton>
      </form>
    </main>
  );
}
