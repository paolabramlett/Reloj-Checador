import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variante = "primary" | "secundario";

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  cargando?: boolean;
  anchoCompleto?: boolean;
}

const clasesPorVariante: Record<Variante, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-strong disabled:bg-neutral-300",
  secundario:
    "bg-transparent text-ink border border-border hover:bg-surface disabled:text-muted",
};

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(
  function Boton(
    {
      variante = "primary",
      cargando = false,
      anchoCompleto = true,
      disabled,
      className = "",
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || cargando}
        aria-busy={cargando}
        className={`inline-flex min-h-12 items-center justify-center rounded-md px-6 text-base font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed ${anchoCompleto ? "w-full" : ""} ${clasesPorVariante[variante]} ${className}`}
        {...props}
      >
        {cargando ? "Un momento…" : children}
      </button>
    );
  },
);
