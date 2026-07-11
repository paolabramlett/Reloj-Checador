"use client";

import { useActionState } from "react";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/input";
import { Mensaje } from "@/components/ui/mensaje";

type EstadoAccion = { error: string | null };

interface FormularioEmpleadoProps {
  titulo: string;
  accion: (estado: EstadoAccion, formData: FormData) => Promise<EstadoAccion>;
  centros: { id: string; name: string }[];
  valoresIniciales?: { empleadoId: string; nombre: string; workCenterId: string; tienePin: boolean };
}

export function FormularioEmpleado({
  titulo,
  accion,
  centros,
  valoresIniciales,
}: FormularioEmpleadoProps) {
  const [estado, ejecutarAccion, enProceso] = useActionState(accion, { error: null });

  return (
    <form action={ejecutarAccion} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-ink">{titulo}</h1>

      {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}

      {valoresIniciales && (
        <input type="hidden" name="empleado_id" value={valoresIniciales.empleadoId} />
      )}

      <Campo
        etiqueta="Nombre completo"
        name="nombre"
        defaultValue={valoresIniciales?.nombre}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="work_center_id" className="text-sm font-medium text-ink">
          Centro de trabajo
        </label>
        <select
          id="work_center_id"
          name="work_center_id"
          defaultValue={valoresIniciales?.workCenterId}
          required
          className="min-h-12 rounded-md border border-border px-4 text-base text-ink"
        >
          <option value="" disabled>
            Elige uno
          </option>
          {centros.map((centro) => (
            <option key={centro.id} value={centro.id}>
              {centro.name}
            </option>
          ))}
        </select>
      </div>

      <Campo
        etiqueta={valoresIniciales?.tienePin ? "Cambiar PIN del kiosco" : "PIN del kiosco"}
        name="pin"
        type="text"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        placeholder="0000"
        ayuda={
          valoresIniciales?.tienePin
            ? "Ya tiene un PIN asignado. Escribe uno nuevo solo si quieres cambiarlo."
            : "4 dígitos. Se usa para fichar desde el kiosco. Puedes dejarlo en blanco por ahora."
        }
      />

      <Boton type="submit" cargando={enProceso}>
        Guardar
      </Boton>
    </form>
  );
}
