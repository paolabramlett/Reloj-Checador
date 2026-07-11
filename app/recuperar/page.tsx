"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/input";
import { Mensaje } from "@/components/ui/mensaje";
import { solicitarRecuperacion } from "./actions";

export default function PaginaRecuperar() {
  const [estado, accion, enProceso] = useActionState(solicitarRecuperacion, {
    error: null as string | null,
    exito: false,
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Recuperar contraseña</h1>
        <p className="text-muted">Te mandamos un enlace para elegir una nueva.</p>
      </div>

      {estado.exito ? (
        <Mensaje tono="exito">
          Si ese correo tiene una cuenta, te llegó un enlace para elegir una nueva contraseña.
        </Mensaje>
      ) : (
        <form action={accion} className="flex flex-col gap-4">
          {estado.error && <Mensaje tono="error">{estado.error}</Mensaje>}
          <Campo etiqueta="Correo" name="email" type="email" autoComplete="email" required />
          <Boton type="submit" cargando={enProceso}>
            Enviar enlace
          </Boton>
        </form>
      )}

      <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">
        Volver a iniciar sesión
      </Link>
    </main>
  );
}
