"use client";

import { useActionState } from "react";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/input";
import { Mensaje } from "@/components/ui/mensaje";
import { crearEmpresa } from "@/app/panel/actions";

export function FormularioEmpresa({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  const [estado, accion, enProceso] = useActionState(crearEmpresa, { error: null as string | null });

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">{titulo}</h1>
        {subtitulo && <p className="text-muted">{subtitulo}</p>}
      </div>

      {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}

      <Campo etiqueta="Nombre del negocio" name="nombre" placeholder="Taquería El Buen Sabor" required />

      <Boton type="submit" cargando={enProceso}>
        Crear empresa
      </Boton>
    </form>
  );
}
