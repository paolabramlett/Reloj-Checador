import { FormularioEmpresa } from "@/components/formulario-empresa";

export default function PaginaNuevaEmpresa() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <FormularioEmpresa titulo="Crea otra empresa" />
    </main>
  );
}
