"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/input";
import { Mensaje } from "@/components/ui/mensaje";
import { iniciarSesion } from "./actions";

export default function PaginaLogin() {
  const [estado, accion, enProceso] = useActionState(iniciarSesion, { error: null as string | null });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Iniciar sesión</h1>
        <p className="text-muted">Entra a tu cuenta de Reloj Checador.</p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}

        <Campo etiqueta="Correo" name="email" type="email" autoComplete="email" required />
        <Campo
          etiqueta="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />

        <Boton type="submit" cargando={enProceso}>
          Entrar
        </Boton>
      </form>

      <div className="flex flex-col gap-2 text-center text-sm text-muted">
        <Link href="/recuperar" className="font-medium text-primary hover:underline">
          Olvidé mi contraseña
        </Link>
        <p>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-primary hover:underline">
            Crea una
          </Link>
        </p>
      </div>
    </main>
  );
}
