import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioCentroTrabajo } from "@/components/formulario-centro-trabajo";
import { actualizarCentroTrabajo } from "../actions";

export default async function PaginaEditarCentroTrabajo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  // RLS (is_company_member) ya garantiza que esto viene vacío si el centro
  // no pertenece a una empresa del usuario — por eso alcanza con notFound().
  const { data: centro } = await supabase
    .from("work_centers")
    .select("id, name, lat, lng, geofence_radius_m")
    .eq("id", id)
    .maybeSingle();

  if (!centro) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <FormularioCentroTrabajo
        titulo="Editar centro de trabajo"
        accion={actualizarCentroTrabajo}
        valoresIniciales={{
          centroId: centro.id,
          nombre: centro.name,
          lat: centro.lat,
          lng: centro.lng,
          radioM: centro.geofence_radius_m,
        }}
      />
    </main>
  );
}
