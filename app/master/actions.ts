"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

// Verificar si el usuario actual es superadmin
async function checkSuperAdmin() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("No autenticado");

  const { data: perfil } = await supabase
    .from("perfiles_admin")
    .select("rol")
    .eq("id", authData.user.id)
    .single();

  // Ojo: definimos el rol "superadmin" para este módulo
  // Soporte para array de roles
  const roles = Array.isArray(perfil?.rol) ? perfil.rol : [perfil?.rol];
  if (!roles.includes("superadmin")) {
    throw new Error(`No tienes permisos de SuperAdmin. Estás logueado como: ${authData.user.email} con rol: ${roles.join(', ') || 'No asignado'}`);
  }
}

// Obtener todos los colegios y sus perfiles asociados
export async function getMasterData() {
  await checkSuperAdmin();
  const adminClient = createAdminClient();

  const { data: colegios, error: colError } = await adminClient
    .from("colegios")
    .select("*")
    .order("nombre");
    
  if (colError) throw new Error(colError.message);

  const { data: perfiles, error: perfError } = await adminClient
    .from("perfiles_admin")
    .select("*")
    .order("colegio_id");
    
  if (perfError) throw new Error(perfError.message);

  return { colegios, perfiles };
}

// Tipo para configuración ARCA de la institución
type ArcaConfig = {
  arca_habilitado: boolean;
  arca_api_key: string;
  arca_punto_venta: number | null;
  arca_concepto: number;
};

// Crear un Colegio
export async function crearColegio(
  nombre: string, color: string, codigo: string, cuit: string,
  arca?: ArcaConfig
) {
  await checkSuperAdmin();
  const adminClient = createAdminClient();

  const cuitLimpio = cuit ? cuit.replace(/\D/g, "") : null;

  const insertData: Record<string, any> = {
    nombre,
    color_institucional: color,
    codigo: codigo.trim().toUpperCase(),
    cuit: cuitLimpio || null,
    arca_habilitado: arca?.arca_habilitado || false,
    arca_api_key: arca?.arca_habilitado ? (arca.arca_api_key || null) : null,
    arca_punto_venta: arca?.arca_habilitado ? (arca.arca_punto_venta || null) : null,
    arca_concepto: arca?.arca_habilitado ? (arca.arca_concepto || 2) : 2,
  };

  const { data, error } = await adminClient
    .from("colegios")
    .insert(insertData)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  
  revalidatePath("/master");
  return { success: true, data };
}

// Crear un Usuario Administrativo (Auth + Perfil)
export async function crearUsuario(email: string, password: string, nombreCompleto: string, rol: string[], colegioId: string) {
  await checkSuperAdmin();
  const adminClient = createAdminClient();

  // 1. Crear el usuario en auth.users saltándose validaciones de cliente
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true // Lo confirmamos automáticamente para evitar problemas
  });

  if (authError) return { success: false, error: authError.message };
  
  const newUserId = authData.user.id;

  // 2. Insertar su perfil en perfiles_admin
  const { error: profileError } = await adminClient
    .from("perfiles_admin")
    .insert({
      id: newUserId,
      colegio_id: colegioId,
      nombre_completo: nombreCompleto,
      email: email,
      rol: rol
    });

  if (profileError) {
    // Podríamos hacer un rollback borrando el usuario de auth si falla el perfil, 
    // pero para este MVP informamos el error.
    return { success: false, error: profileError.message };
  }

  revalidatePath("/master");
  return { success: true };
}

// Actualizar un Colegio
export async function editarColegio(
  id: string, nombre: string, color: string, codigo: string, cuit: string,
  arca?: ArcaConfig
) {
  await checkSuperAdmin();
  const adminClient = createAdminClient();

  const cuitLimpio = cuit ? cuit.replace(/\D/g, "") : null;

  const updateData: Record<string, any> = {
    nombre,
    color_institucional: color,
    codigo: codigo.trim().toUpperCase(),
    cuit: cuitLimpio || null,
    arca_habilitado: arca?.arca_habilitado || false,
    arca_api_key: arca?.arca_habilitado ? (arca.arca_api_key || null) : null,
    arca_punto_venta: arca?.arca_habilitado ? (arca.arca_punto_venta || null) : null,
    arca_concepto: arca?.arca_habilitado ? (arca.arca_concepto || 2) : 2,
  };

  const { error } = await adminClient
    .from("colegios")
    .update(updateData)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  
  revalidatePath("/master");
  return { success: true };
}

// Eliminar un Colegio
export async function eliminarColegio(id: string) {
  await checkSuperAdmin();
  const adminClient = createAdminClient();

  // Supabase lanzará un error si hay restricciones de clave foránea (usuarios o alumnos ligados)
  const { error } = await adminClient
    .from("colegios")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: "No se puede eliminar el colegio. Asegúrate de que no tenga usuarios o alumnos asignados. (Error: " + error.message + ")" };
  
  revalidatePath("/master");
  return { success: true };
}

// Editar un Usuario
export async function editarUsuario(id: string, email: string, nombreCompleto: string, rol: string[], colegioId: string, newPassword?: string) {
  await checkSuperAdmin();
  const adminClient = createAdminClient();

  // 1. Actualizar perfil en tabla perfiles_admin
  const { error: profileError } = await adminClient
    .from("perfiles_admin")
    .update({
      colegio_id: colegioId,
      nombre_completo: nombreCompleto,
      email: email,
      rol: rol
    })
    .eq("id", id);

  if (profileError) return { success: false, error: profileError.message };

  // 2. Actualizar credenciales en auth.users
  const authUpdates: any = { email: email };
  if (newPassword && newPassword.trim() !== "") {
    authUpdates.password = newPassword;
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(id, authUpdates);
  
  if (authError) return { success: false, error: authError.message };

  revalidatePath("/master");
  return { success: true };
}

// Eliminar un Usuario
export async function eliminarUsuario(id: string) {
  await checkSuperAdmin();
  const adminClient = createAdminClient();

  // 1. Borrar perfil de la tabla pública
  const { error: profileError } = await adminClient
    .from("perfiles_admin")
    .delete()
    .eq("id", id);

  if (profileError) return { success: false, error: profileError.message };

  // 2. Borrar identidad de Supabase Auth
  const { error: authError } = await adminClient.auth.admin.deleteUser(id);
  
  if (authError) return { success: false, error: authError.message };

  revalidatePath("/master");
  return { success: true };
}
