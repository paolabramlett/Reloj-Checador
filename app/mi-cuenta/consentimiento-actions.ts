"use server";

import { crearClienteServidor } from "@/lib/supabase/server";

export async function aceptarConsentimiento(_prevState: unknown, formData: FormData) {
  const empleadoId = String(formData.get("empleado_id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  const documentIds = formData.getAll("document_id").map(String);

  if (!empleadoId || !companyId || documentIds.length === 0) {
    return { error: "Solicitud inválida.", aceptadoEn: null };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("consent_records").insert(
    documentIds.map((documentId) => ({
      company_id: companyId,
      employee_id: empleadoId,
      document_id: documentId,
      source: "personal_phone" as const,
    })),
  );

  if (error) return { error: "No pudimos guardar tu aceptación. Intenta de nuevo.", aceptadoEn: null };

  return { error: null, aceptadoEn: Date.now() };
}
