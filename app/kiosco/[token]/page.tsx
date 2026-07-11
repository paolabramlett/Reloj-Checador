"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

// Un solo uso: guarda el token en este dispositivo y no se vuelve a
// necesitar la URL larga — /kiosco solo (sin token) alcanza de ahí en más.
export default function PaginaActivarKiosco({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem("kiosco_token", token);
    router.replace("/kiosco");
  }, [token, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-muted">Activando kiosco…</p>
    </main>
  );
}
