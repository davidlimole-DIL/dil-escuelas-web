"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export type Pago = {
  id: string;
  alumno_id: string;
  colegio_id: string;
  monto: number;
  fecha_pago: string;
  estado: string;
  observacion: string | null;
  comprobante_url: string | null;
  created_at: string;
  alumno?: {
    apellido_y_nombre: string;
    cuil: string;
  } | null;
  link?: string; // URL firmada de descarga
  cae?: string | null;
  factura_url?: string | null;
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
  return perfil.colegio_id; // Puede ser null para superadmin
}

export async function obtenerPagosPendientes() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    const colegio_id = await getCurrentColegioId(supabase);

    let query = adminClient
      .from("pagos")
      .select("*, alumnos(apellido_y_nombre, cuil)")
      .eq("estado", "Pendiente")
      .order("fecha_pago", { ascending: true });

    if (colegio_id) {
      query = query.eq("colegio_id", colegio_id);
    }

    const { data: pagos, error } = await query;
    if (error) throw error;

    // Generar enlaces para los comprobantes
    const mappedPagos = (pagos || []).map((p: any) => {
      const link = p.comprobante_url
        ? `/api/comprobantes/ver?path=${encodeURIComponent(p.comprobante_url)}`
        : undefined;

      return {
        id: p.id,
        alumno_id: p.alumno_id,
        colegio_id: p.colegio_id,
        monto: Number(p.monto),
        fecha_pago: p.fecha_pago,
        estado: p.estado,
        observacion: p.observacion,
        comprobante_url: p.comprobante_url,
        created_at: p.created_at,
        alumno: p.alumnos ? {
          apellido_y_nombre: p.alumnos.apellido_y_nombre,
          cuil: p.alumnos.cuil,
        } : null,
        link,
        cae: p.cae || null,
        factura_url: p.factura_url || null,
      };
    });

    return { success: true, data: mappedPagos as Pago[] };
  } catch (error: any) {
    console.error("Error obteniendo pagos pendientes:", error);
    return { success: false, error: error.message };
  }
}

export async function obtenerHistorialPagos() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    const colegio_id = await getCurrentColegioId(supabase);

    let query = adminClient
      .from("pagos")
      .select("*, alumnos(apellido_y_nombre, cuil)")
      .in("estado", ["Aprobado", "Rechazado", "FACTURADO", "EN_PROCESO_AFIP", "ERROR_FACTURACION"])
      .order("fecha_pago", { ascending: false });

    if (colegio_id) {
      query = query.eq("colegio_id", colegio_id);
    }

    const { data: pagos, error } = await query;
    if (error) throw error;

    // Generar enlaces para los comprobantes
    const mappedPagos = (pagos || []).map((p: any) => {
      const link = p.comprobante_url
        ? `/api/comprobantes/ver?path=${encodeURIComponent(p.comprobante_url)}`
        : undefined;

      return {
        id: p.id,
        alumno_id: p.alumno_id,
        colegio_id: p.colegio_id,
        monto: Number(p.monto),
        fecha_pago: p.fecha_pago,
        estado: p.estado,
        observacion: p.observacion,
        comprobante_url: p.comprobante_url,
        created_at: p.created_at,
        alumno: p.alumnos ? {
          apellido_y_nombre: p.alumnos.apellido_y_nombre,
          cuil: p.alumnos.cuil,
        } : null,
        link,
        cae: p.cae || null,
        factura_url: p.factura_url || null,
      };
    });

    return { success: true, data: mappedPagos as Pago[] };
  } catch (error: any) {
    console.error("Error obteniendo historial de pagos:", error);
    return { success: false, error: error.message };
  }
}

export async function actualizarEstadoPago(
  idPago: string,
  nuevoEstado: "Pendiente" | "Aprobado" | "Rechazado",
  observacion: string
) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    const colegio_id = await getCurrentColegioId(supabase);

    // 1. Obtener estado actual del pago para la regla de negocio
    const { data: pagoExistente, error: getError } = await adminClient
      .from("pagos")
      .select("estado, colegio_id")
      .eq("id", idPago)
      .single();

    if (getError || !pagoExistente) {
      throw new Error("El pago solicitado no existe.");
    }

    // Seguridad: verificar permisos sobre el colegio si el usuario no es superadmin
    if (colegio_id && pagoExistente.colegio_id !== colegio_id) {
      throw new Error("No tienes autorización sobre esta institución.");
    }

    // Regla de Negocio Contable
    if (pagoExistente.estado === "FACTURADO") {
      throw new Error(
        "Operación Contable Denegada: No se puede modificar ni revertir un pago que ya ha sido facturado legalmente en la AFIP/ARCA."
      );
    }

    if (pagoExistente.estado === "EN_PROCESO_AFIP") {
      throw new Error(
        "Este pago está siendo procesado por AFIP. No se puede modificar hasta que se reciba el resultado."
      );
    }

    // 2. Ejecutar la actualización en la BD
    const { error: updateError } = await adminClient
      .from("pagos")
      .update({
        estado: nuevoEstado,
        observacion: observacion || null,
      })
      .eq("id", idPago);

    if (updateError) throw updateError;

    revalidatePath("/dashboard/cobranzas");
    return { success: true };
  } catch (error: any) {
    console.error("Error actualizando estado de pago:", error);
    return { success: false, error: error.message };
  }
}
