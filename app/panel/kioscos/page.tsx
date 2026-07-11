import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { AccionConfirmable } from "@/components/accion-confirmable";
import { revocarKiosco } from "./actions";

export default async function PaginaKioscos() {
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const supabase = await crearClienteServidor();
  const { data: kioscos } = await supabase
    .from("kiosk_devices")
    .select("id, name, revoked_at, last_used_at, work_centers(name)")
    .eq("company_id", empresa.id)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Kioscos</h1>
        <Link href="/panel/kioscos/nuevo" className="text-sm font-medium text-primary hover:underline">
          + Registrar
        </Link>
      </div>

      {!kioscos || kioscos.length === 0 ? (
        <p className="text-muted">Todavía no registraste ningún kiosco.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {kioscos.map((kiosco) => {
            const centro = kiosco.work_centers as unknown as { name: string } | null;
            const revocado = Boolean(kiosco.revoked_at);
            return (
              <li
                key={kiosco.id}
                className="flex flex-col gap-2 rounded-md border border-border px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className={revocado ? "text-muted line-through" : "text-ink"}>
                    {kiosco.name}
                  </span>
                  <span className="text-sm text-muted">{centro?.name}</span>
                </div>
                {!revocado && (
                  <AccionConfirmable
                    accion={revocarKiosco}
                    id={kiosco.id}
                    nombreCampo="kiosco_id"
                    mensajeConfirmacion="¿Revocar este kiosco? El dispositivo va a dejar de poder fichar."
                    className="self-start text-sm font-medium text-danger hover:underline"
                  >
                    Revocar
                  </AccionConfirmable>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/panel" className="text-sm font-medium text-primary hover:underline">
        ← Volver al panel
      </Link>
    </main>
  );
}
