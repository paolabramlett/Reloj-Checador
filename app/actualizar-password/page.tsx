"use client";

import { useActionState } from "react";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/input";
import { Mensaje } from "@/components/ui/mensaje";
import { actualizarPassword } from "./actions";

export default function PaginaActualizarPassword() {
  const [estado, accion, enProceso] = useActionState(actualizarPassword, {
    error: null as string | null,
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Elige una nueva contraseña</h1>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}

        <Campo
          etiqueta="Nueva contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          ayuda="Al menos 8 caracteres."
          required
          minLength={8}
        />
        <Campo
          etiqueta="Confirma la contraseña"
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />

        <Boton type="submit" cargando={enProceso}>
          Guardar contraseña
        </Boton>
      </form>
    </main>
  );
}
