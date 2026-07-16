interface IconoProps {
  className?: string;
}

// Set de íconos de trazo para la landing (marketing). Simples,
// monocromáticos vía currentColor — nunca decoración a color, siguiendo
// "un solo verde, el color sirve a la tarea" de DESIGN.md.
const base = "1.6";

export function IconoUbicacion({ className = "h-6 w-6" }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function IconoTablet({ className = "h-6 w-6" }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
      <path d="M9 7h6" />
    </svg>
  );
}

export function IconoSinInternet({ className = "h-6 w-6" }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 3l18 18" />
      <path d="M8.5 8.8A11 11 0 0 1 21 9" />
      <path d="M3 9a10.9 10.9 0 0 1 3.1-2.4" />
      <path d="M5.5 12.6A6.9 6.9 0 0 1 9 11" />
      <path d="M12 14.5a3.5 3.5 0 0 1 3.1 1" />
      <circle cx="12" cy="18.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconoReporte({ className = "h-6 w-6" }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6M9 17h6M9 9h2" />
    </svg>
  );
}

export function IconoAlerta({ className = "h-6 w-6" }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 4a5 5 0 0 0-5 5c0 5-2 6-2 7h14c0-1-2-2-2-7a5 5 0 0 0-5-5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconoUsuarioMas({ className = "h-6 w-6" }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.7 5.7 0 0 1 11 0" />
      <path d="M18 8v5M15.5 10.5h5" />
    </svg>
  );
}

export function IconoEquipo({ className = "h-6 w-6" }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8.5" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.4" />
      <path d="M2.8 20a5.8 5.8 0 0 1 11.4 0" />
      <path d="M14.8 14.3a4.6 4.6 0 0 1 6.4 4.2" />
    </svg>
  );
}

export function IconoCheck({ className = "h-6 w-6" }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.2 12.3l2.6 2.6 5-5.2" />
    </svg>
  );
}

export function IconoEscudo({ className = "h-6 w-6" }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3l7 3v6c0 4.6-3 7.8-7 9-4-1.2-7-4.4-7-9V6l7-3Z" />
      <path d="M9 12l2.2 2.2L15.5 9.5" />
    </svg>
  );
}

export function IconoWhatsApp({ className = "h-6 w-6" }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6.4 17.6 4 20l2.5-2.3A8 8 0 1 1 9.6 19Z" />
      <path d="M8.8 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4 0 .6.4l.7 1.7c.1.3 0 .5-.1.7l-.5.6c-.1.2-.2.3 0 .6.5.9 1.5 1.9 2.4 2.3.3.1.4.1.6-.1l.6-.6c.2-.2.4-.2.6-.1l1.6.8c.3.1.3.3.3.5 0 .3-.1.9-.5 1.2-.4.4-1.1.7-1.8.6-1.4-.2-3.4-1.1-4.7-2.9-1-1.4-1.5-2.7-1.5-3.7 0-.5.2-1 .4-1.5Z" />
    </svg>
  );
}

export function IconoBalanza({ className = "h-6 w-6" }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v18M8 21h8" />
      <path d="M4 7h6M14 7h6" />
      <path d="M4 7l-2.5 5a2.7 2.7 0 0 0 5 0L4 7Z" />
      <path d="M20 7l-2.5 5a2.7 2.7 0 0 0 5 0L20 7Z" />
    </svg>
  );
}
