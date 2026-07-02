"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

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
  carrera_id: string | null;
  carrera_nombre?: string | null;
  carrera_diminutivo?: string | null;
  ano_ingreso: number | null;
  mes_ingreso: number | null;
  estado_academico: string;
  slots?: any[];
  progreso?: number;
  aprobados?: number;
  totalesSlots?: number;
  pendingReview?: number;
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

  if (perfilError) throw new Error("Perfil no encontrado");
  return perfil.colegio_id; // Puede ser null
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
  const adminClient = createAdminClient();
  
  try {
    const colegio_id = await getCurrentColegioId(supabase);

    let query = adminClient
      .from("alumnos")
      .select("*, colegios(nombre, slots_legajo_default), carreras(nombre, diminutivo)")
      .order("apellido_y_nombre", { ascending: true });

    if (colegio_id) {
       query = query.eq("colegio_id", colegio_id);
    }

    const { data: alumnos, error } = await query;
    if (error) throw error;

    // Obtener todos los archivos subidos para este colegio
    let legajosQuery = adminClient.from("legajos_digitales").select("*");
    if (colegio_id) {
       legajosQuery = legajosQuery.eq("colegio_id", colegio_id);
    }
    const { data: uploads } = await legajosQuery;
    
    // Agrupar uploads por ID de alumno
    const uploadsMap: Record<string, any[]> = {};
    uploads?.forEach(u => {
      if (!uploadsMap[u.alumno_id]) uploadsMap[u.alumno_id] = [];
      uploadsMap[u.alumno_id].push(u);
    });

    // Mapear alumnos con su progreso y slots
    const mappedAlumnos = alumnos.map(a => {
      const slotsDefault = a.colegios?.slots_legajo_default || [];
      const studentUploads = uploadsMap[a.id] || [];

      let aprobados = 0;
      const slots = slotsDefault.map((slot: any) => {
        const upload = studentUploads.find(u => u.tipo_slot === slot.id);
        if (upload && upload.estado === 'Aprobado') aprobados++;
        return {
          id: slot.id,
          nombre: slot.nombre,
          estado: upload ? upload.estado : 'Pendiente',
          enlace: upload ? upload.archivo_url : '',
          observaciones: upload ? upload.observaciones : '',
          fecha: upload ? new Date(upload.created_at).toLocaleDateString('es-AR') : '-'
        };
      });

      const progreso = slotsDefault.length > 0 ? Math.round((aprobados / slotsDefault.length) * 100) : 0;
      const pendingReview = studentUploads.filter(u => u.estado === 'En Revisión').length;

      return {
        ...a,
        colegio_nombre: a.colegios?.nombre || null,
        carrera_nombre: a.carreras?.nombre || null,
        carrera_diminutivo: a.carreras?.diminutivo || null,
        slots,
        progreso,
        aprobados,
        totalesSlots: slotsDefault.length,
        pendingReview
      };
    });

    // Cargar los slots del colegio actual
    let slotsDefault: any[] = [];
    if (colegio_id) {
      const { data: col } = await adminClient.from("colegios").select("slots_legajo_default").eq("id", colegio_id).single();
      slotsDefault = col?.slots_legajo_default || [];
    } else if (alumnos.length > 0) {
      slotsDefault = alumnos[0].colegios?.slots_legajo_default || [];
    }

    return { 
      success: true, 
      data: mappedAlumnos as (Alumno & { colegio_nombre?: string })[],
      colegioId: colegio_id,
      slotsDefault: slotsDefault
    };
  } catch (error: any) {
    console.error("Error obteniendo alumnos:", error);
    return { success: false, error: error.message };
  }
}

export async function crearAlumnoManual(data: Partial<Alumno>) {
  const supabase = await createClient();
  
  try {
    const colegio_id = await getCurrentColegioId(supabase);
    
    if (!colegio_id) {
       throw new Error("Para dar de alta alumnos, primero debes seleccionar un colegio específico en la barra superior.");
    }

    if (!data.cuil || !data.apellido_y_nombre || !data.ano_ingreso) {
      throw new Error("CUIL, Apellido y Nombre, y Año de Ingreso son obligatorios");
    }

    const apellido_y_nombre = formatName(data.apellido_y_nombre);
    const ano_ingreso = data.ano_ingreso;

    // Generar Legajo si es nuevo
    const id_alumno = data.id_alumno || await generateNextIdAlumno(supabase, colegio_id, ano_ingreso);

    // Identidad Virtual Invisible para el Alumno
    const virtualEmail = `${data.cuil}@${colegio_id.split('-')[0]}.alumno`;
    const virtualPassword = `${data.cuil}-dil-${colegio_id.split('-')[0]}`;
    
    const adminClient = createAdminClient();
    await adminClient.auth.admin.createUser({
      email: virtualEmail,
      password: virtualPassword,
      email_confirm: true,
      user_metadata: { cuil: data.cuil, nombre: apellido_y_nombre, colegio_id }
    });

    const payload = { ...data } as any;
    delete payload.colegio_nombre;
    delete payload.carrera_nombre;
    delete payload.carrera_diminutivo;
    delete (payload as any).colegios;
    delete (payload as any).carreras;
    delete payload.slots;
    delete payload.progreso;
    delete payload.aprobados;
    delete payload.totalesSlots;
    delete payload.pendingReview;

    const { error } = await supabase.from("alumnos").insert({
      ...payload,
      apellido_y_nombre,
      id_alumno,
      colegio_id,
      estado_academico: payload.estado_academico || "Activo"
    });

    if (error) {
       throw new Error(`Error al crear alumno: ${error.message}`);
    }

    revalidatePath("/dashboard/academico");
    return { success: true };
  } catch (error: any) {
    console.error("Error creando/actualizando alumno:", error);
    return { success: false, error: error.message };
  }
}

