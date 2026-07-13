interface AlEntrarEnVistaProps {
  children: React.ReactNode;
  className?: string;
  retraso?: number;
}

// Revela contenido al hacer scroll con un fade + subida sutil, 100% CSS
// (ver .al-entrar-en-vista en globals.css). Visible por defecto siempre
// — la animación es una mejora progresiva, nunca una condición.
export function AlEntrarEnVista({ children, className = "", retraso = 0 }: AlEntrarEnVistaProps) {
  return (
    <div className={`al-entrar-en-vista ${className}`} style={{ animationDelay: `${retraso}ms` }}>
      {children}
    </div>
  );
}
