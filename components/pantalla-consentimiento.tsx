"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/button";
import { Mensaje } from "@/components/ui/mensaje";
import type { DocumentoConsentimiento } from "@/lib/consentimiento";
import { aceptarConsentimiento } from "@/app/mi-cuenta/consentimiento-actions";

const TITULO_POR_TIPO: Record<DocumentoConsentimiento["type"], string> = {
  system_agreement: "Acuerdo con el sistema de registro",
  privacy_notice: "Aviso de privacidad",
};

interface PantallaConsentimientoProps {
  documentos: DocumentoConsentimiento[];
  empleadoId: string;
  companyId: string;
}

export function PantallaConsentimiento({
  documentos,
  empleadoId,
  companyId,
}: PantallaConsentimientoProps) {
  const router = useRouter();
  const [estado, accion, enProceso] = useActionState(aceptarConsentimiento, {
    error: null as string | null,
    aceptadoEn: null as number | null,
  });

  // Al aceptar, la pantalla de fichaje vuelve a montarse (Server Component)
  // ya sin nada pendiente — router.refresh() es lo que la trae de vuelta
  // sin una navegación completa.
  useEffect(() => {
    if (estado.aceptadoEn) router.refresh();
  }, [estado.aceptadoEn, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Antes de fichar</h1>
        <p className="text-muted">Léelo con calma y acepta para continuar.</p>
      </div>

      {estado.error && <Mensaje tono="error">{estado.error}</Mensaje>}

      <div className="flex max-h-96 flex-col gap-6 overflow-y-auto">
        {documentos.map((doc) => (
          <div key={doc.id} className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-ink">{TITULO_POR_TIPO[doc.type]}</h2>
            <p className="whitespace-pre-line text-sm text-ink">{doc.body}</p>
          </div>
        ))}
      </div>

      <form action={accion} className="flex flex-col gap-3">
        <input type="hidden" name="empleado_id" value={empleadoId} />
        <input type="hidden" name="company_id" value={companyId} />
        {documentos.map((doc) => (
          <input key={doc.id} type="hidden" name="document_id" value={doc.id} />
        ))}
        <Boton type="submit" cargando={enProceso}>
          Acepto
        </Boton>
      </form>
    </main>
  );
}
