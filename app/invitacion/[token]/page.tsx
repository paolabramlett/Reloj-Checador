import { crearClienteAdmin } from "@/lib/supabase/admin";
import { hashTokenInvitacion } from "@/lib/invitacion";
import { FormularioReclamarInvitacion } from "@/components/formulario-reclamar-invitacion";

export default async function PaginaInvitacion({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = crearClienteAdmin();
  const tokenHash = hashTokenInvitacion(token);

  const { data: invitacion } = await admin
    .from("employee_invitations")
    .select("expires_at, used_at, employees(full_name, auth_user_id, status)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const empleado = invitacion?.employees as unknown as {
    full_name: string;
    auth_user_id: string | null;
    status: string;
  } | null;

  const invalido =
    !invitacion ||
    !!invitacion.used_at ||
    new Date(invitacion.expires_at) < new Date() ||
    !empleado ||
    !!empleado.auth_user_id ||
    empleado.status !== "active";

  if (invalido) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-2xl font-semibold text-ink">Este enlace ya no es válido</h1>
        <p className="text-muted">Pídele a tu empleador que te mande uno nuevo.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <FormularioReclamarInvitacion token={token} nombre={empleado.full_name} />
    </main>
  );
}
