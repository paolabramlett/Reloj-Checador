"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/input";
import { Mensaje } from "@/components/ui/mensaje";
import { crearCorreccion } from "@/app/panel/horas/pendientes/actions";

interface FormularioCorreccionProps {
  opensEventId: string;
  employeeId: string;
  closesEventId?: string | null;
}

export function FormularioCorreccion({ opensEventId, employeeId, closesEventId }: FormularioCorreccionProps) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enProceso] = useActionState(crearCorreccion, {
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
      <Boton type="button" variante="secundario" anchoCompleto={false} className="px-4 text-sm" onClick={() => setAbierto(true)}>
        Corregir
      </Boton>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-3 rounded-md border border-border p-3">
      <input type="hidden" name="opens_event_id" value={opensEventId} />
      <input type="hidden" name="employee_id" value={employeeId} />
      {closesEventId && <input type="hidden" name="closes_event_id" value={closesEventId} />}
      {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}
      <Campo etiqueta="Hora real de salida" name="corrected_closing_ts" type="datetime-local" required />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reason" className="text-sm font-medium text-ink">
          Motivo
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          placeholder="Ej: el empleado olvidó marcar salida; según su reporte, salió a las 18:00."
          className="min-h-20 rounded-md border border-border px-3 py-2 text-sm text-ink placeholder:text-muted"
        />
      </div>
      <div className="flex gap-2">
        <Boton type="submit" anchoCompleto={false} cargando={enProceso} className="px-4 text-sm">
          Guardar corrección
        </Boton>
        <Boton type="button" variante="secundario" anchoCompleto={false} className="px-4 text-sm" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
