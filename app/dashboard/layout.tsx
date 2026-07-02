import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import SuperAdminContextSwitcher from "./components/SuperAdminContextSwitcher";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.getUser();

  if (error || !authData.user) {
    redirect("/login");
  }

  // Obtenemos el perfil para validar permisos generales (y de paso renderizar nombre)
  const { data: perfil } = await supabase
    .from("perfiles_admin")
    .select("nombre_completo, email, rol, colegio_id")
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
  
  const isSuperadmin = roles.includes("superadmin");

  // Si es superadmin, traemos todos los colegios para el selector usando el AdminClient para evadir RLS
  let colegios: { id: string; nombre: string }[] = [];
  if (isSuperadmin) {
    const adminClient = createAdminClient();
    const { data: cols } = await adminClient.from("colegios").select("id, nombre").order("nombre");
    if (cols) colegios = cols;
  }

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col relative font-[family-name:Inter]">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm">
                {perfil.nombre_completo?.charAt(0) || "D"}
             </div>
             <div>
                <p className="text-sm font-bold text-slate-800 tracking-tight">{perfil.nombre_completo || perfil.email}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-[120px]">{roles.join(', ')}</p>
             </div>
          </div>

          <nav className="hidden md:flex flex-wrap justify-center items-center gap-4 lg:gap-6 mx-4">
             {isSuperadmin && (
                <a href="/master" className="text-sm font-semibold text-amber-600 hover:text-amber-700 transition-colors bg-amber-50 px-2 py-1 rounded-lg">👑 Master</a>
             )}

             {/* Solo mostramos los enlaces si el usuario tiene el rol correspondiente O si es superadmin */}
             {(isSuperadmin || roles.includes("directivo")) && (
                <a href="/dashboard/directivo" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">Directivo</a>
             )}

             {(isSuperadmin || roles.includes("academico")) && (
                <a href="/dashboard/academico" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">Académico</a>
             )}

             {(isSuperadmin || roles.includes("cobranzas")) && (
                <a href="/dashboard/cobranzas" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">Cobranzas</a>
             )}
             
             {(isSuperadmin || roles.includes("devengos")) && (
                <a href="/dashboard/devengos" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">Devengos</a>
             )}

             {(isSuperadmin || roles.includes("legajos")) && (
                <a href="/dashboard/legajos" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">Legajos</a>
             )}

             {(isSuperadmin || roles.includes("facturacion")) && (
                <a href="/dashboard/facturacion" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">Facturación</a>
             )}
          </nav>
          
          <div className="flex items-center">
            {isSuperadmin && (
              <SuperAdminContextSwitcher colegios={colegios} colegioActivoId={perfil.colegio_id} />
            )}
            <form action={async () => {
               "use server";
               const supabaseSignOut = await createClient();
               await supabaseSignOut.auth.signOut();
               redirect("/login");
            }}>
              <button type="submit" className="text-sm font-semibold px-4 py-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-600 transition-colors border border-transparent hover:border-red-100 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Cerrar Sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Renderizamos la vista hija (Ej: directivo/page.tsx) */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer DIL Digital */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center gap-1">
          <p className="text-slate-500 text-sm font-medium">
            BI Gerencial <span className="font-extrabold text-slate-800">DIL-Escuelas</span>
          </p>
          <p className="text-slate-400 text-xs">Desarrollado por <span className="text-indigo-600 font-bold">DIL Digital</span></p>
        </div>
      </footer>
    </div>
  );
}
