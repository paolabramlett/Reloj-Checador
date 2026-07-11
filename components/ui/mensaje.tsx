type Tono = "error" | "exito";

const clasesPorTono: Record<Tono, string> = {
  error: "bg-danger-tint text-danger",
  exito: "bg-primary-tint text-primary-strong",
};

export function Mensaje({ tono, children }: { tono: Tono; children: React.ReactNode }) {
  return (
    <p
      role={tono === "error" ? "alert" : "status"}
      className={`rounded-md px-4 py-3 text-sm font-medium ${clasesPorTono[tono]}`}
    >
      {children}
    </p>
  );
}