export async function importarAlumnosMasivos(alumnosMasivos: Partial<Alumno>[]) {
  const supabase = await createClient();
  
  try {
    const colegio_id = await getCurrentColegioId(supabase);
    
    if (!colegio_id) {
       throw new Error("Para importar alumnos, primero debes seleccionar un colegio específico en la barra superior.");
    }

    if (!alumnosMasivos || alumnosMasivos.length === 0) {
      throw new Error("No hay datos para importar");
    }

    // 1. Fetch carreras to map CSV text to carrera_id
    const { data: dbCarreras } = await supabase.from('carreras').select('id, nombre').eq('colegio_id', colegio_id).eq('estado', 'Activa');
    const carrerasMap = new Map(dbCarreras?.map(c => [c.nombre.toLowerCase().trim(), c.id]) || []);

    const cuils = alumnosMasivos.map(a => a.cuil).filter(c => c) as string[];
    
    const { data: existingRecords } = await supabase
      .from("alumnos")
      .select("id, cuil, id_alumno")
      .eq("colegio_id", colegio_id)
      .in("cuil", cuils);
      
    const existingMap = new Map(existingRecords?.map(r => [r.cuil, r]) || []);

    const toInsert = [];
    const toUpdate = [];

    // Cache correlatives by year to increment locally during loop
    const correlativeCache: Record<number, number> = {};

    for (const alumno of alumnosMasivos) {
      if (!alumno.cuil || !alumno.apellido_y_nombre || !alumno.ano_ingreso) continue; 

      const apellido_y_nombre = formatName(alumno.apellido_y_nombre);
      const ano_ingreso = parseInt(alumno.ano_ingreso as any);

      // Resolve id_alumno
      let id_alumno = "";
      if (existingMap.has(alumno.cuil)) {
        id_alumno = existingMap.get(alumno.cuil)!.id_alumno;
      } else {
        if (!correlativeCache[ano_ingreso]) {
           const { data: maxAlumno } = await supabase
            .from("alumnos")
            .select("id_alumno")
            .eq("colegio_id", colegio_id)
            .eq("ano_ingreso", ano_ingreso)
            .not("id_alumno", "is", null)
            .order("id_alumno", { ascending: false })
            .limit(1)
            .single();

            let nextNum = 1;
            if (maxAlumno && maxAlumno.id_alumno) {
              const last3 = maxAlumno.id_alumno.slice(-3);
              if (!isNaN(parseInt(last3))) nextNum = parseInt(last3, 10) + 1;
            }
            correlativeCache[ano_ingreso] = nextNum;
        }
        id_alumno = `${ano_ingreso}${correlativeCache[ano_ingreso].toString().padStart(3, '0')}`;
        correlativeCache[ano_ingreso]++; // Increment for next new student in same year
      }

      // Identidad Virtual Invisible para el Alumno
      const virtualEmail = `${alumno.cuil}@${colegio_id.split('-')[0]}.alumno`;
      const virtualPassword = `${alumno.cuil}-dil-${colegio_id.split('-')[0]}`;

      const adminClient = createAdminClient();
      await adminClient.auth.admin.createUser({
        email: virtualEmail,
        password: virtualPassword,
        email_confirm: true,
        user_metadata: { cuil: alumno.cuil, nombre: apellido_y_nombre, colegio_id }
      });
      
      // Resolve Carrera
      let mapped_carrera_id = null;
      const csvCarrera = (alumno as any).carrera || null;
      if (csvCarrera) {
         mapped_carrera_id = carrerasMap.get(csvCarrera.toLowerCase().trim());
         if (!mapped_carrera_id) {
            throw new Error(`La carrera '${csvCarrera}' ingresada para ${apellido_y_nombre} no existe en el catálogo de esta institución. Por favor, créala en el Módulo Académico o verifica que el texto sea idéntico.`);
         }
      }

      const mappedData = {
         colegio_id,
         cuil: alumno.cuil,
         id_alumno,
         apellido_y_nombre,
         email: alumno.email || null,
         telefono: alumno.telefono || null,
         domicilio: alumno.domicilio || null,
         carrera_id: mapped_carrera_id,
         ano_ingreso,
         mes_ingreso: alumno.mes_ingreso ? parseInt(alumno.mes_ingreso as any) : null,
         estado_academico: alumno.estado_academico || "Activo"
      };

      if (existingMap.has(alumno.cuil)) {
        toUpdate.push({ ...mappedData, id: existingMap.get(alumno.cuil)!.id });
      } else {
        toInsert.push(mappedData);
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from("alumnos").insert(toInsert);
      if (insertError) throw insertError;
    }

    if (toUpdate.length > 0) {
      const { error: updateError } = await supabase.from("alumnos").upsert(toUpdate);
      if (updateError) throw updateError;
    }

    revalidatePath("/dashboard/legajos");
    return { 
       success: true, 
       inserted: toInsert.length, 
       updated: toUpdate.length 
     };
  } catch (error: any) {
    console.error("Error en importación masiva:", error);
    return { success: false, error: error.message };
  }
}

export async function editarAlumno(id: string, data: Partial<Alumno>) {
  const supabase = await createClient();
  try {
    const apellido_y_nombre = data.apellido_y_nombre ? formatName(data.apellido_y_nombre) : undefined;
    
    const payload = {
      ...data,
      apellido_y_nombre
    } as any;
    
    delete payload.colegio_id;
    delete payload.cuil;
    delete payload.id_alumno;
    delete payload.id;
    
    delete payload.colegio_nombre;
    delete payload.carrera_nombre;
    delete payload.carrera_diminutivo;
    delete (payload as any).colegios;
    delete (payload as any).carreras;
    delete payload.slots;
    delete payload.progreso;
    delete payload.aprobados;
    delete payload.totalesSlots;
    delete payload.pendingReview;

    const { error } = await supabase
      .from("alumnos")
      .update(payload)
      .eq("id", id);

    if (error) throw error;
    
    revalidatePath("/dashboard/legajos");
    return { success: true };
  } catch (error: any) {
    console.error("Error editando alumno:", error);
    return { success: false, error: error.message };
  }
}

export async function eliminarAlumno(id: string, cuil: string, colegio_id: string) {
  const supabase = await createClient();
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("No autenticado");

    // Verificar si es superadmin
    const { data: perfil } = await supabase
      .from("perfiles_admin")
      .select("rol")
      .eq("id", authData.user.id)
      .single();

    const roles = Array.isArray(perfil?.rol) ? perfil?.rol : [perfil?.rol];
    if (!roles.includes("superadmin")) {
      throw new Error("No autorizado. Solo los administradores globales pueden eliminar legajos.");
    }

    // Borramos el alumno de la BD
    const { error } = await supabase.from("alumnos").delete().eq("id", id);
    if (error) throw error;

    // Intentamos borrar la identidad virtual en Auth
    const adminClient = createAdminClient();
    const virtualEmail = `${cuil}@${colegio_id.split('-')[0]}.alumno`;
    const { data: users } = await adminClient.auth.admin.listUsers();
    
    if (users && users.users) {
       const userMatch = users.users.find((u: any) => u.email === virtualEmail);
       if (userMatch) {
         await adminClient.auth.admin.deleteUser(userMatch.id);
       }
    }

    revalidatePath("/dashboard/legajos");
    return { success: true };
  } catch (error: any) {
    console.error("Error eliminando alumno:", error);
    return { success: false, error: error.message };
  }
}

