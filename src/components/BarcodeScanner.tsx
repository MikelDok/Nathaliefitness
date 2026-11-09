"use client";

import { useEffect, useRef, useState } from "react";

/** Escáner de códigos de barras con la cámara (ZXing). Con fallback manual fuera. */
export default function BarcodeScanner({
  onResult,
  onClose,
}: {
  onResult: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              controls.stop();
              onResult(result.getText());
            }
          }
        );
        stop = () => controls.stop();
      } catch {
        setError(
          "No se pudo acceder a la cámara. Comprueba los permisos, o escribe el código a mano."
        );
      }
    })();

    return () => { cancelled = true; if (stop) stop(); };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 p-4 backdrop-blur"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)", paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <p className="eyebrow text-center">Escanear código de barras</p>
        <div className="card mt-3 overflow-hidden">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="aspect-[3/4] w-full object-cover" />
        </div>
        {error ? (
          <p className="mt-3 text-center text-xs text-danger">{error}</p>
        ) : (
          <p className="mt-3 text-center text-xs text-muted">
            Apunta al código de barras del producto.
          </p>
        )}
        <button onClick={onClose}
          className="mt-4 w-full rounded-full border border-line py-3 text-sm text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}
