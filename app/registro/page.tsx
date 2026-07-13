"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/input";
import { Mensaje } from "@/components/ui/mensaje";
import { Logo } from "@/components/logo";
import { registrarCuenta } from "./actions";

export default function PaginaRegistro() {
  const [estado, accion, enProceso] = useActionState(registrarCuenta, {
    error: null as string | null,
    exito: false,
  });

  if (estado.exito) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
        <Mensaje tono="exito">
          Te mandamos un correo para confirmar tu cuenta. Abre el enlace para continuar.
        </Mensaje>
        <Link href="/login" className="text-center font-medium text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <Logo ancho={140} className="self-center" />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Crea tu cuenta</h1>
        <p className="text-muted">Registra tu negocio en Chekly.</p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        {estado.error && <Mensaje tono="error">{estado.error}</Mensaje>}

        <Campo etiqueta="Correo" name="email" type="email" autoComplete="email" required />
        <Campo
          etiqueta="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          ayuda="Al menos 8 caracteres."
          required
          minLength={8}
        />

        <Boton type="submit" cargando={enProceso}>
          Crear cuenta
        </Boton>
      </form>

      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </main>
  );
}
