"use client"

import { useEffect, useState, useRef } from "react";
import { obtenerMiPortal, subirComprobante, subirDocumentoLegajo, eliminarPagoPendiente } from "./actions";

// Función de utilidad para comprimir imágenes usando canvas nativo en el cliente
function comprimirImagen(file: File): Promise<File> {
  return new Promise((resolve) => {
    // Si no es una imagen o es un GIF, retornar el original sin modificar
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;

        // Mantener la relación de aspecto si supera las dimensiones máximas
        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a JPEG con 75% de calidad
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            const nombreOriginalSinExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const nuevoArchivo = new File([blob], `${nombreOriginalSinExt}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(nuevoArchivo);
          },
          "image/jpeg",
          0.75
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

export default function PortalAlumno() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'finanzas' | 'legajo'>('finanzas');
  const [modalPago, setModalPago] = useState(false);
  const [modalLegajo, setModalLegajo] = useState(false);
  
  // Custom Alert Popups
  const [alertPopup, setAlertPopup] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);

  // Variables Pago
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Variables Legajo
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [selectedSlotName, setSelectedSlotName] = useState("");
  const [uploadingLegajo, setUploadingLegajo] = useState(false);
  const fileLegajoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const res = await obtenerMiPortal();
    if (!res.error) setData(res);
    setLoading(false);
  };

  const handleSubirPago = async () => {
    if (!monto || parseFloat(monto) <= 0 || !fecha || !fileRef.current?.files?.[0]) {
      return mostrarAlerta("Datos Incompletos", "Por favor completa todos los campos correctamente. El monto debe ser mayor a cero.", "error");
    }
    
    setUploading(true);
    let file = fileRef.current.files[0];

    // Comprimir si es una imagen
    if (file.type.startsWith("image/")) {
      try {
        file = await comprimirImagen(file);
      } catch (err) {
        console.error("Error al comprimir la imagen, procediendo con la original:", err);
      }
    }

    // Validar tamaño máximo de 2MB (2,097,152 bytes)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploading(false);
      return mostrarAlerta(
        "Archivo muy grande",
        `El archivo supera el límite permitido de 2MB (su tamaño actual es ${(file.size / (1024 * 1024)).toFixed(2)}MB). Por favor, suba un archivo más liviano.`,
        "error"
      );
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const res = await subirComprobante(parseFloat(monto), fecha, base64, file.name);
      setUploading(false);
      
      if (res.error) {
        mostrarAlerta("Error al Procesar", res.error, "error");
      } else {
        mostrarAlerta("¡Pago Informado!", "El comprobante fue subido correctamente y será validado por la institución a la brevedad.", "success");
        setModalPago(false);
        setMonto("");
        setFecha("");
        cargarDatos();
      }
    };
  };

  const handleEliminarPago = async (idPago: string) => {
    if (confirm("¿Estás seguro de que deseas cancelar y eliminar este informe de pago pendiente? Esta acción no se puede deshacer.")) {
      setLoading(true);
      const res = await eliminarPagoPendiente(idPago);
      setLoading(false);
      if (res.error) {
        mostrarAlerta("Error al Cancelar", res.error, "error");
      } else {
        mostrarAlerta("¡Cancelado!", "El informe de pago pendiente fue eliminado correctamente.", "success");
        cargarDatos();
      }
    }
  };

  const handleSubirLegajo = async () => {
    if (!fileLegajoRef.current?.files?.[0]) {
      return mostrarAlerta("Atención", "Debe seleccionar un archivo para subir.", "error");
    }

    setUploadingLegajo(true);
    let file = fileLegajoRef.current.files[0];

    // Comprimir si es una imagen
    if (file.type.startsWith("image/")) {
      try {
        file = await comprimirImagen(file);
      } catch (err) {
        console.error("Error al comprimir la imagen, procediendo con la original:", err);
      }
    }

    // Validar tamaño máximo de 2MB (2,097,152 bytes)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadingLegajo(false);
      return mostrarAlerta(
        "Archivo muy grande",
        `El archivo supera el límite permitido de 2MB (su tamaño actual es ${(file.size / (1024 * 1024)).toFixed(2)}MB). Por favor, suba un archivo más liviano.`,
        "error"
      );
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const res = await subirDocumentoLegajo(selectedSlotId, base64, file.name);
      setUploadingLegajo(false);

      if (res.error) {
        mostrarAlerta("Error al subir", res.error, "error");
      } else {
        mostrarAlerta("¡Documento Enviado!", "El archivo se ha subido correctamente y se encuentra 'En Revisión' para su validación.", "success");
        setModalLegajo(false);
        cargarDatos();
      }
    };
  };

  const abrirModalLegajo = (slotId: string, slotName: string) => {
    setSelectedSlotId(slotId);
    setSelectedSlotName(slotName);
    setModalLegajo(true);
  };

  const mostrarAlerta = (title: string, message: string, type: 'success' | 'error') => {
    setAlertPopup({ title, message, type });
  };

  if (loading) return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
      <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent mb-4"></div>
      <h2 className="text-xl font-bold text-slate-700">Sincronizando su cuenta corriente...</h2>
      <p className="text-sm text-slate-400 mt-2">Obteniendo estados financieros y legajo digital</p>
    </div>
  );

  if (!data) return (
    <div className="bg-rose-50 rounded-2xl border border-rose-200 p-8 text-center max-w-md mx-auto mt-10">
      <h2 className="text-xl font-bold text-rose-800 mb-2">No se encontró información</h2>
      <p className="text-rose-600 mb-6">Su registro no existe o ha sido desactivado.</p>
    </div>
  );

  return (
    <>
      {/* TABS DE NAVEGACIÓN */}
      <nav className="flex space-x-2 bg-slate-200/50 p-1 rounded-xl mb-6">
        <button onClick={() => setTab('finanzas')} className={`flex-1 font-bold py-2 px-4 rounded-lg text-sm transition-all text-center ${tab==='finanzas' ? 'bg-white shadow-sm text-indigo-900' : 'text-slate-500 hover:text-indigo-900'}`}>💸 Finanzas</button>
        <button onClick={() => setTab('legajo')} className={`flex-1 font-bold py-2 px-4 rounded-lg text-sm transition-all text-center ${tab==='legajo' ? 'bg-white shadow-sm text-indigo-900' : 'text-slate-500 hover:text-indigo-900'}`}>📁 Mi Legajo</button>
      </nav>

      {tab === 'finanzas' && (
        <div className="animate-in fade-in relative duration-300">
          {/* Tarjeta de Bienvenida y Saldo */}
          <div className="sticky top-0 z-20 pt-2 pb-4 bg-slate-50">
            <div className="bg-indigo-900 text-white rounded-2xl p-5 md:p-6 shadow-xl border border-indigo-800 flex flex-col justify-center items-center gap-3">
              <div className="text-center leading-none">
                <p className="text-indigo-200 text-sm mb-1">Bienvenido/a,</p>
                <h3 className="text-2xl md:text-3xl font-black tracking-tight uppercase">{data.nombre}</h3>
                <p className="text-xs text-indigo-300 font-mono mt-1.5">CUIL: {data.cuil}</p>
              </div>
              <div className="text-center w-full border-t border-indigo-800/50 pt-4 leading-none">
                <p className="text-indigo-200 text-sm font-medium mb-2">
                  {data.saldo > 0 ? (
                    <span>Total a Pagar al <span className="font-mono">{new Date().toLocaleDateString('es-AR')}</span></span>
                  ) : data.saldo < 0 ? (
                    <span>Saldo a Favor al <span className="font-mono">{new Date().toLocaleDateString('es-AR')}</span></span>
                  ) : (
                    <span>Cuenta al Día al <span className="font-mono">{new Date().toLocaleDateString('es-AR')}</span></span>
                  )}
                </p>
                <p className={`text-4xl md:text-5xl font-black drop-shadow-md tracking-tighter leading-none ${data.saldo > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  $ {Math.abs(data.saldo).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Tabla de Movimientos */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden mb-8 w-full relative">
            <div className="overflow-x-auto w-full scrollbar-thin">
              <div className="w-full min-w-[500px]">
                {/* Cabecera */}
                <div className="flex justify-between items-center p-3 sm:p-4 bg-slate-100 text-[11px] font-bold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
                  <div className="flex-1 pl-1">Detalle del Movimiento</div>
                  <div className="text-right w-[120px] sm:w-[150px]">Importe</div>
                  <div className="text-center w-[100px] sm:w-[130px] pr-1">Estado</div>
                </div>

                {/* Filas */}
                <div className="flex flex-col divide-y divide-slate-100">
                  {data.movimientos.length > 0 ? (
                    data.movimientos.map((m: any, i: number) => {
                      const isDebe = m.tipo === 'DEBE';
                      const colorMonto = isDebe ? 'text-slate-800' : 'text-emerald-600 font-bold drop-shadow-sm';
                      
                      let colorEstado = 'bg-slate-100 text-slate-600 border-slate-200';
                      if (m.estado === 'Validación' || m.estado === 'Pendiente') {
                        colorEstado = 'bg-amber-100 text-amber-800 border-amber-200';
                      } else if (m.estado === 'Rechazado') {
                        colorEstado = 'bg-rose-100 text-rose-800 border-rose-200';
                      } else if (m.estado === 'Aprobado' || m.estado === 'FACTURADO') {
                        colorEstado = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                      }

                      const filaBg = m.estado === 'Rechazado' ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50/70';

                      return (
                        <div key={i} className={`flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-50 transition-colors gap-2 ${filaBg}`}>
                           {/* Detalle */}
                           <div className="flex flex-col flex-1 min-w-0 pr-2">
                             <span className="text-[11px] font-semibold text-slate-400">{m.fecha}</span>
                             <span className="font-bold text-slate-700 text-[12px] sm:text-[13px] leading-tight mt-0.5 whitespace-normal break-words">{m.concepto}</span>
                             
                             {/* Motivo de rechazo de pago */}
                             {m.estado === 'Rechazado' && m.observacion && (
                               <span className="text-[10px] italic font-semibold text-rose-700 mt-1.5 px-2 py-0.5 rounded bg-rose-100/70 border-l-2 border-rose-500 w-fit flex items-center gap-1 shadow-sm">
                                 ⚠ Motivo: {m.observacion}
                               </span>
                             )}
                           </div>

                           {/* Importe */}
                           <div className="text-right w-[120px] sm:w-[150px] shrink-0 flex flex-col justify-center">
                             <span className={`text-[14px] md:text-[16px] font-black tracking-tight ${colorMonto}`}>
                               $ {m.importe.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </span>
                           </div>

                           {/* Estado y Botón PDF */}
                           <div className="flex flex-col items-center justify-center gap-1.5 w-[100px] sm:w-[130px] pl-1 sm:pl-2 shrink-0">
                             <span className={`border px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider text-center w-full ${colorEstado}`}>
                               {m.estado}
                             </span>
                             {m.estado === 'FACTURADO' && m.comprobanteUrl && (
                               <a 
                                 href={m.comprobanteUrl} 
                                 target="_blank" 
                                 rel="noopener noreferrer" 
                                 className="shrink-0 bg-white border border-slate-200 hover:border-teal-500 text-teal-700 hover:bg-teal-50 px-2 py-0.5 rounded-lg text-[9px] font-extrabold shadow-sm transition-all flex items-center gap-1"
                                 title="Descargar PDF Factura"
                               >
                                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                 PDF
                               </a>
                             )}
                             {m.estado === 'Rechazado' && (
                                <button 
                                  onClick={() => {
                                    setMonto(m.importe.toString());
                                    setModalPago(true);
                                  }} 
                                  className="shrink-0 bg-rose-600 hover:bg-rose-700 hover:shadow-rose-600/20 text-white px-2 py-0.5 rounded-lg text-[9px] font-extrabold shadow-sm transition-all flex items-center justify-center gap-1 w-full"
                                  title="Corregir pago"
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4"></path></svg>
                                  Corregir
                                </button>
                             )}
                             {m.tipo === 'HABER' && m.estado === 'Pendiente' && (
                                <button 
                                  onClick={() => handleEliminarPago(m.id)} 
                                  className="shrink-0 bg-rose-50 border border-rose-200 hover:border-rose-500 hover:bg-rose-100/50 text-rose-600 px-2 py-0.5 rounded-lg text-[9px] font-extrabold shadow-sm transition-all flex items-center justify-center gap-1 w-full"
                                  title="Eliminar pago pendiente"
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                  Cancelar
                                </button>
                             )}
                           </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-12 text-center text-slate-400 italic font-medium">No se registran movimientos en su estado de cuenta.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Botón Flotante/Sticky para Informar Pago */}
          <div className="fixed bottom-6 left-4 right-4 md:sticky md:bottom-6 z-40 flex justify-center mt-6 pointer-events-none">
            <button 
              onClick={() => setModalPago(true)} 
              className="pointer-events-auto w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 hover:shadow-emerald-500/40 text-white font-extrabold text-base md:text-md py-4 px-8 rounded-2xl md:rounded-full shadow-2xl transition-all active:scale-95 hover:scale-105 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
              Informar un Pago
            </button>
          </div>
        </div>
      )}

      {tab === 'legajo' && (
        <div className="animate-in fade-in relative mt-2 duration-300">
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 mb-8 overflow-hidden">
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-1">Documentación Requerida</h3>
            <p className="text-sm text-slate-500 mb-6">Complete su legajo digital subiendo los archivos obligatorios solicitados.</p>
            
            <div className="flex flex-col gap-3.5">
              {data.legajos.length > 0 ? (
                data.legajos.map((slot: any, i: number) => {
                  let bgColor = 'bg-slate-50 border-slate-200';
                  let icon = '⚪';
                  let colorTextoRef = 'text-slate-500';
                  let btnAction = null;

                  if (slot.estado === 'Pendiente') {
                    bgColor = 'bg-slate-50/80 border-slate-200/60 hover:bg-slate-50 transition-colors';
                    icon = '🔴';
                    colorTextoRef = 'text-slate-500';
                    btnAction = (
                      <button 
                        onClick={() => abrirModalLegajo(slot.id, slot.nombre)} 
                        className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-extrabold rounded-xl text-xs md:text-sm shadow-sm transition-all"
                      >
                        Subir
                      </button>
                    );
                  } else if (slot.estado === 'Aprobado') {
                    bgColor = 'bg-emerald-50/50 border-emerald-100';
                    icon = '🟢';
                    colorTextoRef = 'text-emerald-700';
                    btnAction = (
                      <div className="flex items-center gap-2">
                        {slot.enlaceUrl && (
                          <a href={slot.enlaceUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white hover:bg-slate-50 border rounded-lg text-slate-500 hover:text-slate-800 shadow-sm transition-all" title="Ver Documento">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </a>
                        )}
                        <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 font-black rounded-xl text-xs flex items-center justify-center shrink-0 border border-emerald-200 shadow-inner">✓ Aprobado</span>
                      </div>
                    );
                  } else if (slot.estado === 'En Revisión') {
                    bgColor = 'bg-amber-50/50 border-amber-100';
                    icon = '🟡';
                    colorTextoRef = 'text-amber-700 font-bold';
                    btnAction = (
                      <div className="flex items-center gap-2">
                        {slot.enlaceUrl && (
                          <a href={slot.enlaceUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white hover:bg-slate-50 border rounded-lg text-slate-500 hover:text-slate-800 shadow-sm transition-all" title="Ver Documento">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </a>
                        )}
                        <span className="px-3.5 py-1.5 bg-amber-100 text-amber-800 font-black rounded-xl text-xs flex items-center justify-center shrink-0 border border-amber-200 shadow-inner">⏳ Validando</span>
                      </div>
                    );
                  } else if (slot.estado === 'Rechazado') {
                    bgColor = 'bg-rose-50/50 border-rose-200';
                    icon = '🟠';
                    colorTextoRef = 'text-rose-700 font-bold';
                    btnAction = (
                      <button 
                        onClick={() => abrirModalLegajo(slot.id, slot.nombre)} 
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs md:text-sm shadow-sm transition-all"
                      >
                        Re-subir
                      </button>
                    );
                  }

                  return (
                    <div key={i} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-2xl gap-3 shadow-sm ${bgColor}`}>
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="text-xl mt-0.5 sm:mt-0 select-none">{icon}</div>
                        <div>
                          <p className="font-extrabold text-slate-800 text-[14px] md:text-[15px]">{slot.nombre}</p>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${colorTextoRef}`}>{slot.estado}</p>
                          
                          {/* Observación de Rechazo del legajo */}
                          {slot.estado === 'Rechazado' && slot.observaciones && (
                            <p className="text-xs font-semibold text-rose-700 mt-2 px-2.5 py-1 rounded bg-rose-100 border-l-2 border-rose-500 w-fit leading-tight shadow-sm">
                              <span className="block text-[9px] text-rose-500 uppercase tracking-wider mb-0.5 font-bold">Motivo del Rechazo:</span>
                              {slot.observaciones}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex sm:justify-end self-end sm:self-auto">{btnAction}</div>
                    </div>
                  );
                })
              ) : (
                <div className="p-10 text-center text-slate-400 italic">No hay documentos parametrizados en su legajo.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL INFORMAR PAGO */}
      {modalPago && (
        <div className="fixed inset-0 bg-slate-900/60 flex justify-center items-end md:items-center z-50 backdrop-blur-sm p-2 sm:p-0 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl md:rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative animate-in slide-in-from-bottom-5 duration-300">
             <button onClick={() => setModalPago(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
             </button>
             <h3 className="text-xl font-extrabold mb-6 text-indigo-900">Informar Nuevo Pago</h3>
             <div className="space-y-4">
               <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs uppercase tracking-wider">Monto ($) *</label>
                  <input 
                    type="number" 
                    min="0.01" 
                    step="0.01" 
                    value={monto} 
                    onChange={e=>setMonto(e.target.value)} 
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800" 
                  />
               </div>
               <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs uppercase tracking-wider">Fecha Depósito/Transferencia *</label>
                  <input 
                    type="date" 
                    value={fecha} 
                    onChange={e=>setFecha(e.target.value)} 
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800" 
                  />
               </div>
               <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs uppercase tracking-wider">Comprobante (Foto o PDF) *</label>
                  <input 
                    type="file" 
                    ref={fileRef} 
                    accept="image/*,.pdf" 
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-slate-200 rounded-xl p-1" 
                  />
               </div>
               <button 
                 onClick={handleSubirPago} 
                 disabled={uploading} 
                 className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all mt-6 disabled:opacity-50 flex items-center justify-center gap-2"
               >
                  {uploading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Procesando recibo...
                    </>
                  ) : "Subir Comprobante"}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL SUBIR DOCUMENTO LEGAJO */}
      {modalLegajo && (
        <div className="fixed inset-0 bg-slate-900/60 flex justify-center items-end md:items-center z-50 backdrop-blur-sm p-2 sm:p-0 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl md:rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative animate-in slide-in-from-bottom-5 duration-300">
             <button onClick={() => setModalLegajo(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
             </button>
             <h3 className="text-xl font-extrabold text-indigo-900 mb-1">Subir Documentación</h3>
             <p className="text-sm text-slate-500 font-extrabold mb-6 uppercase tracking-wider text-indigo-600">{selectedSlotName}</p>
             
             <div className="space-y-4">
               <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs uppercase tracking-wider">Selecciona tu archivo (Foto o PDF) *</label>
                  <input 
                    type="file" 
                    ref={fileLegajoRef} 
                    accept="image/*,.pdf" 
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-slate-200 rounded-xl p-1" 
                  />
               </div>
               <button 
                 onClick={handleSubirLegajo} 
                 disabled={uploadingLegajo} 
                 className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all mt-6 disabled:opacity-50 flex items-center justify-center gap-2"
               >
                  {uploadingLegajo ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Subiendo archivo...
                    </>
                  ) : "Subir Documento"}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL ALERT/POPUP (PREMIUM UX) */}
      {alertPopup && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex justify-center items-center backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all text-center animate-in scale-in duration-300 border border-slate-100">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border ${alertPopup.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
              {alertPopup.type === 'success' ? (
                <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
              ) : (
                <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              )}
            </div>
            <h3 className={`text-lg font-black mb-1.5 ${alertPopup.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
              {alertPopup.title}
            </h3>
            <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
              {alertPopup.message}
            </p>
            <button 
              onClick={() => setAlertPopup(null)} 
              className={`w-full py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-all active:scale-[0.98] ${alertPopup.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-800 hover:bg-slate-900'}`}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
