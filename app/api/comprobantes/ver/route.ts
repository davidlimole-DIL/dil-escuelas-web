import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Falta la ruta del comprobante" }, { status: 400 });
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

  // 2. Descargar archivo del storage
  const adminClient = createAdminClient();
  const { data: fileBlob, error: downloadError } = await adminClient.storage
    .from("comprobantes")
    .download(path);

  if (downloadError || !fileBlob) {
    console.error("Error descargando comprobante:", downloadError);
    return NextResponse.json({ error: "No se pudo descargar el comprobante" }, { status: 404 });
  }

  const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
  const contentType = getMimeType(path);

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
