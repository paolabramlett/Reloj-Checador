"use client";

import { useActionState } from "react";
import { Boton } from "@/components/ui/button";
import { Mensaje } from "@/components/ui/mensaje";
import { generarInvitacion } from "@/app/panel/empleados/invitacion-actions";

export function GeneradorInvitacion({ empleadoId, nombre }: { empleadoId: string; nombre: string }) {
  const [estado, accion, enProceso] = useActionState(generarInvitacion, {
    error: null as string | null,
    link: null as string | null,
  });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <p className="text-sm text-ink">
        Genera un enlace y compártelo por WhatsApp con {nombre} para que fiche desde su propio
        teléfono.
      </p>

      {estado.error && <Mensaje tono="error">{estado.error}</Mensaje>}

      {estado.link ? (
        <input
          readOnly
          value={estado.link}
          onFocus={(evento) => evento.currentTarget.select()}
          className="min-h-12 rounded-md border border-border px-4 text-sm text-ink"
        />
      ) : (
        <form action={accion}>
          <input type="hidden" name="empleado_id" value={empleadoId} />
          <Boton type="submit" variante="secundario" cargando={enProceso}>
            Generar enlace de invitación
          </Boton>
        </form>
      )}
    </div>
  );
}
