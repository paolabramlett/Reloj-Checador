import { createHash, randomBytes } from "node:crypto";

export function generarTokenInvitacion(): string {
  return randomBytes(24).toString("base64url");
}

export function hashTokenInvitacion(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
