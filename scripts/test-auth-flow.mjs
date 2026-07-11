/**
 * Prueba end-to-end del flujo de auth de administrador (tarea 2.3):
 * bloqueo por email sin confirmar, login exitoso, contraseña incorrecta
 * rechazada. Ejercita las mismas llamadas de Supabase que usan las Server
 * Actions, usando el API de admin para crear usuarios directamente
 * (evita el límite de envío de correo del SMTP compartido de Supabase,
 * que ya confirmamos que sí dispara al hacer signUp/resetPassword reales).
 *
 * Uso: node scripts/test-auth-flow.mjs  (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const anon = () => createClient(URL_, ANON, { auth: { persistSession: false } });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FALLA"} ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

const stamp = Date.now();
const emailConfirmado = `auth-flow-confirmado-${stamp}@mailinator.com`;
const emailSinConfirmar = `auth-flow-sinconfirmar-${stamp}@mailinator.com`;
const password = "PruebaSegura123!";
let idConfirmado, idSinConfirmar;

try {
  const { data: u1, error: e1 } = await admin.auth.admin.createUser({
    email: emailConfirmado,
    password,
    email_confirm: true,
  });
  check("Alta de usuario confirmado (fixture)", !e1, e1?.message);
  idConfirmado = u1?.user?.id;

  const { data: u2, error: e2 } = await admin.auth.admin.createUser({
    email: emailSinConfirmar,
    password,
    email_confirm: false,
  });
  check("Alta de usuario sin confirmar (fixture)", !e2, e2?.message);
  idSinConfirmar = u2?.user?.id;

  // Login sin confirmar el correo → debe rechazarse (mismo código que
  // revisa iniciarSesion en app/login/actions.ts para mostrar el mensaje
  // "todavía no confirmaste tu correo")
  const { error: loginSinConfirmar } = await anon().auth.signInWithPassword({
    email: emailSinConfirmar,
    password,
  });
  check(
    "Login sin confirmar el correo es rechazado",
    loginSinConfirmar?.code === "email_not_confirmed",
    loginSinConfirmar?.code ?? "no dio error",
  );

  // Login confirmado → debe funcionar
  const { data: loginData, error: loginError } = await anon().auth.signInWithPassword({
    email: emailConfirmado,
    password,
  });
  check("Login con correo confirmado funciona", !loginError && !!loginData?.session, loginError?.message);

  // Password incorrecto → rechazado con mensaje genérico
  const { error: passwordMalo } = await anon().auth.signInWithPassword({
    email: emailConfirmado,
    password: "otra-cosa-Incorrecta1",
  });
  check("Contraseña incorrecta es rechazada", passwordMalo?.code === "invalid_credentials");

  // Usuario inexistente → mismo tipo de error genérico (no revela cuál
  // campo falló, igual que el mensaje de iniciarSesion en la Server Action)
  const { error: usuarioInexistente } = await anon().auth.signInWithPassword({
    email: `no-existe-${stamp}@mailinator.com`,
    password,
  });
  check(
    "Usuario inexistente da el mismo error genérico que password incorrecto",
    usuarioInexistente?.code === "invalid_credentials",
  );
} finally {
  for (const id of [idConfirmado, idSinConfirmar].filter(Boolean)) {
    await admin.auth.admin.deleteUser(id);
  }
}

console.log(failures === 0 ? "\nTodas las pruebas del flujo de auth pasan." : `\n${failures} fallas.`);
console.log(
  "\nNota: signUp/resetPasswordForEmail reales no se probaron acá — el SMTP compartido de Supabase",
);
console.log(
  "tiene un límite de envío muy bajo por defecto y ya lo disparamos en el intento anterior.",
);
process.exit(failures === 0 ? 0 : 1);
