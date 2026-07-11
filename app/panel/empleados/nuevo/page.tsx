import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerEmpresaActiva } from "@/lib/empresa-activa";
import { FormularioEmpleado } from "@/components/formulario-empleado";
import { crearEmpleado } from "../actions";

export default async function PaginaNuevoEmpleado() {
  const empresa = await obtenerEmpresaActiva();
  if (!empresa) redirect("/panel");

  const supabase = await crearClienteServidor();
  const { data: centros } = await supabase
    .from("work_centers")
    .select("id, name")
    .eq("company_id", empresa.id)
    .order("created_at", { ascending: true });

  if (!centros || centros.length === 0) {
    redirect("/panel/centros/nuevo");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <FormularioEmpleado titulo="Agregar empleado" accion={crearEmpleado} centros={centros} />
    </main>
  );
}
