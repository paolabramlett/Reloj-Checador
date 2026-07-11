import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { GeneradorKiosco } from "@/components/generador-kiosco";

export default async function PaginaNuevoKiosco() {
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const supabase = await crearClienteServidor();
  const { data: centros } = await supabase
    .from("work_centers")
    .select("id, name")
    .eq("company_id", empresa.id)
    .order("created_at", { ascending: true });

  if (!centros || centros.length === 0) redirect("/panel/centros/nuevo");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-ink">Registrar kiosco</h1>
      <GeneradorKiosco centros={centros} />
    </main>
  );
}
