import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { inicioSemanaActual, calcularNivelAlerta, type NivelAlerta } from "@/lib/semana";
import { obtenerAccesoAdmin } from "@/lib/facturacion";
import { BloqueoFacturacion } from "@/components/bloqueo-facturacion";

const ETIQUETA_NIVEL: Record<NivelAlerta, string> = {
  normal: "Normal",
  proximidad: "⚠ Cerca del límite",
  exceso: "⛔ Excedido",
};

const CLASE_NIVEL: Record<NivelAlerta, string> = {
  normal: "text-muted",
  proximidad: "text-primary-strong font-medium",
  exceso: "text-danger font-medium",
};

// Excedido primero, después proximidad, después normal — lo que necesita
// atención sube arriba en vez de esconderse en orden alfabético.
const ORDEN_NIVEL: Record<NivelAlerta, number> = { exceso: 0, proximidad: 1, normal: 2 };

export default async function PaginaHoras() {
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const supabase = await crearClienteServidor();

  if (!(await obtenerAccesoAdmin(supabase, empresa.id))) return <BloqueoFacturacion />;

  const inicioSemana = inicioSemanaActual();
  const anioActual = new Date().getUTCFullYear();

  const [{ data: empleados }, { data: limite }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name")
      .eq("company_id", empresa.id)
      .eq("status", "active")
      .order("full_name"),
    supabase.rpc("legal_weekly_hours", { p_year: anioActual }),
  ]);

  const limiteSemanal = Number(limite ?? 40);

  const filas = await Promise.all(
    (empleados ?? []).map(async (empleado) => {
      const { data: horas } = await supabase.rpc("weekly_hours_for_employee", {
        p_employee_id: empleado.id,
        p_week_start: inicioSemana,
      });
      const horasNumero = Number(horas ?? 0);
      return {
        id: empleado.id,
        nombre: empleado.full_name,
        horas: horasNumero,
        nivel: calcularNivelAlerta(horasNumero, limiteSemanal),
      };
    }),
  );

  filas.sort((a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel] || a.nombre.localeCompare(b.nombre));

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Horas de esta semana</h1>
        <p className="text-sm text-muted">Límite legal {anioActual}: {limiteSemanal} horas.</p>
      </div>

      {filas.length === 0 ? (
        <p className="text-muted">No hay empleados activos.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map((fila) => (
            <li key={fila.id}>
              <Link
                href={`/panel/horas/${fila.id}`}
                className="flex items-center justify-between rounded-md border border-border px-4 py-3 hover:bg-surface"
              >
                <span className="text-ink">{fila.nombre}</span>
                <span className="flex items-center gap-3 text-sm">
                  <span className={CLASE_NIVEL[fila.nivel]}>{ETIQUETA_NIVEL[fila.nivel]}</span>
                  <span className="text-muted">{fila.horas.toFixed(1)} h</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/panel" className="text-sm font-medium text-primary hover:underline">
        ← Volver al panel
      </Link>
    </main>
  );
}
