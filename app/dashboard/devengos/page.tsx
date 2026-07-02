import { obtenerAlumnosActivosDevengos, obtenerHistorialDevengos } from "./actions";
import DevengosClient from "./DevengosClient";
import { createClient } from "@/utils/supabase/server";

export const metadata = {
  title: "Módulo de Devengos | DIL Escuelas",
};

export default async function DevengosPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  let colegioNombre = "Todos los Colegios";

  if (authData?.user) {
    const { data: perfil } = await supabase
      .from("perfiles_admin")
      .select("colegio_id")
      .eq("id", authData.user.id)
      .single();

    if (perfil && perfil.colegio_id) {
      const { data: col } = await supabase
        .from("colegios")
        .select("nombre")
        .eq("id", perfil.colegio_id)
        .single();
      
      if (col && col.nombre) {
        colegioNombre = col.nombre;
      }
    }
  }

  // Fetch both active students and generated accrual history in parallel
  const [alumnosRes, historialRes] = await Promise.all([
    obtenerAlumnosActivosDevengos(),
    obtenerHistorialDevengos()
  ]);

  if (!alumnosRes.success || !historialRes.success) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-2">Error al cargar datos</h2>
          <p className="text-sm">
            {alumnosRes.error || historialRes.error || "Ocurrió un error inesperado al recuperar los datos."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <DevengosClient
      alumnos={alumnosRes.data || []}
      historialInicial={historialRes.data || []}
      colegioNombre={colegioNombre}
    />
  );
}
