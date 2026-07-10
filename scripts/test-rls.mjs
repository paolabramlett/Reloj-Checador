/**
 * Prueba de aislamiento multi-tenant (spec multi-tenant-accounts,
 * "Aislamiento estricto entre empresas"): dos usuarios con empresas
 * distintas no deben ver ni tocar absolutamente nada del otro.
 *
 * Uso: node scripts/test-rls.mjs  (lee .env.local)
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

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FALLA"} ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

async function crearUsuario(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "prueba-rls-Segura1!",
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user;
}

async function clienteDe(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({
    email,
    password: "prueba-rls-Segura1!",
  });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}

const stamp = Date.now();
const emailA = `rls-a-${stamp}@test.local`;
const emailB = `rls-b-${stamp}@test.local`;
let userA, userB, companyA, companyB;

try {
  userA = await crearUsuario(emailA);
  userB = await crearUsuario(emailB);
  const a = await clienteDe(emailA);
  const b = await clienteDe(emailB);

  // Cada uno crea su empresa vía el RPC atómico
  {
    const { data, error } = await a.rpc("create_company_with_owner", {
      company_name: "Empresa A",
    });
    check("A crea su empresa vía RPC", !error, error?.message);
    companyA = data;
  }
  {
    const { data, error } = await b.rpc("create_company_with_owner", {
      company_name: "Empresa B",
    });
    check("B crea su empresa vía RPC", !error, error?.message);
    companyB = data;
  }

  // A puebla su empresa
  const { data: wcA, error: wcErr } = await a
    .from("work_centers")
    .insert({ company_id: companyA, name: "Matriz A", lat: 19.43, lng: -99.13 })
    .select()
    .single();
  check("A crea centro de trabajo propio", !wcErr, wcErr?.message);

  const { error: empErr } = await a.from("employees").insert({
    company_id: companyA,
    work_center_id: wcA.id,
    full_name: "Empleado de A",
  });
  check("A da de alta empleado propio", !empErr, empErr?.message);

  // ── Aislamiento: B intenta ver/tocar lo de A ──────────────────────────
  {
    const { data } = await b.from("companies").select("id");
    check(
      "B solo ve su propia empresa",
      data?.length === 1 && data[0].id === companyB,
      `vio ${data?.length} empresas`,
    );
  }
  {
    const { data } = await b.from("companies").select().eq("id", companyA);
    check("La empresa de A no existe para B", data?.length === 0);
  }
  {
    const { data } = await b.from("work_centers").select().eq("company_id", companyA);
    check("Los centros de A no existen para B", data?.length === 0);
  }
  {
    const { data } = await b.from("employees").select().eq("company_id", companyA);
    check("Los empleados de A no existen para B", data?.length === 0);
  }
  {
    const { error } = await b.from("work_centers").insert({
      company_id: companyA,
      name: "Intruso",
      lat: 0,
      lng: 0,
    });
    check("B no puede insertar en la empresa de A", !!error);
  }
  {
    const { data } = await b
      .from("companies")
      .update({ name: "Hackeada" })
      .eq("id", companyA)
      .select();
    check("B no puede renombrar la empresa de A", data?.length === 0);
  }
  {
    const { error } = await b.from("company_members").insert({
      company_id: companyA,
      user_id: userB.id,
      role: "admin",
    });
    check("B no puede autoinvitarse a la empresa de A", !!error);
  }
  // Anónimo no ve nada
  {
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data } = await anon.from("companies").select("id");
    check("Un anónimo no ve ninguna empresa", (data ?? []).length === 0);
  }
} finally {
  // Limpieza total con service role
  for (const cid of [companyA, companyB].filter(Boolean)) {
    await admin.from("employees").delete().eq("company_id", cid);
    await admin.from("work_centers").delete().eq("company_id", cid);
    await admin.from("company_members").delete().eq("company_id", cid);
    await admin.from("companies").delete().eq("id", cid);
  }
  for (const u of [userA, userB].filter(Boolean)) {
    await admin.auth.admin.deleteUser(u.id);
  }
}

console.log(failures === 0 ? "\nTodas las pruebas de aislamiento pasan." : `\n${failures} fallas.`);
process.exit(failures === 0 ? 0 : 1);
