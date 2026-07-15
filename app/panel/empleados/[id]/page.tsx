import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { FormularioEmpleado } from "@/components/formulario-empleado";
import { AccionConfirmable } from "@/components/accion-confirmable";
import { GeneradorInvitacion } from "@/components/generador-invitacion";
import { Mensaje } from "@/components/ui/mensaje";
import { actualizarEmpleado, darDeBaja, quitarPin, reactivar } from "../actions";

export default async function PaginaEditarEmpleado({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const supabase = await crearClienteServidor();

  const [{ data: empleado }, { data: centros }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, status, work_center_id, pin_hash, auth_user_id")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("work_centers")
      .select("id, name")
      .eq("company_id", empresa.id)
      .order("created_at", { ascending: true }),
  ]);

  if (!empleado) notFound();

  const deBaja = empleado.status === "terminated";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      {error === "limite" && (
        <Mensaje tono="error">
          No pudimos reactivar: ya llegaste al límite de tu plan. Sube de plan en Facturación para
          agregar más empleados.
        </Mensaje>
      )}

      {deBaja && (
        <div className="rounded-md bg-surface px-4 py-3 text-sm text-muted">
          Este empleado está dado de baja. No puede fichar hasta que lo reactives.
        </div>
      )}

      <FormularioEmpleado
        titulo="Editar empleado"
        accion={actualizarEmpleado}
        centros={centros ?? []}
        valoresIniciales={{
          empleadoId: empleado.id,
          nombre: empleado.full_name,
          workCenterId: empleado.work_center_id,
          tienePin: Boolean(empleado.pin_hash),
        }}
      />

      {!deBaja &&
        (empleado.auth_user_id ? (
          <p className="rounded-md border border-border px-4 py-3 text-sm text-ink">
            Ya tiene acceso desde su teléfono personal.
          </p>
        ) : (
          <GeneradorInvitacion empleadoId={empleado.id} nombre={empleado.full_name} />
        ))}

      {empleado.pin_hash && (
        <AccionConfirmable
          accion={quitarPin}
          id={empleado.id}
          mensajeConfirmacion="¿Quitar el PIN de este empleado? Ya no va a poder fichar en el kiosco hasta que le asignes uno nuevo."
          className="text-center text-sm font-medium text-muted hover:underline"
        >
          Quitar PIN
        </AccionConfirmable>
      )}

      {deBaja ? (
        <AccionConfirmable
          accion={reactivar}
          id={empleado.id}
          mensajeConfirmacion="¿Reactivar a este empleado?"
          className="min-h-12 w-full rounded-md border border-primary text-base font-medium text-primary hover:bg-primary-tint"
        >
          Reactivar empleado
        </AccionConfirmable>
      ) : (
        <AccionConfirmable
          accion={darDeBaja}
          id={empleado.id}
          mensajeConfirmacion="¿Dar de baja a este empleado? Va a dejar de poder fichar, pero su historial se conserva."
          className="min-h-12 w-full rounded-md border border-danger text-base font-medium text-danger hover:bg-danger-tint"
        >
          Dar de baja
        </AccionConfirmable>
      )}
    </main>
  );
}
