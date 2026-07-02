"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// Type definitions based on DB schema
// Type definitions based on DB schema
export type Alumno = {
  id: string; // UUID interno
  id_alumno: string; // Legajo: Año + 3 digitos
  colegio_id: string;
  cuil: string;
  apellido_y_nombre: string;
  email: string | null;
  telefono: string | null;
  domicilio: string | null;
  carrera: string | null;
  ano_ingreso: number | null;
  mes_ingreso: number | null;
  estado_academico: string;
};

// Gets the required colegio_id for the current user
async function getCurrentColegioId(supabase: any) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("No autenticado");

  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles_admin")
    .select("colegio_id")
    .eq("id", authData.user.id)
    .single();

  if (perfilError || !perfil) throw new Error("Perfil no encontrado");
  return perfil.colegio_id;
}

// Format Name Helper
const formatName = (name: string) => name.trim().toUpperCase();

// Generate next id_alumno (Legajo) Helper
async function generateNextIdAlumno(supabase: any, colegio_id: string, ano_ingreso: number) {
  const { data, error } = await supabase
    .from("alumnos")
    .select("id_alumno")
    .eq("colegio_id", colegio_id)
    .eq("ano_ingreso", ano_ingreso)
    .not("id_alumno", "is", null)
    .order("id_alumno", { ascending: false })
    .limit(1)
    .single();

  let nextNum = 1;
  if (data && data.id_alumno) {
    const last3 = data.id_alumno.slice(-3);
    if (!isNaN(parseInt(last3))) {
      nextNum = parseInt(last3, 10) + 1;
    }
  }
  return `${ano_ingreso}${nextNum.toString().padStart(3, '0')}`;
}

export async function obtenerAlumnos() {
  const supabase = await createClient();
  
  try {
    const colegio_id = await getCurrentColegioId(supabase);

    let query = supabase
      .from("alumnos")
      .select("*")
      .order("apellido_y_nombre", { ascending: true });

    if (colegio_id) {
      query = query.eq("colegio_id", colegio_id);
    }

    const { data: alumnos, error } = await query;

    if (error) throw error;
    
    return { success: true, data: alumnos as Alumno[] };
  } catch (error: any) {
    console.error("Error obteniendo alumnos:", error);
    return { success: false, error: error.message };
  }
}

export async function actualizarEstadoAcademico(id: string, nuevoEstado: string) {
  const supabase = await createClient();
  
  try {
    const colegio_id = await getCurrentColegioId(supabase);

    let query = supabase
      .from("alumnos")
      .update({ estado_academico: nuevoEstado })
      .eq("id", id);

    if (colegio_id) {
      query = query.eq("colegio_id", colegio_id);
    }

    const { error } = await query;

    if (error) throw error;

    revalidatePath("/dashboard/academico");
    return { success: true };
  } catch (error: any) {
    console.error("Error actualizando estado académico:", error);
    return { success: false, error: error.message };
  }
}

export type Carrera = {
  id: string;
  colegio_id: string;
  nombre: string;
  diminutivo: string | null;
  estado: string;
  created_at: string;
};

export async function obtenerCarreras() {
  const supabase = await createClient();
  const adminClient = require("@/utils/supabase/admin").createAdminClient();
  
  try {
    const colegio_id = await getCurrentColegioId(supabase);

    let query = adminClient
      .from("carreras")
      .select("*")
      .order("nombre", { ascending: true });

    if (colegio_id) {
       query = query.eq("colegio_id", colegio_id);
    }

    const { data: carreras, error } = await query;
    if (error) throw error;
    
    return { success: true, data: carreras as Carrera[] };
  } catch (error: any) {
    console.error("Error obteniendo carreras:", error);
    return { success: false, error: error.message };
  }
}

export async function crearCarrera(nombre: string, diminutivo: string) {
  const supabase = await createClient();
  
  try {
    const colegio_id = await getCurrentColegioId(supabase);
    if (!colegio_id) throw new Error("Debes seleccionar un colegio específico para crear una carrera.");

    const { error } = await supabase
      .from("carreras")
      .insert({
        colegio_id,
        nombre: nombre.trim().toUpperCase(),
        diminutivo: diminutivo ? diminutivo.trim().toUpperCase() : null,
        estado: "Activa"
      });

    if (error) throw error;

    revalidatePath("/dashboard/academico");
    return { success: true };
  } catch (error: any) {
    console.error("Error creando carrera:", error);
    return { success: false, error: error.message };
  }
}

export async function editarCarrera(id: string, nombre: string, diminutivo: string, estado: string) {
  const supabase = await createClient();
  
  try {
    const colegio_id = await getCurrentColegioId(supabase);

    let query = supabase
      .from("carreras")
      .update({ 
        nombre: nombre.trim().toUpperCase(), 
        diminutivo: diminutivo ? diminutivo.trim().toUpperCase() : null,
        estado 
      })
      .eq("id", id);

    if (colegio_id) {
      query = query.eq("colegio_id", colegio_id);
    }

    const { error } = await query;
    if (error) throw error;

    revalidatePath("/dashboard/academico");
    return { success: true };
  } catch (error: any) {
    console.error("Error editando carrera:", error);
    return { success: false, error: error.message };
  }
}

export async function eliminarCarrera(id: string) {
  const supabase = await createClient();
  
  try {
    const colegio_id = await getCurrentColegioId(supabase);

    let query = supabase
      .from("carreras")
      .delete()
      .eq("id", id);

    if (colegio_id) {
      query = query.eq("colegio_id", colegio_id);
    }

    const { error } = await query;
    // Si hay alumnos que referencian esta carrera, Supabase puede arrojar error
    if (error) throw new Error("No se puede eliminar la carrera porque tiene alumnos asignados o hubo un error: " + error.message);

    revalidatePath("/dashboard/academico");
    return { success: true };
  } catch (error: any) {
    console.error("Error eliminando carrera:", error);
    return { success: false, error: error.message };
  }
}
