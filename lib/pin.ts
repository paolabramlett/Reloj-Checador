import { createHash } from "node:crypto";

export const PIN_REGEX = /^\d{4}$/;

// El PIN nunca se guarda en texto plano. El hash incluye el company_id para
// que el mismo PIN numérico en dos empresas distintas no choque entre sí,
// y el índice único (company_id, pin_hash) de la migración 2.1 hace el
// resto: dos empleados de la misma empresa no pueden compartir PIN.
export function hashPin(companyId: string, pin: string): string {
  return createHash("sha256").update(`${companyId}:${pin}`).digest("hex");
}
