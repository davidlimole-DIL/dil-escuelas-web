import { obtenerAlumnos, obtenerCarreras } from "./actions";
import AcademicoClient from "./AcademicoClient";
import { createClient } from "@/utils/supabase/server";

export const metadata = {
  title: "Módulo Académico | DIL Escuelas",
};

export default async function AcademicoPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  let isGlobalMode = false;
  if (authData?.user) {
    const { data: perfil } = await supabase.from("perfiles_admin").select("colegio_id").eq("id", authData.user.id).single();
    if (perfil && perfil.colegio_id === null) {
      isGlobalMode = true;
    }
  }

  const [{ success, data, error }, { success: sucC, data: dataC, error: errC }] = await Promise.all([
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

  return <AcademicoClient initialAlumnos={data || []} initialCarreras={dataC || []} isGlobalMode={isGlobalMode} />;
}
