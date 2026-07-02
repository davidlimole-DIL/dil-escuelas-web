"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export type PagoFacturacion = {
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
    domicilio: string | null;
  } | null;
  link?: string; // Enlace firmado de comprobante original
  cae?: string | null;
  factura_url?: string | null;
  cuit_emisor?: string | null;
  factura_nro?: string | null;
  nro_comprobante?: number | null;
  tipo_comprobante?: number | null;
  punto_venta?: number | null;
  vencimiento_cae?: string | null;
  error_detalle?: string | null;
};

// Verifica si el usuario actual tiene el rol 'facturacion' o 'superadmin'
async function verificarPermisosFacturacion(supabase: any) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("No autenticado");

  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles_admin")
    .select("rol, colegio_id")
    .eq("id", authData.user.id)
    .single();

  if (perfilError || !perfil) throw new Error("Perfil de usuario no encontrado");

  let roles: string[] = [];
  if (Array.isArray(perfil.rol)) {
    roles = perfil.rol;
  } else if (typeof perfil.rol === "string") {
    if (perfil.rol.startsWith("{") && perfil.rol.endsWith("}")) {
      roles = perfil.rol
        .slice(1, -1)
        .split(",")
        .map((r: string) => r.trim().replace(/"/g, ""));
    } else {
      roles = [perfil.rol.replace(/"/g, "")];
    }
  }
  roles = roles.filter(Boolean);

  const isSuperadmin = roles.includes("superadmin");
  const isFacturador = roles.includes("facturacion");

  if (!isSuperadmin && !isFacturador) {
    throw new Error("No autorizado. Se requiere el rol de Facturación.");
  }

  return {
    colegio_id: perfil.colegio_id, // Puede ser null para superadmin
    isSuperadmin,
  };
}

// Obtiene los pagos que han sido Aprobados por cobranzas y están listos para facturar,
// incluyendo los que están en proceso o con error para monitoreo.
export async function obtenerPagosParaFacturar() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    const { colegio_id } = await verificarPermisosFacturacion(supabase);

    let query = adminClient
      .from("pagos")
      .select("*, alumnos(apellido_y_nombre, cuil, domicilio)")
      .in("estado", ["Aprobado", "EN_PROCESO_AFIP", "ERROR_FACTURACION"])
      .order("fecha_pago", { ascending: true });

    if (colegio_id) {
      query = query.eq("colegio_id", colegio_id);
    }

    const { data: pagos, error } = await query;
    if (error) throw error;

    // Generar enlaces para previsualizar los comprobantes originales subidos por el alumno
    const mappedPagos = await Promise.all(
      (pagos || []).map(async (p: any) => {
        let link = undefined;
        if (p.comprobante_url) {
          const { data: urlData } = await adminClient.storage
            .from("comprobantes")
            .createSignedUrl(p.comprobante_url, 3600); // Válido por 1 hora
          link = urlData?.signedUrl;
        }

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
          alumno: p.alumnos
            ? {
                apellido_y_nombre: p.alumnos.apellido_y_nombre,
                cuil: p.alumnos.cuil,
                domicilio: p.alumnos.domicilio,
              }
            : null,
          link,
          cae: p.cae,
          factura_url: p.factura_url,
          nro_comprobante: p.nro_comprobante,
          tipo_comprobante: p.tipo_comprobante,
          punto_venta: p.punto_venta,
          vencimiento_cae: p.vencimiento_cae,
          error_detalle: p.error_detalle,
        };
      })
    );

    return { success: true, data: mappedPagos as PagoFacturacion[] };
  } catch (error: any) {
    console.error("Error obteniendo pagos para facturar:", error);
    return { success: false, error: error.message };
  }
}

