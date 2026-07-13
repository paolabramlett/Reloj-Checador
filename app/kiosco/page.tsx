"use client";

import { useEffect, useState } from "react";
import { Boton } from "@/components/ui/button";
import { Mensaje } from "@/components/ui/mensaje";
import { TecladoPin } from "@/components/teclado-pin";
import { CapturaSelfie } from "@/components/captura-selfie";
import { Logo } from "@/components/logo";
import { ETIQUETA_EVENTO, type EstadoFichaje, type TipoEvento } from "@/lib/fichaje";
import type { DocumentoConsentimiento } from "@/lib/consentimiento";

interface Empleado {
  id: string;
  fullName: string;
}

interface InfoKiosco {
  companyName: string;
  workCenterName: string;
  employees: Empleado[];
}

interface Confirmacion {
  nombre: string;
  estadoActual: EstadoFichaje;
  eventoSugerido: TipoEvento;
}

const TITULO_POR_TIPO: Record<DocumentoConsentimiento["type"], string> = {
  system_agreement: "Acuerdo con el sistema de registro",
  privacy_notice: "Aviso de privacidad",
};

type Fase =
  | "cargando"
  | "sin-registrar"
  | "grid"
  | "pin"
  | "consentimiento"
  | "confirmar"
  | "foto"
  | "resultado";

