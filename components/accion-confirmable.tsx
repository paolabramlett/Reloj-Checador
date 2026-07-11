"use client";

interface AccionConfirmableProps {
  accion: (formData: FormData) => void | Promise<void>;
  id: string;
  nombreCampo?: string;
  mensajeConfirmacion: string;
  children: React.ReactNode;
  className: string;
}

export function AccionConfirmable({
  accion,
  id,
  nombreCampo = "empleado_id",
  mensajeConfirmacion,
  children,
  className,
}: AccionConfirmableProps) {
  return (
    <form
      action={accion}
      onSubmit={(evento) => {
        if (!window.confirm(mensajeConfirmacion)) evento.preventDefault();
      }}
    >
      <input type="hidden" name={nombreCampo} value={id} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
