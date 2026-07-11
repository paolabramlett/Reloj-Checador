"use client";

import { useActionState } from "react";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/input";
import { Mensaje } from "@/components/ui/mensaje";
import { registrarKiosco } from "@/app/panel/kioscos/actions";

export function GeneradorKiosco({ centros }: { centros: { id: string; name: string }[] }) {
  const [estado, accion, enProceso] = useActionState(registrarKiosco, {
    error: null as string | null,
    link: null as string | null,
  });

  if (estado.link) {
    return (
      <div className="flex flex-col gap-3">
        <Mensaje tono="exito">
          Kiosco registrado. Abre este enlace UNA VEZ en la tablet o el teléfono que va a quedar
          fijo — después va a recordar el acceso solo.
        </Mensaje>
        <input
          readOnly
          value={estado.link}
          onFocus={(evento) => evento.currentTarget.select()}
          className="min-h-12 rounded-md border border-border px-4 text-sm text-ink"
        />
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-4">
      {estado.error && <Mensaje tono="error">{estado.error}</Mensaje>}

      <Campo etiqueta="Nombre del kiosco" name="nombre" placeholder="Tablet mostrador" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="work_center_id" className="text-sm font-medium text-ink">
          Centro de trabajo
        </label>
        <select
          id="work_center_id"
          name="work_center_id"
          required
          defaultValue=""
          className="min-h-12 rounded-md border border-border px-4 text-base text-ink"
        >
          <option value="" disabled>
            Elige uno
          </option>
          {centros.map((centro) => (
            <option key={centro.id} value={centro.id}>
              {centro.name}
            </option>
          ))}
        </select>
      </div>

      <Boton type="submit" cargando={enProceso}>
        Registrar kiosco
      </Boton>
    </form>
  );
}
