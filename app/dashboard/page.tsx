import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData?.user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("perfiles_admin")
    .select("rol, colegio_id")
    .eq("id", authData.user.id)
    .single();

  if (!perfil) {
    redirect("/login");
  }

  let roles: string[] = [];
  if (Array.isArray(perfil.rol)) {
    roles = perfil.rol;
  } else if (typeof perfil.rol === 'string') {
    if (perfil.rol.startsWith('{') && perfil.rol.endsWith('}')) {
       roles = perfil.rol.slice(1, -1).split(',').map(r => r.trim().replace(/"/g, ''));
    } else {
       roles = [perfil.rol.replace(/"/g, '')];
    }
  }
  roles = roles.filter(Boolean);

  if (roles.includes("superadmin")) {
    redirect("/master");
  }

  if (roles.length > 0) {
    let primerRol = roles[0].trim();
    if (primerRol === "admin" || primerRol === "administrativo") {
      primerRol = "directivo";
    }
    redirect(`/dashboard/${primerRol}?colegio=${perfil.colegio_id || ""}`);
  }

  redirect("/login");
}
