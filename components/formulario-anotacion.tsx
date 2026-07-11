"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/button";
import { Mensaje } from "@/components/ui/mensaje";
import { agregarAnotacion } from "@/app/panel/historial/actions";

export function FormularioAnotacion({ clockEventId }: { clockEventId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enProceso] = useActionState(agregarAnotacion, {
    error: null as string | null,
    guardadoEn: null as number | null,
  });

  useEffect(() => {
    if (estado.guardadoEn) {
      setAbierto(false);
      router.refresh();
    }
  }, [estado.guardadoEn, router]);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="self-start text-xs font-medium text-primary hover:underline"
      >
        + Anotar corrección
      </button>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="clock_event_id" value={clockEventId} />
      {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}
      <textarea
        name="motivo"
        required
        placeholder="Ej: el empleado olvidó marcar su salida; según su reporte, salió a las 18:00."
        className="min-h-20 rounded-md border border-border px-3 py-2 text-sm text-ink placeholder:text-muted"
      />
      <div className="flex gap-2">
        <Boton type="submit" variante="secundario" anchoCompleto={false} cargando={enProceso} className="px-4 text-sm">
          Guardar anotación
        </Boton>
      </div>
    </form>
  );
}
