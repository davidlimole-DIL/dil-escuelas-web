import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { PDFDocument } from "pdf-lib";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const alumnoId = searchParams.get("alumnoId");

  if (!alumnoId) {
    return NextResponse.json({ error: "Falta el ID del alumno" }, { status: 400 });
  }

  // 1. Verificar autenticación del administrador
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verificar si tiene rol de administrador
  const { data: perfil } = await supabase
    .from("perfiles_admin")
    .select("rol, colegio_id")
    .eq("id", authData.user.id)
    .single();

  if (!perfil) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const adminClient = createAdminClient();

  // 2. Obtener datos del alumno
  const { data: alumno, error: alumnoError } = await adminClient
    .from("alumnos")
    .select("*, colegios(slots_legajo_default)")
    .eq("id", alumnoId)
    .single();

  if (alumnoError || !alumno) {
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  // Verificar restricción de colegio para staff
  const roles = Array.isArray(perfil.rol) ? perfil.rol : [perfil.rol];
  const isSuperadmin = roles.includes("superadmin");
  if (!isSuperadmin && perfil.colegio_id && perfil.colegio_id !== alumno.colegio_id) {
    return NextResponse.json({ error: "No autorizado para esta institución" }, { status: 403 });
  }

  // 3. Obtener slots configurados y archivos aprobados
  const slotsDefault = alumno.colegios?.slots_legajo_default || [];
  const { data: uploads } = await adminClient
    .from("legajos_digitales")
    .select("*")
    .eq("alumno_id", alumnoId)
    .eq("estado", "Aprobado");

  if (!uploads || uploads.length === 0) {
    return NextResponse.json({ error: "No hay documentos aprobados para este alumno" }, { status: 400 });
  }

  try {
    const mergedPdf = await PDFDocument.create();

    // Procesar cada slot en el orden establecido
    for (const slot of slotsDefault) {
      const upload = uploads.find(u => u.tipo_slot === slot.id);
      if (!upload || !upload.archivo_url) continue;

      // Descargar archivo del storage
      const { data: fileBlob, error: downloadError } = await adminClient.storage
        .from("comprobantes")
        .download(upload.archivo_url);

      if (downloadError || !fileBlob) {
        console.error(`Error descargando archivo para slot ${slot.id}:`, downloadError);
        continue;
      }

      const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
      const lowerUrl = upload.archivo_url.toLowerCase();

      if (lowerUrl.endsWith(".pdf")) {
        // Cargar y copiar páginas del PDF
        try {
          const srcPdf = await PDFDocument.load(fileBuffer);
          const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        } catch (pdfErr) {
          console.error(`Error procesando PDF del slot ${slot.id}:`, pdfErr);
        }
      } else if (
        lowerUrl.endsWith(".png") ||
        lowerUrl.endsWith(".jpg") ||
        lowerUrl.endsWith(".jpeg") ||
        lowerUrl.endsWith(".webp")
      ) {
        // Incrustar imagen en una nueva página
        try {
          const page = mergedPdf.addPage();
          const { width, height } = page.getSize();
          
          let img;
          if (lowerUrl.endsWith(".png")) {
            img = await mergedPdf.embedPng(fileBuffer);
          } else {
            // pdf-lib embedJpg supports standard JPEG
            img = await mergedPdf.embedJpg(fileBuffer);
          }

          const scaled = img.scaleToFit(width - 40, height - 40);
          page.drawImage(img, {
            x: (width - scaled.width) / 2,
            y: (height - scaled.height) / 2,
            width: scaled.width,
            height: scaled.height,
          });
        } catch (imgErr) {
          console.error(`Error procesando imagen del slot ${slot.id}:`, imgErr);
        }
      }
    }

    const mergedPdfBytes = await mergedPdf.save();

    // Formatear nombre de archivo: ApellidoyNombre_CUIL_Legajo.PDF
    // Quitar espacios y acentos del nombre
    const cleanName = alumno.apellido_y_nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "");

    const fileName = `${cleanName}_${alumno.cuil}_${alumno.id_alumno}.pdf`;

    return new Response(Buffer.from(mergedPdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error al fusionar documentos:", error);
    return NextResponse.json({ error: "Error al generar el PDF consolidado: " + error.message }, { status: 500 });
  }
}
