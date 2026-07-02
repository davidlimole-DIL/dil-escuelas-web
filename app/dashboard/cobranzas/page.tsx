import { obtenerPagosPendientes, obtenerHistorialPagos } from "./actions";
import CobranzasClient from "./CobranzasClient";
import { createClient } from "@/utils/supabase/server";

export const metadata = {
  title: "Módulo de Cobranzas | DIL Escuelas",
};

export default async function CobranzasPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  let isGlobalMode = false;
  if (authData?.user) {
    const { data: perfil } = await supabase
      .from("perfiles_admin")
      .select("colegio_id")
      .eq("id", authData.user.id)
      .single();
      
    if (perfil && perfil.colegio_id === null) {
      isGlobalMode = true;
    }
  }

  const [pendientesRes, historialRes] = await Promise.all([
    obtenerPagosPendientes(),
    obtenerHistorialPagos(),
  ]);

  if (!pendientesRes.success || !historialRes.success) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl shadow-sm max-w-2xl mx-auto">
          <h2 className="text-xl font-bold mb-2">Error al cargar el módulo de cobranzas</h2>
          <p className="text-sm">
            {pendientesRes.error || historialRes.error || "Error de red o conexión desconocido"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <CobranzasClient
      initialPendientes={pendientesRes.data || []}
      initialHistorial={historialRes.data || []}
      isGlobalMode={isGlobalMode}
    />
  );
}
