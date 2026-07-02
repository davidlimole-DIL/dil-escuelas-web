"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { verifyAlumnoToken } from "@/utils/jwt"

export async function obtenerMiPortal() {
  const store = await cookies();
  const token = store.get("alumno_session")?.value;
  if (!token) return { error: "No autorizado" };

  const payload = await verifyAlumnoToken(token);
  if (!payload) return { error: "Token inválido" };

  const { alumno_id, colegio_id, cuil } = payload as any;
  const adminClient = createAdminClient();

  // Obtener alumno
  const { data: alumno } = await adminClient
    .from('alumnos')
    .select('apellido_y_nombre, cuil')
    .eq('id', alumno_id)
    .single();

  // Obtener devengamientos
  const { data: devengamientos } = await adminClient
    .from('devengamientos')
    .select('*')
    .eq('alumno_id', alumno_id)
    .order('fecha_vencimiento', { ascending: false });

  // Obtener pagos
  const { data: pagos } = await adminClient
    .from('pagos')
    .select('*')
    .eq('alumno_id', alumno_id)
    .order('fecha_pago', { ascending: false });

  // Construir historial combinado
  const movimientos: any[] = [];
  let deuda = 0;

  devengamientos?.forEach(d => {
    movimientos.push({
      tipo: 'DEBE',
      fecha: new Date(d.fecha_vencimiento).toLocaleDateString('es-AR'),
      concepto: d.concepto,
      importe: Number(d.monto),
      estado: 'Aprobado',
      observacion: ''
    });
    deuda += Number(d.monto);
  });

  if (pagos && pagos.length > 0) {
    for (const p of pagos) {
      if (p.estado === 'Reemplazado') continue;
      let comprobanteUrl = '';
      
      if (p.estado === 'FACTURADO' && p.factura_url) {
        // Usar enlace directo de la factura fiscal oficial generada por el facturador
        comprobanteUrl = p.factura_url;
      } else if (p.comprobante_url) {
        // Usar el comprobante original subido por el alumno
        const { data: urlData } = await adminClient.storage
          .from('comprobantes')
          .createSignedUrl(p.comprobante_url, 3600); // 1 hora de validez
        comprobanteUrl = urlData?.signedUrl || '';
      }

      movimientos.push({
        id: p.id,
        tipo: 'HABER',
        fecha: new Date(p.fecha_pago).toLocaleDateString('es-AR'),
        concepto: p.observacion || 'Pago Registrado',
        importe: Number(p.monto),
        estado: p.estado,
        observacion: p.observacion,
        comprobanteUrl: comprobanteUrl
      });
      if (p.estado === 'Aprobado' || p.estado === 'FACTURADO') deuda -= Number(p.monto);
    }
  }

  // Ordenar movimientos por fecha para presentación
  movimientos.sort((a, b) => {
    const da = a.fecha.split('/').reverse().join('');
    const db = b.fecha.split('/').reverse().join('');
    return db.localeCompare(da); // Mas nuevos primero
  });

  // Obtener formato oficial de slots del colegio
  const { data: col } = await adminClient
    .from('colegios')
    .select('slots_legajo_default')
    .eq('id', colegio_id)
    .single();

  const slotsDefault = col?.slots_legajo_default || [];

  // Obtener legajos subidos por el alumno desde la tabla legajos_digitales
  const { data: uploads } = await adminClient
    .from('legajos_digitales')
    .select('*')
    .eq('alumno_id', alumno_id);

  // Mapear slots combinando la configuración por defecto y lo subido real usando URLs firmadas
  const legajos = [];
  if (slotsDefault && slotsDefault.length > 0) {
    for (const slot of slotsDefault) {
      const matchedUpload = uploads?.find((u: any) => u.tipo_slot === slot.id);
      
      let enlaceUrl = '';
      if (matchedUpload?.archivo_url) {
        const { data: urlData } = await adminClient.storage
          .from('comprobantes')
          .createSignedUrl(matchedUpload.archivo_url, 3600); // 1 hora de validez
        enlaceUrl = urlData?.signedUrl || '';
      }

      legajos.push({
        id: slot.id,
        nombre: slot.nombre,
        estado: matchedUpload ? matchedUpload.estado : 'Pendiente',
        enlace: matchedUpload ? matchedUpload.archivo_url : '',
        enlaceUrl: enlaceUrl,
        observaciones: matchedUpload ? matchedUpload.observaciones : ''
      });
    }
  }

  return {
    alumno_id,
    cuil,
    colegio_id,
    nombre: alumno?.apellido_y_nombre || 'Sin Nombre',
    saldo: deuda,
    movimientos,
    legajos
  };
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

export async function subirComprobante(monto: number, fecha: string, base64: string, name: string) {
  const store = await cookies();
  const payload = await verifyAlumnoToken(store.get("alumno_session")?.value || "");
  if (!payload) return { error: "Sesión expirada" };

  const adminClient = createAdminClient();
  const buffer = Buffer.from(base64, 'base64');

  // Validación de seguridad de tamaño en el servidor (Máximo 3MB)
  const MAX_SERVER_SIZE = 3 * 1024 * 1024;
  if (buffer.length > MAX_SERVER_SIZE) {
    return { error: "El archivo supera el límite de seguridad de 3MB en el servidor." };
  }

  const path = `${payload.colegio_id}/${payload.cuil}_${Date.now()}_${name}`;

  const { data, error } = await adminClient.storage
    .from('comprobantes')
    .upload(path, buffer, { contentType: getMimeType(name) });

  if (error) return { error: "Error subiendo archivo: " + error.message };

  // Registrar el pago
  const { error: dbErr } = await adminClient
    .from('pagos')
    .insert({
      alumno_id: payload.alumno_id,
      colegio_id: payload.colegio_id,
      monto,
      fecha_pago: fecha,
      estado: 'Pendiente',
      observacion: 'Recibo adjunto',
      comprobante_url: data.path
    });

  if (dbErr) return { error: "Error en DB: " + dbErr.message };

  // Archivar pagos rechazados anteriores
  await adminClient
    .from('pagos')
    .update({ estado: 'Reemplazado' })
    .eq('alumno_id', payload.alumno_id)
    .eq('estado', 'Rechazado');

  return { exito: true };
}

export async function subirDocumentoLegajo(slotId: string, base64: string, name: string) {
  const store = await cookies();
  const payload = await verifyAlumnoToken(store.get("alumno_session")?.value || "");
  if (!payload) return { error: "Sesión expirada" };

  const adminClient = createAdminClient();
  const buffer = Buffer.from(base64, 'base64');

  // Validación de seguridad de tamaño en el servidor (Máximo 3MB)
  const MAX_SERVER_SIZE = 3 * 1024 * 1024;
  if (buffer.length > MAX_SERVER_SIZE) {
    return { error: "El archivo supera el límite de seguridad de 3MB en el servidor." };
  }
  
  // Guardar en carpeta del colegio y alumno
  const extension = name.includes('.') ? name.split('.').pop() : 'pdf';
  const path = `${payload.colegio_id}/legajos/${payload.cuil}_${slotId}_${Date.now()}.${extension}`;

  const { data, error } = await adminClient.storage
    .from('comprobantes')
    .upload(path, buffer, { contentType: getMimeType(name) });

  if (error) return { error: "Error subiendo archivo: " + error.message };

  // Verificar si ya existe el registro en la tabla legajos_digitales
  const { data: existing } = await adminClient
    .from('legajos_digitales')
    .select('id')
    .eq('alumno_id', payload.alumno_id)
    .eq('tipo_slot', slotId)
    .maybeSingle();

  let dbErr;
  if (existing) {
    // Actualizar registro existente
    const { error } = await adminClient
      .from('legajos_digitales')
      .update({
        archivo_url: data.path,
        estado: 'En Revisión',
        observaciones: '' // Limpiar observaciones anteriores al re-subir
      })
      .eq('id', existing.id);
    dbErr = error;
  } else {
    // Insertar nuevo registro
    const { error } = await adminClient
      .from('legajos_digitales')
      .insert({
        colegio_id: payload.colegio_id,
        alumno_id: payload.alumno_id,
        tipo_slot: slotId,
        archivo_url: data.path,
        estado: 'En Revisión',
        observaciones: ''
      });
    dbErr = error;
  }

  if (dbErr) return { error: "Error actualizando el legajo en BD: " + dbErr.message };
  return { exito: true };
}

export async function eliminarPagoPendiente(idPago: string) {
  const store = await cookies();
  const payload = await verifyAlumnoToken(store.get("alumno_session")?.value || "");
  if (!payload) return { error: "Sesión expirada" };

  const adminClient = createAdminClient();

  // Verificar primero que el pago sea del alumno y esté en estado 'Pendiente'
  const { data: pago, error: checkErr } = await adminClient
    .from('pagos')
    .select('estado')
    .eq('id', idPago)
    .eq('alumno_id', payload.alumno_id)
    .single();

  if (checkErr || !pago) {
    return { error: "No se encontró el pago especificado o no tienes permisos." };
  }

  if (pago.estado !== 'Pendiente') {
    return { error: "Solo se pueden eliminar pagos en estado 'Pendiente'." };
  }

  // Proceder a la eliminación física en Supabase
  const { error: deleteErr } = await adminClient
    .from('pagos')
    .delete()
    .eq('id', idPago)
    .eq('alumno_id', payload.alumno_id);

  if (deleteErr) {
    return { error: "Error al eliminar de la base de datos: " + deleteErr.message };
  }

  return { exito: true };
}