export async function evaluarDocumentoLegajo(alumnoId: string, slotId: string, nuevoEstado: 'Aprobado' | 'Rechazado', observaciones: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("No autenticado");

    const { error } = await adminClient
      .from('legajos_digitales')
      .update({
        estado: nuevoEstado,
        observaciones: observaciones
      })
      .eq('alumno_id', alumnoId)
      .eq('tipo_slot', slotId);

    if (error) throw error;

    revalidatePath("/dashboard/legajos");
    return { success: true };
  } catch (error: any) {
    console.error("Error al evaluar documento:", error);
    return { success: false, error: error.message };
  }
}

export async function obtenerUrlFirmadaDocumento(path: string) {
  const supabase = await createClient();
  
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("No autorizado");

    const adminClient = createAdminClient();
    const { data, error } = await adminClient.storage
      .from('comprobantes')
      .createSignedUrl(path, 3600); // 1 hora de validez

    if (error) throw error;
    return { success: true, signedUrl: data.signedUrl };
  } catch (error: any) {
    console.error("Error al generar URL firmada para administrador:", error);
    return { success: false, error: error.message };
  }
}

export async function guardarSlotsLegajoDefault(colegioId: string, slots: { id: string, nombre: string }[]) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("No autenticado");

    // Verificar correspondencia de colegio para staff administrativo
    const userColegioId = await getCurrentColegioId(supabase);
    if (userColegioId && userColegioId !== colegioId) {
      throw new Error("No tienes autorización sobre esta institución.");
    }

    const { error } = await adminClient
      .from("colegios")
      .update({ slots_legajo_default: slots })
      .eq("id", colegioId);

    if (error) throw error;

    revalidatePath("/dashboard/legajos");
    return { success: true };
  } catch (error: any) {
    console.error("Error guardando slots predeterminados:", error);
    return { success: false, error: error.message };
  }
}
