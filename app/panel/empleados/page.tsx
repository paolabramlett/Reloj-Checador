import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { obtenerDocumentosVigentes } from "@/lib/consentimiento";

export default async function PaginaEmpleados() {
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const supabase = await crearClienteServidor();
  const [{ data: empleados }, documentosVigentes, { data: aceptaciones }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, status, work_centers(name)")
      .eq("company_id", empresa.id)
      .order("created_at", { ascending: true }),
    obtenerDocumentosVigentes(supabase),
    supabase.from("consent_records").select("employee_id, document_id").eq("company_id", empresa.id),
  ]);

  const idsVigentes = new Set(documentosVigentes.map((d) => d.id));
  const aceptadosPorEmpleado = new Map<string, Set<string>>();
  for (const registro of aceptaciones ?? []) {
    const set = aceptadosPorEmpleado.get(registro.employee_id) ?? new Set<string>();
    set.add(registro.document_id);
    aceptadosPorEmpleado.set(registro.employee_id, set);
  }

  function consentimientoCompleto(empleadoId: string) {
    const aceptados = aceptadosPorEmpleado.get(empleadoId) ?? new Set<string>();
    return [...idsVigentes].every((id) => aceptados.has(id));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Empleados</h1>
        <Link href="/panel/empleados/nuevo" className="text-sm font-medium text-primary hover:underline">
          + Agregar
        </Link>
      </div>

      {!empleados || empleados.length === 0 ? (
        <p className="text-muted">Todavía no diste de alta a ningún empleado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {empleados.map((empleado) => {
            const centro = empleado.work_centers as unknown as { name: string } | null;
            const deBaja = empleado.status === "terminated";
            const completo = consentimientoCompleto(empleado.id);
            return (
              <li key={empleado.id}>
                <Link
                  href={`/panel/empleados/${empleado.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-4 py-3 hover:bg-surface"
                >
                  <span className={deBaja ? "text-muted line-through" : "text-ink"}>
                    {empleado.full_name}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted">
                    {!deBaja && (
                      <span className={completo ? "text-primary-strong" : "text-danger"}>
                        {completo ? "Acuerdo aceptado" : "Acuerdo pendiente"}
                      </span>
                    )}
                    {deBaja ? "De baja" : centro?.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <a
        href="/api/panel/constancias"
        className="text-sm font-medium text-primary hover:underline"
      >
        Exportar constancias (CSV)
      </a>

      <Link href="/panel" className="text-sm font-medium text-primary hover:underline">
        ← Volver al panel
      </Link>
    </main>
  );
}
