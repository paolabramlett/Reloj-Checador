import type { SupabaseClient } from "@supabase/supabase-js";

export interface DocumentoConsentimiento {
  id: string;
  type: "system_agreement" | "privacy_notice";
  version: number;
  body: string;
}

// Toma la versión más alta de cada tipo de documento. El orden desc por
// versión + quedarse con el primero visto por tipo es más simple que un
// DISTINCT ON y no depende de sintaxis específica de Postgres via el
// cliente de Supabase.
export async function obtenerDocumentosVigentes(
  supabase: SupabaseClient,
): Promise<DocumentoConsentimiento[]> {
  const { data } = await supabase
    .from("consent_documents")
    .select("id, type, version, body")
    .order("version", { ascending: false });

  const vistos = new Set<string>();
  const vigentes: DocumentoConsentimiento[] = [];
  for (const doc of data ?? []) {
    if (!vistos.has(doc.type)) {
      vistos.add(doc.type);
      vigentes.push(doc);
    }
  }
  return vigentes;
}

/**
 * Documentos vigentes que este empleado todavía no aceptó. Si cambia la
 * versión de un documento, la versión vieja aceptada no cuenta — vuelve a
 * aparecer acá hasta que acepte la nueva (spec: "re-aceptación automática").
 */
export async function faltanAceptar(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<DocumentoConsentimiento[]> {
  const [vigentes, { data: aceptados }] = await Promise.all([
    obtenerDocumentosVigentes(supabase),
    supabase.from("consent_records").select("document_id").eq("employee_id", employeeId),
  ]);

  const idsAceptados = new Set((aceptados ?? []).map((a) => a.document_id));
  return vigentes.filter((doc) => !idsAceptados.has(doc.id));
}
