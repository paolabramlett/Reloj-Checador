import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { TipoEvento } from "./fichaje";

export interface FichajeEnCola {
  id: string;
  eventType: TipoEvento;
  deviceTs: string;
  lat: number;
  lng: number;
  intentos: number;
  ultimoError?: string;
}

interface ColaDB extends DBSchema {
  fichajes: {
    key: string;
    value: FichajeEnCola;
  };
}

let dbPromise: Promise<IDBPDatabase<ColaDB>> | null = null;

// Un solo objectStore de fichajes pendientes: un registro que ya se
// sincronizó se BORRA de acá, no se conserva — la fuente de verdad pasa a
// ser el servidor. Persiste solo mientras espera conexión (spec
// offline-sync: "sobrevive cierres de la app y reinicios del dispositivo").
function abrirDB() {
  if (!dbPromise) {
    dbPromise = openDB<ColaDB>("reloj-checador", 1, {
      upgrade(db) {
        db.createObjectStore("fichajes", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function encolarFichaje(
  fichaje: Omit<FichajeEnCola, "intentos" | "ultimoError">,
): Promise<void> {
  const db = await abrirDB();
  await db.put("fichajes", { ...fichaje, intentos: 0 });
}

export async function listarPendientes(): Promise<FichajeEnCola[]> {
  const db = await abrirDB();
  return db.getAll("fichajes");
}

export async function contarPendientes(): Promise<number> {
  const db = await abrirDB();
  return db.count("fichajes");
}

export async function eliminarDeCola(id: string): Promise<void> {
  const db = await abrirDB();
  await db.delete("fichajes", id);
}

export async function marcarIntentoFallido(id: string, error: string): Promise<void> {
  const db = await abrirDB();
  const item = await db.get("fichajes", id);
  if (item) {
    await db.put("fichajes", { ...item, intentos: item.intentos + 1, ultimoError: error });
  }
}
