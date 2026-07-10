"use client";

import { useEffect } from "react";

export function RegistrarSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin service worker la app sigue funcionando en línea;
        // la cola offline simplemente no estará disponible.
      });
    }
  }, []);

  return null;
}
