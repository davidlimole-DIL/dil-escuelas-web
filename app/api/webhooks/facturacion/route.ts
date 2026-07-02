import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

// ============================================================================
// POST /api/webhooks/facturacion?secret=FACTURADOR_WEBHOOK_SECRET
//
// Endpoint público que recibe callbacks del Facturador ARCA con el resultado
// de la emisión de comprobantes (éxito o fallo). Debe responder rápido (200).
// ============================================================================

type WebhookPayload = {
  id_operacion_origen: string;
  estado: "SUCCESS" | "FAILED";
  cuit_cliente: number | null;
  cae: string | null;
  vencimiento_cae: string | null;
  nro_comprobante: number | null;
  tipo_comprobante: number | null;
  punto_venta: number | null;
  url_pdf_segura: string | null;
  error_detalle: string | null;
};

export async function POST(req: NextRequest) {
  try {
    // 1. Validar secreto en query string
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");
    const expectedSecret = process.env.FACTURADOR_WEBHOOK_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      console.error("[Webhook Facturación] Secret inválido o ausente.");
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // 2. Parsear payload
    const payload: WebhookPayload = await req.json();

    if (!payload.id_operacion_origen || !payload.estado) {
      console.error("[Webhook Facturación] Payload incompleto:", payload);
      return NextResponse.json(
        { error: "Payload incompleto: faltan id_operacion_origen o estado" },
        { status: 400 }
      );
    }

    // 3. Extraer ID del pago del patrón "PAGO-{uuid}"
    const prefix = "PAGO-";
    if (!payload.id_operacion_origen.startsWith(prefix)) {
      console.error(
        "[Webhook Facturación] id_operacion_origen no reconocido:",
        payload.id_operacion_origen
      );
      return NextResponse.json(
        { error: "id_operacion_origen no corresponde a esta aplicación" },
        { status: 400 }
      );
    }

    const idPago = payload.id_operacion_origen.substring(prefix.length);
    const adminClient = createAdminClient();

    // 4. Verificar que el pago existe y está en estado de procesamiento
    const { data: pago, error: pagoError } = await adminClient
      .from("pagos")
      .select("id, estado")
      .eq("id", idPago)
      .single();

    if (pagoError || !pago) {
      console.error(
        "[Webhook Facturación] Pago no encontrado para id:",
        idPago,
        pagoError
      );
      // Respondemos 200 para que el Facturador no reintente innecesariamente
      return NextResponse.json({ ok: true, warning: "Pago no encontrado" });
    }

    if (pago.estado === "FACTURADO") {
      console.warn(
        `[Webhook Facturación] Pago ${idPago} ya está FACTURADO. Ignorando reintento.`
      );
      return NextResponse.json({ ok: true, warning: "Estado ya procesado (FACTURADO)" });
    }

    // 5. Procesar según resultado
    if (payload.estado === "SUCCESS") {
      const { error: updateError } = await adminClient
        .from("pagos")
        .update({
          estado: "FACTURADO",
          cae: payload.cae,
          factura_url: payload.url_pdf_segura,
          nro_comprobante: payload.nro_comprobante,
          tipo_comprobante: payload.tipo_comprobante,
          punto_venta: payload.punto_venta,
          vencimiento_cae: payload.vencimiento_cae,
          error_detalle: null,
        })
        .eq("id", idPago);

      if (updateError) {
        console.error(
          "[Webhook Facturación] Error actualizando pago a FACTURADO:",
          updateError
        );
        return NextResponse.json(
          { error: "Error interno al actualizar el pago" },
          { status: 500 }
        );
      }

      console.log(
        `[Webhook Facturación] ✅ Pago ${idPago} facturado exitosamente. CAE: ${payload.cae}, Comprobante: ${payload.punto_venta}-${payload.nro_comprobante}`
      );
    } else {
      const { error: updateError } = await adminClient
        .from("pagos")
        .update({
          estado: "ERROR_FACTURACION",
          error_detalle: payload.error_detalle || `Error reportado por facturador. Estado: ${payload.estado}`,
        })
        .eq("id", idPago);

      if (updateError) {
        console.error(
          "[Webhook Facturación] Error actualizando pago a ERROR_FACTURACION:",
          updateError
        );
        return NextResponse.json(
          { error: "Error interno al actualizar el pago" },
          { status: 500 }
        );
      }

      console.log(
        `[Webhook Facturación] ❌ Pago ${idPago} falló. Detalle: ${payload.error_detalle}`
      );
    }

    // 6. Respuesta rápida 200 OK
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[Webhook Facturación] Error inesperado:", message);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
