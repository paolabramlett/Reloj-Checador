import { FormularioCentroTrabajo } from "@/components/formulario-centro-trabajo";
import { Mensaje } from "@/components/ui/mensaje";
import { crearCentroTrabajo } from "../actions";

export default async function PaginaNuevoCentroTrabajo({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string }>;
}) {
  const { bienvenida } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      {bienvenida && (
        <Mensaje tono="exito">
          Tu empresa quedó creada. Ahora agrega el lugar desde donde tu equipo va a fichar.
        </Mensaje>
      )}
      <FormularioCentroTrabajo
        titulo="Agrega un centro de trabajo"
        accion={crearCentroTrabajo}
      />
    </main>
  );
}
