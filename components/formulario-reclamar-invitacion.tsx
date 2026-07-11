"use client";

import { useActionState } from "react";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/input";
import { Mensaje } from "@/components/ui/mensaje";
import { reclamarInvitacion } from "@/app/invitacion/[token]/actions";

export function FormularioReclamarInvitacion({ token, nombre }: { token: string; nombre: string }) {
  const [estado, accion, enProceso] = useActionState(reclamarInvitacion, {
    error: null as string | null,
  });

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Hola, {nombre}</h1>
        <p className="text-muted">Crea tu acceso para fichar desde tu teléfono.</p>
      </div>

      {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}

      <input type="hidden" name="token" value={token} />
      <Campo etiqueta="Tu correo" name="email" type="email" autoComplete="email" required />
      <Campo
        etiqueta="Crea una contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        ayuda="Al menos 8 caracteres."
        required
        minLength={8}
      />

      <Boton type="submit" cargando={enProceso}>
        Crear mi acceso
      </Boton>
    </form>
  );
}
