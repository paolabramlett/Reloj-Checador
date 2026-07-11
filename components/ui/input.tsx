import { type InputHTMLAttributes, forwardRef, useId } from "react";

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  error?: string;
  ayuda?: string;
}

export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { etiqueta, error, ayuda, id, className = "", ...props },
  ref,
) {
  const idGenerado = useId();
  const inputId = id ?? idGenerado;
  const errorId = `${inputId}-error`;
  const ayudaId = `${inputId}-ayuda`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {etiqueta}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : ayuda ? ayudaId : undefined}
        className={`min-h-12 rounded-md border px-4 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
          error ? "border-danger" : "border-border"
        } ${className}`}
        {...props}
      />
      {ayuda && !error && (
        <p id={ayudaId} className="text-sm text-muted">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
