import { cookies } from "next/headers";
import { crearClienteServidor } from "./supabase/server";

const COOKIE_EMPRESA_ACTIVA = "empresa_activa";

export interface EmpresaDelUsuario {
  id: string;
  nombre: string;
  rol: "owner" | "admin";
}

export async function obtenerEmpresasDelUsuario(): Promise<EmpresaDelUsuario[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("company_members")
    .select("role, companies!inner(id, name, created_at)")
    .order("created_at", { referencedTable: "companies", ascending: true });

  return (data ?? []).map((fila) => {
    const empresa = fila.companies as unknown as { id: string; name: string };
    return { id: empresa.id, nombre: empresa.name, rol: fila.role as "owner" | "admin" };
  });
}

// La cookie solo decide qué empresa mostrar cuando el usuario tiene varias;
// RLS (is_company_member) es la barrera real de seguridad, así que una
// cookie manipulada nunca deja ver datos de una empresa ajena.
export async function obtenerEmpresaActiva(): Promise<EmpresaDelUsuario | null> {
  const empresas = await obtenerEmpresasDelUsuario();
  if (empresas.length === 0) return null;

  const cookieStore = await cookies();
  const idGuardado = cookieStore.get(COOKIE_EMPRESA_ACTIVA)?.value;
  return empresas.find((e) => e.id === idGuardado) ?? empresas[0];
}

export async function fijarEmpresaActiva(companyId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_EMPRESA_ACTIVA, companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
