"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export type AlumnoDevengo = {
  id: string;
  legajo: string;
  nombre: string;
  cuil: string;
  carrera: string;
};

// Gets the active colegio_id for the current administrator session
async function getCurrentColegioId(supabase: any) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("No autenticado");

  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles_admin")
    .select("colegio_id")
    .eq("id", authData.user.id)
    .single();

  if (perfilError || !perfil) throw new Error("Perfil no encontrado");
  return perfil.colegio_id; // Can be null for superadmin (all schools)
}

export async function obtenerAlumnosActivosDevengos() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    const colegio_id = await getCurrentColegioId(supabase);

    let query = adminClient
      .from("alumnos")
      .select("id, id_alumno, apellido_y_nombre, cuil, estado_academico, carreras(nombre)")
      .eq("estado_academico", "Activo")
      .order("apellido_y_nombre", { ascending: true });

    if (colegio_id) {
      query = query.eq("colegio_id", colegio_id);
    }

    const { data: alumnos, error } = await query;
    if (error) throw error;

    const mapped: AlumnoDevengo[] = (alumnos || []).map((al: any) => ({
      id: al.id,
      legajo: al.id_alumno || "",
      nombre: al.apellido_y_nombre,
      cuil: al.cuil || "",
      carrera: al.carreras?.nombre || "Sin carrera"
    }));

    return { success: true, data: mapped };
  } catch (error: any) {
    console.error("Error obteniendo alumnos para devengos:", error);
    return { success: false, error: error.message };
  }
}

export async function registrarDevengosMasivos(
  concepto: string,
  monto: number,
  fechaVto: string, // format YYYY-MM-DD
  alumnoIds: string[]
) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    if (!concepto.trim()) throw new Error("El concepto es requerido.");
    if (!monto || monto <= 0) throw new Error("El monto debe ser mayor a 0.");
    if (!fechaVto) throw new Error("La fecha de vencimiento es requerida.");
    if (!alumnoIds || alumnoIds.length === 0) throw new Error("Debe seleccionar al menos un alumno.");

    const adminColegioId = await getCurrentColegioId(supabase);

    // Fetch the colegio_id for all targeted students to ensure correctness and validation
    const { data: alumnosData, error: alumnosError } = await adminClient
      .from("alumnos")
      .select("id, colegio_id")
      .in("id", alumnoIds);

    if (alumnosError || !alumnosData) {
      throw new Error("No se pudo validar la información de los alumnos seleccionados.");
    }

    // Security check: if the admin has a restricted colegio_id, ensure all targeted students belong to it
    if (adminColegioId) {
      const violatesSecurity = alumnosData.some(al => al.colegio_id !== adminColegioId);
      if (violatesSecurity) {
        throw new Error("Acceso denegado: Uno o más alumnos seleccionados no pertenecen a su institución.");
      }
    }

    // Construct the mass billing records
    const devengosInsert = alumnosData.map(al => ({
      colegio_id: al.colegio_id,
      alumno_id: al.id,
      concepto: concepto.trim(),
      monto: Number(monto),
      fecha_vencimiento: fechaVto
    }));

    // Batch insert using adminClient to override potential row-level security constraints for administrative actions
    const { error: insertError } = await adminClient
      .from("devengamientos")
      .insert(devengosInsert);

    if (insertError) throw insertError;

    // Revalidate paths to update relevant dashboard states
    revalidatePath("/dashboard/devengos");
    revalidatePath("/dashboard/cobranzas");
    revalidatePath("/dashboard");
    revalidatePath("/");

    return { success: true, cantidad: devengosInsert.length };
  } catch (error: any) {
    console.error("Error registrando devengamientos masivos:", error);
    return { success: false, error: error.message };
  }
}

export type DevengamientoHistorico = {
  id: string;
  concepto: string;
  monto: number;
  fecha_vencimiento: string;
  created_at: string;
  alumno: {
    apellido_y_nombre: string;
    cuil: string;
  } | null;
};

export async function obtenerHistorialDevengos() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    const colegio_id = await getCurrentColegioId(supabase);

    let query = adminClient
      .from("devengamientos")
      .select("id, concepto, monto, fecha_vencimiento, created_at, alumnos(apellido_y_nombre, cuil)")
      .order("created_at", { ascending: false });

    if (colegio_id) {
      query = query.eq("colegio_id", colegio_id);
    }

    const { data: devengos, error } = await query;
    if (error) throw error;

    const mapped: DevengamientoHistorico[] = (devengos || []).map((d: any) => ({
      id: d.id,
      concepto: d.concepto,
      monto: Number(d.monto),
      fecha_vencimiento: d.fecha_vencimiento,
      created_at: d.created_at,
      alumno: d.alumnos
        ? {
            apellido_y_nombre: d.alumnos.apellido_y_nombre,
            cuil: d.alumnos.cuil || "",
          }
        : null,
    }));

    return { success: true, data: mapped };
  } catch (error: any) {
    console.error("Error obteniendo historial de devengos:", error);
    return { success: false, error: error.message };
  }
}

export async function eliminarDevengamiento(id: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    const adminColegioId = await getCurrentColegioId(supabase);

    // Fetch the targeted record first to check colegio_id
    const { data: devengo, error: fetchError } = await adminClient
      .from("devengamientos")
      .select("colegio_id")
      .eq("id", id)
      .single();

    if (fetchError || !devengo) {
      throw new Error("El devengamiento solicitado no existe.");
    }

    // Security check: if the admin has a restricted colegio_id, ensure they own this record
    if (adminColegioId && devengo.colegio_id !== adminColegioId) {
      throw new Error("Acceso denegado: No tienes autorización sobre este registro.");
    }

    // Execute deletion using adminClient to bypass potential RLS policy limitations on deletion
    const { error: deleteError } = await adminClient
      .from("devengamientos")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    // Revalidate paths to update states
    revalidatePath("/dashboard/devengos");
    revalidatePath("/dashboard/cobranzas");
    revalidatePath("/dashboard");
    revalidatePath("/");

    return { success: true };
  } catch (error: any) {
    console.error("Error eliminando devengamiento:", error);
    return { success: false, error: error.message };
  }
}

