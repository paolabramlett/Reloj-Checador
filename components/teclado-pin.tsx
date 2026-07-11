"use client";

import { useState } from "react";

interface TecladoPinProps {
  onCompletar: (pin: string) => void;
  disabled?: boolean;
}

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function TecladoPin({ onCompletar, disabled }: TecladoPinProps) {
  const [pin, setPin] = useState("");

  function presionar(digito: string) {
    if (disabled) return;
    const nuevoPin = (pin + digito).slice(0, 4);
    setPin(nuevoPin);
    if (nuevoPin.length === 4) {
      onCompletar(nuevoPin);
      setPin("");
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-3" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 border-primary ${i < pin.length ? "bg-primary" : "bg-transparent"}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {TECLAS.map((digito) => (
          <button
            key={digito}
            type="button"
            onClick={() => presionar(digito)}
            disabled={disabled}
            className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-2xl font-medium text-ink hover:bg-surface disabled:opacity-50"
          >
            {digito}
          </button>
        ))}
        <div />
        <button
          type="button"
          onClick={() => presionar("0")}
          disabled={disabled}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-2xl font-medium text-ink hover:bg-surface disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setPin((p) => p.slice(0, -1))}
          disabled={disabled}
          className="flex h-16 w-16 items-center justify-center rounded-full text-sm font-medium text-muted hover:bg-surface disabled:opacity-50"
        >
          Borrar
        </button>
      </div>
    </div>
  );
}
