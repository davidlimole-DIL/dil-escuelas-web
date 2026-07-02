"use server"

import { createClient } from "@/utils/supabase/server"
import { signAlumnoToken } from "@/utils/jwt"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function loginAlumnoAccion(codigo: string, cuil: string) {
  const supabase = await createClient();

  // Llamar al RPC de validación sin gastar seats de GoTrue
  const { data, error } = await supabase.rpc('verificar_acceso_alumno', {
    p_codigo: codigo,
    p_cuil: cuil
  });

  if (error || !data) {
    return { error: 'Error del servidor al conectar.' };
  }

  // Cast del JSON devuelto por Postgres
  const result = data as { exito: boolean; mensaje?: string; alumno_id?: string; colegio_id?: string };

  if (!result.exito) {
    return { error: result.mensaje || 'Credenciales inválidas' };
  }

  // Generar JWT ultraligero 
  const token = await signAlumnoToken({
    alumno_id: result.alumno_id,
    colegio_id: result.colegio_id,
    cuil: cuil
  });

  // Guardar en HttpOnly Cookie
  const store = await cookies();
  store.set("alumno_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7200 // 2 horas
  });

  redirect("/alumno/portal");
}
