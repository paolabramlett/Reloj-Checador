import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva, obtenerEmpresasDelUsuario } from "@/lib/empresa-activa";
import { obtenerEmpleadoVinculado } from "@/lib/empleado-actual";
import { limiteEfectivoDeEmpleados } from "@/lib/facturacion";
import { cerrarSesion, seleccionarEmpresa } from "./actions";
import { Boton } from "@/components/ui/button";
import { FormularioEmpresa } from "@/components/formulario-empresa";
import { Mensaje } from "@/components/ui/mensaje";
import { Logo } from "@/components/logo";

export default async function PaginaPanel() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Un empleado que reclamó su invitación no administra nada: su pantalla
  // es /mi-cuenta, no el panel del dueño del negocio.
  const empleadoVinculado = await obtenerEmpleadoVinculado();
  if (empleadoVinculado) redirect("/mi-cuenta");

  const [empresas, empresaActiva] = await Promise.all([
    obtenerEmpresasDelUsuario(),
    obtenerEmpresaActiva(),
  ]);

  if (!empresaActiva) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
        <Logo ancho={140} className="self-center" />
        <FormularioEmpresa
          titulo="Crea tu negocio"
          subtitulo={`Sesión iniciada como ${user?.email}. Antes de fichar, registra tu negocio.`}
        />
      </main>
    );
  }

  const [{ data: centros }, { count: empleadosActivos }, { data: empresaConRango }] = await Promise.all([
    supabase
      .from("work_centers")
      .select("id, name, geofence_radius_m")
      .eq("company_id", empresaActiva.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", empresaActiva.id)
      .eq("status", "active"),
    supabase
      .from("companies")
      .select("subscription_status, employee_range")
      .eq("id", empresaActiva.id)
      .single(),
  ]);

  // null = sin tope (trial) — durante el trial este aviso no aplica,
  // igual que el bloqueo real de altas no aplica (spec, decisión 5).
  const limiteRango = empresaConRango ? limiteEfectivoDeEmpleados(empresaConRango) : null;
  const excedeRango = limiteRango !== null && (empleadosActivos ?? 0) >= limiteRango;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <Logo ancho={110} />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted">{user?.email}</p>
        <h1 className="text-2xl font-semibold text-ink">{empresaActiva.nombre}</h1>
      </div>

      {excedeRango && (
        <Mensaje tono="error">
          Llegaste a tu límite de {limiteRango} empleados activos. Para agregar más, sube tu plan
          en Facturación.
        </Mensaje>
      )}

      {empresas.length > 1 && (
        <form action={seleccionarEmpresa} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="company_id" className="text-sm font-medium text-ink">
              Empresa activa
            </label>
            <select
              id="company_id"
              name="company_id"
              defaultValue={empresaActiva.id}
              className="min-h-12 rounded-md border border-border px-4 text-base text-ink"
            >
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </select>
          </div>
          <Boton type="submit" variante="secundario" anchoCompleto={false} className="px-4">
            Cambiar
          </Boton>
        </form>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">Centros de trabajo</h2>
          <Link href="/panel/centros/nuevo" className="text-sm font-medium text-primary hover:underline">
            + Agregar
          </Link>
        </div>

        {!centros || centros.length === 0 ? (
          <p className="text-muted">
            Todavía no tienes ningún centro de trabajo. Agrega uno para que tu equipo pueda fichar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {centros.map((centro) => (
              <li key={centro.id}>
                <Link
                  href={`/panel/centros/${centro.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-4 py-3 hover:bg-surface"
                >
                  <span className="text-ink">{centro.name}</span>
                  <span className="text-sm text-muted">Radio {centro.geofence_radius_m} m</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href="/panel/empleados"
          className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-ink hover:bg-surface"
        >
          Empleados
        </Link>
        <Link
          href="/panel/kioscos"
          className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-ink hover:bg-surface"
        >
          Kioscos
        </Link>
        <Link
          href="/panel/horas"
          className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-ink hover:bg-surface"
        >
          Horas
        </Link>
        <Link
          href="/panel/historial"
          className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-ink hover:bg-surface"
        >
          Historial
        </Link>
        <Link
          href="/panel/facturacion"
          className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-ink hover:bg-surface"
        >
          Facturación
        </Link>
      </div>

      <Link href="/panel/empresas/nueva" className="text-sm font-medium text-primary hover:underline">
        + Crear otra empresa
      </Link>

      <form action={cerrarSesion}>
        <Boton type="submit" variante="secundario">
          Cerrar sesión
        </Boton>
      </form>
    </main>
  );
}
