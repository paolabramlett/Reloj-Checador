"use client";

import { useEffect, useRef, useState } from "react";
import { Boton } from "@/components/ui/button";

interface CapturaSelfieProps {
  onCapturar: (dataUrl: string) => void;
  onCancelar: () => void;
}

// Solo toma una foto como evidencia — sin reconocimiento facial ni
// matching biométrico (spec time-clock, "Fichaje en modo kiosco").
export function CapturaSelfie({ onCapturar, onCancelar }: CapturaSelfieProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        if (cancelado) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("No pudimos abrir la cámara. Revisa los permisos del dispositivo."));

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function tomarFoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setFoto(canvas.toDataURL("image/jpeg", 0.85));
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-danger">{error}</p>
        <Boton variante="secundario" onClick={onCancelar}>
          Volver
        </Boton>
      </div>
    );
  }

  if (foto) {
    return (
      <div className="flex flex-col gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto} alt="Foto tomada" className="w-full rounded-md" />
        <Boton onClick={() => onCapturar(foto)}>Confirmar</Boton>
        <Boton variante="secundario" onClick={() => setFoto(null)}>
          Repetir foto
        </Boton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-md bg-neutral-900" />
      <Boton onClick={tomarFoto}>Tomar foto</Boton>
      <Boton variante="secundario" onClick={onCancelar}>
        Cancelar
      </Boton>
    </div>
  );
}