// Obtiene el historial de pagos que ya han sido Facturados
export async function obtenerFacturasEmitidas() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    const { colegio_id } = await verificarPermisosFacturacion(supabase);

    let query = adminClient
      .from("pagos")
      .select("*, alumnos(apellido_y_nombre, cuil, domicilio)")
      .eq("estado", "FACTURADO")
      .order("fecha_pago", { ascending: false });

    if (colegio_id) {
      query = query.eq("colegio_id", colegio_id);
    }

    const { data: pagos, error } = await query;
    if (error) throw error;

    const mappedPagos = (pagos || []).map((p: any) => {
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
        alumno: p.alumnos
          ? {
              apellido_y_nombre: p.alumnos.apellido_y_nombre,
              cuil: p.alumnos.cuil,
              domicilio: p.alumnos.domicilio,
            }
          : null,
        cae: p.cae,
        factura_url: p.factura_url,
        cuit_emisor: p.cuit_emisor,
        factura_nro: p.factura_nro,
        nro_comprobante: p.nro_comprobante,
        tipo_comprobante: p.tipo_comprobante,
        punto_venta: p.punto_venta,
        vencimiento_cae: p.vencimiento_cae,
      };
    });

    return { success: true, data: mappedPagos as PagoFacturacion[] };
  } catch (error: any) {
    console.error("Error obteniendo historial de facturas:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Solicita la emisión de factura enviando un POST HTTP al Facturador ARCA.
// Modelo "fire-and-forget": envía la solicitud y marca el pago como
// EN_PROCESO_AFIP. El resultado llegará asíncronamente vía webhook.
// ============================================================================
export async function facturarPago(idPago: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    // 1. Validar roles del operador
    const { colegio_id } = await verificarPermisosFacturacion(supabase);

    // 2. Obtener datos del pago
    const { data: pago, error: pagoError } = await adminClient
      .from("pagos")
      .select("*")
      .eq("id", idPago)
      .single();

    if (pagoError || !pago) {
      throw new Error("El pago solicitado no existe.");
    }

    // Seguridad: verificar pertenencia de colegio
    if (colegio_id && pago.colegio_id !== colegio_id) {
      throw new Error("No posees autorización sobre la institución del pago.");
    }

    // Validar estado del pago para facturar
    if (pago.estado === "FACTURADO") {
      throw new Error("Este cobro ya ha sido facturado anteriormente.");
    }

    if (pago.estado === "EN_PROCESO_AFIP") {
      throw new Error("Este cobro ya está siendo procesado por AFIP. Esperá el resultado.");
    }

    if (pago.estado !== "Aprobado" && pago.estado !== "ERROR_FACTURACION") {
      throw new Error("Solo se pueden facturar cobros en estado 'Aprobado' o con error previo.");
    }

    // 3. Obtener Configuración ARCA y CUIT de la institución
    const { data: colegio, error: colError } = await adminClient
      .from("colegios")
      .select("nombre, cuit, arca_habilitado, arca_api_key, arca_punto_venta, arca_concepto")
      .eq("id", pago.colegio_id)
      .single();

    if (colError || !colegio) {
      throw new Error("No se pudo obtener la información de la institución.");
    }

    if (!colegio.arca_habilitado) {
      throw new Error(`La institución '${colegio.nombre}' no tiene habilitada la facturación por ARCA.`);
    }

    if (!colegio.cuit) {
      throw new Error(`La institución '${colegio.nombre}' no tiene un CUIT configurado para facturación fiscal.`);
    }

    if (!colegio.arca_api_key) {
      throw new Error(`La institución '${colegio.nombre}' no tiene configurada la API Key de ARCA.`);
    }

    // 4. Obtener datos del Alumno/Tutor
    const { data: alumno, error: aluError } = await adminClient
      .from("alumnos")
      .select("apellido_y_nombre, cuil, domicilio")
      .eq("id", pago.alumno_id)
      .single();

    if (aluError || !alumno || !alumno.cuil) {
      throw new Error("No se pudo obtener la información tributaria/identidad del alumno.");
    }

    // 5. Configurar datos del cliente (tipo_doc y nro_doc a partir de CUIL/DNI)
    const rawDoc = (alumno.cuil || "").replace(/\D/g, "");
    let tipo_doc: number;
    let nro_doc: number;

    if (rawDoc.length === 11) {
      // CUIL/CUIT de 11 dígitos → tipo_doc 80, enviar el número completo
      tipo_doc = 80;
      nro_doc = parseInt(rawDoc, 10);
    } else {
      // DNI u otro documento → tipo_doc 96
      tipo_doc = 96;
      nro_doc = parseInt(rawDoc, 10) || 0;
    }

    const datosCliente = {
      tipo_doc,
      nro_doc,
      razon_social: alumno.apellido_y_nombre,
      condicion_iva: "Consumidor Final",
    };

    // 6. Configurar datos de la operación
    const montoTotal = Number(pago.monto);
    const datosOperacion = {
      concepto: colegio.arca_concepto || 2, // 1-Bienes, 2-Servicios, 3-Ambos
      intencion: "RECIBO",
      importes: {
        neto: montoTotal, // Backup por bug de validación en DIL-Facturador
        neto_gravado: montoTotal,
        exento: 0.0,
        iva: 0.0,
        tributos: 0.0,
        total: montoTotal, // total === neto_gravado + exento + iva + tributos
      },
      lineas_detalle: [
        {
          descripcion: `Pago de Cuota/Servicio educativo - ${colegio.nombre}`,
          cantidad: 1,
          precio_unitario: montoTotal,
          importe_item: montoTotal,
        }
      ]
    };

    const idOperacionOrigen = `PAGO-${pago.id}`;

    // 7. Marcar estado como EN_PROCESO_AFIP antes de enviar
    const { error: preUpdateError } = await adminClient
      .from("pagos")
      .update({ estado: "EN_PROCESO_AFIP", error_detalle: null })
      .eq("id", pago.id);

    if (preUpdateError) {
      throw new Error(`Error de base de datos (Check Constraint): ${preUpdateError.message}`);
    }

    revalidatePath("/dashboard/facturacion");

    // 8. Enviar POST al Facturador ARCA (fire-and-forget)
    const facturadorUrl = process.env.FACTURADOR_ARCA_URL;
    const facturadorApiKey = colegio.arca_api_key;

    if (!facturadorUrl || !facturadorApiKey) {
      // Revertir estado si las variables no están configuradas
      await adminClient
        .from("pagos")
        .update({ estado: "Aprobado" })
        .eq("id", pago.id);
      revalidatePath("/dashboard/facturacion");
      throw new Error("URL del Facturador ARCA no configurada o API Key de la institución faltante.");
    }

    const cuitEmisorNumerico = parseInt(colegio.cuit.replace(/\D/g, ""), 10);

    const payload: any = {
      id_operacion_origen: idOperacionOrigen,
      cuit_emisor: cuitEmisorNumerico,
      datos_cliente: datosCliente,
      datos_operacion: datosOperacion,
    };

    if (colegio.arca_punto_venta) {
      payload.punto_venta = colegio.arca_punto_venta;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout

    let response;
    try {
      response = await fetch(facturadorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": facturadorApiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err: any) {
      // Revertir a Aprobado para que se pueda reintentar
      await adminClient
        .from("pagos")
        .update({
          estado: "Aprobado",
          error_detalle: `Error de red o Timeout conectando al Facturador: ${err.message}`,
        })
        .eq("id", pago.id);
      revalidatePath("/dashboard/facturacion");
      throw new Error(`No se pudo conectar al Facturador ARCA: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      // La API del Facturador rechazó la solicitud
      let errorBody: any = "";
      try {
        const errJson = await response.json();
        errorBody = errJson.detail || errJson.message || errJson;
      } catch {
        errorBody = await response.text().catch(() => `HTTP ${response.status}`);
      }

      const errorStr = typeof errorBody === "string" ? errorBody : JSON.stringify(errorBody);

      // Revertir a Aprobado para que se pueda reintentar
      await adminClient
        .from("pagos")
        .update({
          estado: "Aprobado",
          error_detalle: `Rechazo del Facturador (HTTP ${response.status}): ${errorStr.substring(0, 200)}`,
        })
        .eq("id", pago.id);

      revalidatePath("/dashboard/facturacion");
      throw new Error(`El Facturador ARCA rechazó la solicitud (HTTP ${response.status}): ${errorStr}`);
    }

    // Solicitud aceptada — el resultado llegará vía webhook
    revalidatePath("/dashboard/facturacion");
    return {
      success: true,
      message: "Solicitud de facturación enviada correctamente. El resultado se actualizará automáticamente cuando AFIP responda.",
    };
  } catch (error: any) {
    console.error("Error en Server Action facturarPago:", error);
    return { success: false, error: error.message };
  }
}

// Permite reintentar la facturación de un pago que falló
export async function reintentarFacturacion(idPago: string) {
  const adminClient = createAdminClient();

  // Resetear estado a Aprobado para que pueda ser refacturado
  const { data: pago, error } = await adminClient
    .from("pagos")
    .select("estado")
    .eq("id", idPago)
    .single();

  if (error || !pago) {
    return { success: false, error: "Pago no encontrado" };
  }

  if (pago.estado !== "ERROR_FACTURACION") {
    return { success: false, error: "Solo se pueden reintentar pagos con error de facturación." };
  }

  await adminClient
    .from("pagos")
    .update({ estado: "Aprobado", error_detalle: null })
    .eq("id", idPago);

  revalidatePath("/dashboard/facturacion");

  // Ahora facturar directamente
  return facturarPago(idPago);
}

// ============================================================================
// Emisión de múltiples facturas (Lote / Batch)
// ============================================================================
export async function facturarPagosLote(ids: string[]) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  try {
    if (!ids || ids.length === 0) return { success: true, message: "No hay pagos seleccionados." };

    const { colegio_id } = await verificarPermisosFacturacion(supabase);

    const { data: pagos, error: pagosError } = await adminClient
      .from("pagos")
      .select("*, alumnos(apellido_y_nombre, cuil)")
      .in("id", ids);

    if (pagosError || !pagos || pagos.length === 0) {
      throw new Error("No se encontraron los pagos solicitados.");
    }

    if (colegio_id && pagos.some((p: any) => p.colegio_id !== colegio_id)) {
      throw new Error("Algunos pagos no pertenecen a tu institución.");
    }

    const pagosValidos = pagos.filter((p: any) => p.estado === "Aprobado" || p.estado === "ERROR_FACTURACION");
    if (pagosValidos.length === 0) {
      throw new Error("Ninguno de los pagos seleccionados está en estado válido para facturar.");
    }

    const colegiosSet = new Set(pagosValidos.map((p: any) => p.colegio_id));
    if (colegiosSet.size > 1) {
      throw new Error("No se pueden facturar pagos de múltiples instituciones en un solo lote.");
    }

    const colegioIdLote = Array.from(colegiosSet)[0];
    const { data: colegio, error: colError } = await adminClient
      .from("colegios")
      .select("nombre, cuit, arca_habilitado, arca_api_key, arca_punto_venta, arca_concepto")
      .eq("id", colegioIdLote)
      .single();

    if (colError || !colegio || !colegio.arca_habilitado || !colegio.cuit || !colegio.arca_api_key) {
      throw new Error("La institución no está correctamente configurada para ARCA.");
    }

    const comprobantes = pagosValidos.map((pago: any) => {
      const alumno = pago.alumnos as any;
      const rawDoc = (alumno?.cuil || "").replace(/\D/g, "");
      let tipo_doc = 96;
      let nro_doc = parseInt(rawDoc, 10) || 0;
      if (rawDoc.length === 11) {
        tipo_doc = 80;
        nro_doc = parseInt(rawDoc, 10);
      }
      
      const montoTotal = Number(pago.monto);
      const obj: any = {
        id_operacion_origen: `PAGO-${pago.id}`,
        cuit_emisor: parseInt(colegio.cuit.replace(/\D/g, ""), 10),
        datos_cliente: {
          tipo_doc,
          nro_doc,
          razon_social: alumno?.apellido_y_nombre || "Consumidor Final",
          condicion_iva: "Consumidor Final",
        },
        datos_operacion: {
          concepto: colegio.arca_concepto || 2,
          intencion: "RECIBO",
          importes: {
            neto: montoTotal,
            neto_gravado: montoTotal,
            exento: 0.0,
            iva: 0.0,
            tributos: 0.0,
            total: montoTotal,
          },
          lineas_detalle: [
            {
              descripcion: `Pago de Cuota/Servicio educativo - ${colegio.nombre}`,
              cantidad: 1,
              precio_unitario: montoTotal,
              importe_item: montoTotal,
            }
          ]
        }
      };
      if (colegio.arca_punto_venta) obj.punto_venta = colegio.arca_punto_venta;
      return obj;
    });

    const validIds = pagosValidos.map((p: any) => p.id);
    const { error: preUpdateError } = await adminClient
      .from("pagos")
      .update({ estado: "EN_PROCESO_AFIP", error_detalle: null })
      .in("id", validIds);

    if (preUpdateError) {
      throw new Error(`Error BD al marcar lote: ${preUpdateError.message}`);
    }

    const facturadorUrl = process.env.FACTURADOR_ARCA_URL || "";
    const loteUrl = facturadorUrl.replace(/\/+$/, "") + "/lote";

    const payload = { comprobantes };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(loteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": colegio.arca_api_key },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (err: any) {
      await adminClient.from("pagos").update({ estado: "Aprobado", error_detalle: "Timeout lote: " + err.message }).in("id", validIds);
      revalidatePath("/dashboard/facturacion");
      throw new Error(`No se pudo conectar al Facturador para el lote: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorBody: any = "";
      try {
        const errJson = await response.json();
        errorBody = errJson.detail || errJson.message || errJson;
      } catch {
        errorBody = await response.text().catch(() => `HTTP ${response.status}`);
      }
      const errorStr = typeof errorBody === "string" ? errorBody : JSON.stringify(errorBody);

      await adminClient.from("pagos").update({ estado: "Aprobado", error_detalle: `Rechazo lote (HTTP ${response.status}): ${errorStr.substring(0, 200)}` }).in("id", validIds);
      revalidatePath("/dashboard/facturacion");
      throw new Error(`Facturador ARCA rechazó el lote: ${errorStr}`);
    }

    revalidatePath("/dashboard/facturacion");
    return { success: true, message: `Lote de ${validIds.length} comprobantes enviado a AFIP.` };
  } catch (error: any) {
    console.error("Error lote:", error);
    return { success: false, error: error.message };
  }
}