export default function PaginaKiosco() {
  const [fase, setFase] = useState<Fase>("cargando");
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<InfoKiosco | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [eventoElegido, setEventoElegido] = useState<TipoEvento | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensajeResultado, setMensajeResultado] = useState<string | null>(null);
  const [documentosFaltantes, setDocumentosFaltantes] = useState<DocumentoConsentimiento[]>([]);
  const [aceptando, setAceptando] = useState(false);

  async function cargarEmpleados(tokenActual: string) {
    setFase("cargando");
    setError(null);
    try {
      const respuesta = await fetch("/api/kiosco/empleados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenActual }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.error ?? "No pudimos cargar este kiosco.");
        setFase("sin-registrar");
        return;
      }
      setInfo(datos);
      setFase("grid");
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setFase("sin-registrar");
    }
  }

  useEffect(() => {
    const guardado = localStorage.getItem("kiosco_token");
    if (!guardado) {
      setFase("sin-registrar");
      return;
    }
    setToken(guardado);
    cargarEmpleados(guardado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function elegirEmpleado(e: Empleado) {
    setEmpleado(e);
    setError(null);
    setFase("pin");
  }

  async function verificarPin(pinIngresado: string) {
    if (!token || !empleado) return;
    setVerificando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/kiosco/verificar-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, employee_id: empleado.id, pin: pinIngresado }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok || !datos.ok) {
        setError(datos.error ?? "PIN incorrecto.");
        return;
      }
      setPin(pinIngresado);
      setConfirmacion({
        nombre: datos.nombre,
        estadoActual: datos.estadoActual,
        eventoSugerido: datos.eventoSugerido,
      });
      setEventoElegido(datos.eventoSugerido);

      const faltantes: DocumentoConsentimiento[] = datos.documentosFaltantes ?? [];
      if (faltantes.length > 0) {
        setDocumentosFaltantes(faltantes);
        setFase("consentimiento");
      } else {
        setFase("confirmar");
      }
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setVerificando(false);
    }
  }

  async function aceptarConsentimientoKiosco() {
    if (!token || !empleado) return;
    setAceptando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/kiosco/aceptar-consentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          employee_id: empleado.id,
          document_ids: documentosFaltantes.map((d) => d.id),
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.error ?? "No pudimos guardar tu aceptación.");
        return;
      }
      setDocumentosFaltantes([]);
      setFase("confirmar");
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setAceptando(false);
    }
  }

  async function finalizarFichaje(selfieDataUrl: string) {
    if (!token || !empleado || !pin || !eventoElegido) return;
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/kiosco/fichar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          employee_id: empleado.id,
          pin,
          event_type: eventoElegido,
          selfie: selfieDataUrl,
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.error ?? "No pudimos registrar el fichaje.");
        setFase("confirmar");
        return;
      }
      setMensajeResultado(`¡Listo, ${confirmacion?.nombre}! ${ETIQUETA_EVENTO[eventoElegido]} registrada.`);
      setFase("resultado");
      setTimeout(() => reiniciar(), 3000);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setFase("confirmar");
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setEmpleado(null);
    setPin(null);
    setConfirmacion(null);
    setEventoElegido(null);
    setError(null);
    setMensajeResultado(null);
    setDocumentosFaltantes([]);
    setFase("grid");
    if (token) cargarEmpleados(token);
  }

  if (fase === "cargando") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 py-12">
        <p className="text-muted">Cargando…</p>
      </main>
    );
  }

  if (fase === "sin-registrar") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-ink">Este dispositivo no está registrado</h1>
        <p className="text-muted">
          {error ?? "Pídele a tu empleador el enlace de activación del kiosco."}
        </p>
      </main>
    );
  }

  if (fase === "grid") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-6 py-12">
        <Logo ancho={110} className="self-center" />
        <div className="text-center">
          <p className="text-sm text-muted">{info?.companyName}</p>
          <h1 className="text-xl font-semibold text-ink">{info?.workCenterName}</h1>
        </div>
        <p className="text-center text-muted">¿Quién eres?</p>
        <div className="grid grid-cols-2 gap-3">
          {info?.employees.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => elegirEmpleado(e)}
              className="min-h-16 rounded-md border border-border px-4 py-3 text-base font-medium text-ink hover:bg-surface"
            >
              {e.fullName}
            </button>
          ))}
        </div>
        {info?.employees.length === 0 && (
          <p className="text-center text-muted">No hay empleados activos en este centro.</p>
        )}
      </main>
    );
  }

  if (fase === "pin") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
        <div className="text-center">
          <p className="text-muted">Hola, {empleado?.fullName}</p>
          <h1 className="text-xl font-semibold text-ink">Ingresa tu PIN</h1>
        </div>
        {error && <Mensaje tono="error">{error}</Mensaje>}
        <TecladoPin onCompletar={verificarPin} disabled={verificando} />
        <Boton variante="secundario" onClick={reiniciar}>
          Cancelar
        </Boton>
      </main>
    );
  }

  if (fase === "consentimiento") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
        <div className="text-center">
          <p className="text-muted">Hola, {empleado?.fullName}</p>
          <h1 className="text-xl font-semibold text-ink">Antes de fichar</h1>
        </div>

        {error && <Mensaje tono="error">{error}</Mensaje>}

        <div className="flex max-h-96 flex-col gap-6 overflow-y-auto">
          {documentosFaltantes.map((doc) => (
            <div key={doc.id} className="flex flex-col gap-2">
              <h2 className="text-base font-semibold text-ink">{TITULO_POR_TIPO[doc.type]}</h2>
              <p className="whitespace-pre-line text-sm text-ink">{doc.body}</p>
            </div>
          ))}
        </div>

        <Boton onClick={aceptarConsentimientoKiosco} cargando={aceptando}>
          Acepto
        </Boton>
        <Boton variante="secundario" onClick={reiniciar}>
          Cancelar
        </Boton>
      </main>
    );
  }

  if (fase === "confirmar" && confirmacion) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
        <div className="text-center">
          <p className="text-muted">Hola, {confirmacion.nombre}</p>
          <h1 className="text-xl font-semibold text-ink">
            Vas a registrar: {eventoElegido && ETIQUETA_EVENTO[eventoElegido]}
          </h1>
        </div>

        {error && <Mensaje tono="error">{error}</Mensaje>}

        {confirmacion.estadoActual === "working" && (
          <div className="flex flex-col gap-3">
            <Boton
              variante={eventoElegido === "clock_out" ? "primary" : "secundario"}
              onClick={() => setEventoElegido("clock_out")}
            >
              Salida
            </Boton>
            <Boton
              variante={eventoElegido === "break_start" ? "primary" : "secundario"}
              onClick={() => setEventoElegido("break_start")}
            >
              Iniciar descanso
            </Boton>
          </div>
        )}

        <Boton onClick={() => setFase("foto")}>Continuar</Boton>
        <Boton variante="secundario" onClick={reiniciar}>
          Cancelar
        </Boton>
      </main>
    );
  }

  if (fase === "foto") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
        <h1 className="text-center text-xl font-semibold text-ink">Sonríe para la foto</h1>
        {error && <Mensaje tono="error">{error}</Mensaje>}
        <CapturaSelfie onCapturar={finalizarFichaje} onCancelar={() => setFase("confirmar")} />
        {enviando && <p className="text-center text-muted">Guardando…</p>}
      </main>
    );
  }

  if (fase === "resultado") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <Mensaje tono="exito">{mensajeResultado}</Mensaje>
      </main>
    );
  }

  return null;
}
