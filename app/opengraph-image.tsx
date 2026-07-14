import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Chekly — el checador que deja tu negocio en regla";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ImagenOpenGraph() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          backgroundColor: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 56 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 999,
              border: "6px solid #006929",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 28,
                height: 16,
                borderLeft: "7px solid #00C24C",
                borderBottom: "7px solid #00C24C",
                transform: "rotate(-45deg) translate(2px, -4px)",
              }}
            />
          </div>
          <span style={{ fontSize: 44, fontWeight: 700, color: "#171717" }}>Chekly</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: "#171717",
            maxWidth: 920,
          }}
        >
          El checador que deja tu negocio en regla.
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#525252", marginTop: 32, maxWidth: 820 }}>
          Registro de asistencia con geocerca, PIN y selfie — listo para una inspección de la STPS.
        </div>
      </div>
    ),
    { ...size },
  );
}
