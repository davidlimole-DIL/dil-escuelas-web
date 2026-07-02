import { obtenerAlumnos } from "./actions";
import { obtenerCarreras } from "../academico/actions";
import LegajosClient from "./LegajosClient";
import { createClient } from "@/utils/supabase/server";

export const metadata = {
  title: "Módulo Legajos | DIL Escuelas",
};

export default async function LegajosPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  let isSuperadmin = false;
  let isGlobalMode = false;

  if (authData?.user) {
    const { data: perfil } = await supabase
      .from("perfiles_admin")
      .select("rol, colegio_id")
      .eq("id", authData.user.id)
      .single();

    if (perfil) {
      const roles = Array.isArray(perfil.rol) ? perfil.rol : [perfil.rol];
      isSuperadmin = roles.includes("superadmin");
      isGlobalMode = isSuperadmin && perfil.colegio_id === null;
    }
  }

  const [{ success, data, error, colegioId, slotsDefault }, { success: sucC, data: dataC, error: errC }] = await Promise.all([
    obtenerAlumnos(),
    obtenerCarreras()
  ]);

  if (!success || !sucC) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-2">Error al cargar datos</h2>
          <p className="text-sm">{error || errC || "Error desconocido"}</p>
        </div>
      </div>
    );
  }

  return (
    <LegajosClient 
      initialAlumnos={data || []} 
      carrerasDisponibles={dataC || []} 
      isSuperadmin={isSuperadmin} 
      isGlobalMode={isGlobalMode} 
      initialSlotsDefault={slotsDefault || []}
      colegioId={colegioId}
    />
  );
}
