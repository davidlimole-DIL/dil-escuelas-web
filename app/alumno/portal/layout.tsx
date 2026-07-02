import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAlumnoToken } from "@/utils/jwt";
import { createClient } from "@/utils/supabase/server";

export default async function PortalAlumnoLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("alumno_session")?.value;

  if (!token) {
    redirect("/alumno/login");
  }

  const payload = await verifyAlumnoToken(token);
  if (!payload || !payload.colegio_id) {
    redirect("/alumno/login");
  }

  // Fetch colegio details to show the logo in the Navbar
  const supabase = await createClient();
  const { data: colegio } = await supabase
    .from("colegios")
    .select("nombre, logo_url, color_institucional")
    .eq("id", payload.colegio_id)
    .single();

  const color = colegio?.color_institucional || "#4f46e5";

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 flex flex-col relative font-[family-name:Inter]">
      {/* Top Navbar Alumno */}
      <header className="bg-white shadow-sm border-b border-slate-200 py-4 px-6 relative z-30">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            {colegio?.logo_url ? (
               <img src={colegio.logo_url} alt="Logo" className="h-12 w-12 object-contain rounded" />
            ) : (
               <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: color }}>
                  {colegio?.nombre?.charAt(0) || "C"}
               </div>
            )}
            <div>
              <h1 className="text-xl font-bold" style={{ color }}>{colegio?.nombre || "Colegio"}</h1>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Portal Alumno</p>
            </div>
          </div>
          
          <form action={async () => {
             "use server";
             const store = await cookies();
             store.delete("alumno_session");
             redirect("/");
          }}>
            <button type="submit" className="text-sm font-bold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              Salir
            </button>
          </form>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="max-w-4xl mx-auto px-4 pb-12 flex-grow w-full mt-6">
        {children}
      </main>

      {/* Footer DIL Digital */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto relative z-30">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm font-medium">
            Desarrollado por <span className="text-indigo-600 font-bold">DIL Digital</span> • Soluciones Contables & Tecnológicas
          </p>
        </div>
      </footer>
    </div>
  );
}
