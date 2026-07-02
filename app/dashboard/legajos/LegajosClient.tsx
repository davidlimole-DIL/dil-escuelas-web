"use client";

import { useState, useRef, useEffect } from "react";
import { 
  type Alumno, 
  crearAlumnoManual, 
  importarAlumnosMasivos, 
  editarAlumno, 
  eliminarAlumno,
  evaluarDocumentoLegajo,
  obtenerUrlFirmadaDocumento,
  guardarSlotsLegajoDefault
} from "./actions";
import Papa from "papaparse";
import { useRouter } from "next/navigation";

type LegajosClientProps = {
  initialAlumnos: (Alumno & { colegio_nombre?: string | null })[];
  carrerasDisponibles: any[];
  isSuperadmin?: boolean;
  isGlobalMode?: boolean;
  initialSlotsDefault?: { id: string, nombre: string }[];
  colegioId?: string | null;
};

export default function LegajosClient({ 
  initialAlumnos, 
  carrerasDisponibles, 
  isSuperadmin = false, 
  isGlobalMode = false,
  initialSlotsDefault = [],
  colegioId = null
}: LegajosClientProps) {
  const router = useRouter();
  const [alumnos, setAlumnos] = useState<(Alumno & { colegio_nombre?: string | null })[]>(initialAlumnos);
  const [searchTerm, setSearchTerm] = useState("");
  
  useEffect(() => {
    setAlumnos(initialAlumnos);
  }, [initialAlumnos]);

  // Slots management states
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [slotsList, setSlotsList] = useState<{ id: string, nombre: string }[]>(initialSlotsDefault);
  const [newSlotName, setNewSlotName] = useState("");
  const [savingSlots, setSavingSlots] = useState(false);

  useEffect(() => {
    setSlotsList(initialSlotsDefault);
  }, [initialSlotsDefault]);
  
  // Modal states
  const [showManualModal, setShowManualModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAlumno, setSelectedAlumno] = useState<(Alumno & { colegio_nombre?: string | null }) | null>(null);

  // Review Modal States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAlumno, setReviewAlumno] = useState<Alumno | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [evaluating, setEvaluating] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Manual Form State
  const [manualForm, setManualForm] = useState<Partial<Alumno>>({
    cuil: "", apellido_y_nombre: "", email: "", telefono: "", domicilio: "",
    carrera_id: "", ano_ingreso: new Date().getFullYear(), mes_ingreso: new Date().getMonth() + 1, estado_academico: "Activo"
  });

  // Import State
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [importStep, setImportStep] = useState(1);
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredAlumnos = alumnos.filter(a => {
    const term = searchTerm.toLowerCase();
    return (a.apellido_y_nombre?.toLowerCase().includes(term)) || (a.cuil?.includes(term)) || (a.id_alumno?.includes(term));
  });

  const totales = alumnos.length;
  const activos = alumnos.filter(a => a.estado_academico === "Activo").length;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.cuil || !manualForm.apellido_y_nombre || !manualForm.ano_ingreso || !manualForm.carrera_id) {
      showToast("Por favor completa los campos obligatorios: CUIL, Nombre, Año y Carrera", "error");
      return;
    }
    setIsSubmitting(true);
    const res = await crearAlumnoManual(manualForm);
    setIsSubmitting(false);

    if (res.success) {
      showToast("Alumno guardado exitosamente");
      setShowManualModal(false);
      window.location.reload();
    } else {
      showToast(res.error || "Error al guardar el alumno", "error");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlumno) return;
    setIsSubmitting(true);
    const res = await editarAlumno(selectedAlumno.id, selectedAlumno);
    setIsSubmitting(false);

    if (res.success) {
      showToast("Alumno editado exitosamente");
      setShowEditModal(false);
      window.location.reload();
    } else {
      showToast(res.error || "Error al editar el alumno", "error");
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedAlumno) return;
    setIsSubmitting(true);
    const res = await eliminarAlumno(selectedAlumno.id, selectedAlumno.cuil, selectedAlumno.colegio_id);
    setIsSubmitting(false);

    if (res.success) {
      showToast("Alumno eliminado exitosamente");
      setShowDeleteModal(false);
      window.location.reload();
    } else {
      showToast(res.error || "Error al eliminar el alumno", "error");
    }
  };

  // CSV Import Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields) {
          setCsvHeaders(results.meta.fields);
          setCsvData(results.data);
          
          // Auto-map common headers
          const initialMap: Record<string, string> = { cuil: "", apellido_y_nombre: "", email: "", telefono: "", domicilio: "", carrera: "", ano_ingreso: "", mes_ingreso: "" };
          results.meta.fields.forEach(header => {
            const h = header.toLowerCase();
            if (h.includes("cuil")) initialMap.cuil = header;
            else if (h.includes("apellido") || h.includes("nombre")) initialMap.apellido_y_nombre = header;
            else if (h.includes("mail")) initialMap.email = header;
            else if (h.includes("tel") || h.includes("celular")) initialMap.telefono = header;
            else if (h.includes("domicilio") || h.includes("direccion")) initialMap.domicilio = header;
            else if (h.includes("carrera") || h.includes("curso")) initialMap.carrera = header;
            else if (h.includes("año") || h.includes("ano") || h.includes("ingreso")) initialMap.ano_ingreso = header;
            else if (h.includes("mes")) initialMap.mes_ingreso = header;
          });
          setHeaderMap(initialMap);
          setImportStep(2);
        }
      },
      error: (err) => {
        showToast("Error al leer el archivo CSV", "error");
      }
    });
  };

  const handleImportSubmit = async () => {
    if (!headerMap.cuil || !headerMap.apellido_y_nombre || !headerMap.ano_ingreso) {
      showToast("CUIL, Apellido y Nombre, y Año de Ingreso son obligatorios", "error");
      return;
    }

    setIsSubmitting(true);
    const payload = csvData.map(row => ({
      cuil: row[headerMap.cuil],
      apellido_y_nombre: row[headerMap.apellido_y_nombre],
      email: headerMap.email ? row[headerMap.email] : null,
      telefono: headerMap.telefono ? row[headerMap.telefono] : null,
      domicilio: headerMap.domicilio ? row[headerMap.domicilio] : null,
      carrera: headerMap.carrera ? row[headerMap.carrera] : null,
      ano_ingreso: row[headerMap.ano_ingreso],
      mes_ingreso: headerMap.mes_ingreso ? row[headerMap.mes_ingreso] : null,
      estado_academico: "Activo"
    })).filter(a => a.cuil && a.apellido_y_nombre && a.ano_ingreso);

    const res = await importarAlumnosMasivos(payload);
    setIsSubmitting(false);

    if (res.success) {
      showToast(`Importación completada. ${res.inserted} insertados, ${res.updated} actualizados.`);
      setShowImportModal(false);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showToast(res.error || "Error al importar los datos", "error");
    }
  };

  // Review Modal Handlers
  const abrirFichaReview = (alumno: Alumno) => {
    setReviewAlumno(alumno);
    setSelectedSlot(null);
    setPreviewUrl("");
    setObservaciones("");
    setShowReviewModal(true);
  };

  const handleSelectSlot = async (slot: any) => {
    setSelectedSlot(slot);
    setObservaciones(slot.observaciones || "");
    setPreviewUrl("");
    
    if (slot.enlace) {
      setPreviewLoading(true);
      const res = await obtenerUrlFirmadaDocumento(slot.enlace);
      setPreviewLoading(false);
      if (res.success && res.signedUrl) {
        setPreviewUrl(res.signedUrl);
      } else {
        showToast(res.error || "Error al generar vista previa", "error");
      }
    }
  };

  const handleEvaluarDocumento = async (estado: 'Aprobado' | 'Rechazado') => {
    if (!reviewAlumno || !selectedSlot) return;
    if (estado === 'Rechazado' && !observaciones.trim()) {
      showToast("Ingresa un motivo obligatorio para el rechazo", "error");
      return;
    }

    setEvaluating(true);
    const res = await evaluarDocumentoLegajo(reviewAlumno.id, selectedSlot.id, estado, observaciones.trim());
    setEvaluating(false);

    if (res.success) {
      // Actualizar localmente el alumno en revisión
      const updatedSlots = reviewAlumno.slots?.map(s => {
        if (s.id === selectedSlot.id) {
          return { ...s, estado, observaciones: observaciones.trim() };
        }
        return s;
      }) || [];

      const aprobados = updatedSlots.filter(s => s.estado === 'Aprobado').length;
      const progreso = reviewAlumno.totalesSlots ? Math.round((aprobados / reviewAlumno.totalesSlots) * 100) : 0;
      const pendingReview = updatedSlots.filter(s => s.estado === 'En Revisión').length;

      const updatedAlumno = {
        ...reviewAlumno,
        slots: updatedSlots,
        aprobados,
        progreso,
        pendingReview
      };

      setReviewAlumno(updatedAlumno);
      setSelectedSlot({ ...selectedSlot, estado, observaciones: observaciones.trim() });
      setObservaciones("");

      // Actualizar en el estado de la lista global
      setAlumnos(prev => prev.map(a => a.id === reviewAlumno.id ? updatedAlumno : a));
      showToast("Documento evaluado correctamente");
    } else {
      showToast(res.error || "Error al evaluar el documento", "error");
    }
  };

  const handleAddSlot = () => {
    const name = newSlotName.trim();
    if (!name) return;

    // Normalizar a ID (remueve acentos, caracteres especiales y reemplaza espacios por guiones bajos)
    const id = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remueve acentos
      .replace(/[^a-zA-Z0-9\s]/g, "") // remueve caracteres especiales excepto espacios
      .trim()
      .replace(/\s+/g, "_"); // reemplaza múltiples espacios por un guion bajo

    if (!id) {
      showToast("El nombre del requisito no es válido.", "error");
      return;
    }

    if (slotsList.some(s => s.id.toLowerCase() === id.toLowerCase())) {
      showToast("Ya existe un requisito con un nombre o identificador similar.", "error");
      return;
    }

    setSlotsList(prev => [...prev, { id, nombre: name }]);
    setNewSlotName("");
  };

  const handleRemoveSlot = (id: string) => {
    setSlotsList(prev => prev.filter(s => s.id !== id));
  };

  const handleMoveSlot = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === slotsList.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newList = [...slotsList];
    const temp = newList[index];
    newList[index] = newList[newIndex];
    newList[newIndex] = temp;
    setSlotsList(newList);
  };

  const handleSaveSlots = async () => {
    if (!colegioId) {
      showToast("Error: No se ha seleccionado una institución válida para guardar.", "error");
      return;
    }

    setSavingSlots(true);
    const res = await guardarSlotsLegajoDefault(colegioId, slotsList);
    setSavingSlots(false);

    if (res.success) {
      showToast("Requisitos del legajo configurados con éxito");
      setShowSlotsModal(false);
      window.location.reload();
    } else {
      showToast(res.error || "Error al guardar los requisitos", "error");
    }
  };

  const isImageFile = (url: string) => {
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.gif') || cleanUrl.endsWith('.webp');
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Page Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel de Legajos / Secretaría</h1>
          <p className="text-slate-500 text-sm">Gestiona la nómina de alumnos y legajos de la institución.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            const headers = "CUIL,APELLIDO_Y_NOMBRE,DOMICILIO,EMAIL,TELEFONO,CARRERA,AÑO_INGRESO,MES_INGRESO\n";
            const blob = new Blob([headers], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "plantilla_alumnos_dil.csv";
            link.click();
          }} className="px-4 py-2 bg-slate-100 text-slate-600 font-semibold rounded-lg hover:bg-slate-200 transition shadow-sm text-sm">
            Descargar Plantilla
          </button>
          <button onClick={() => { 
            if (isGlobalMode) {
              showToast("Para importar alumnos, primero debes seleccionar un colegio específico en la barra superior.", "error");
              return;
            }
            setImportStep(1); 
            setShowImportModal(true); 
          }} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition shadow-sm flex gap-2 items-center text-sm">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Importar CSV
          </button>
          <button onClick={() => {
            if (isGlobalMode) {
              showToast("Para configurar requisitos, primero debes seleccionar un colegio específico en la barra superior.", "error");
              return;
            }
            setShowSlotsModal(true);
          }} className="px-4 py-2 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition shadow-sm flex gap-2 items-center text-sm">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configurar Requisitos
          </button>
          <button onClick={() => {
            if (isGlobalMode) {
              showToast("Para dar de alta alumnos, primero debes seleccionar un colegio específico en la barra superior.", "error");
              return;
            }
            setShowManualModal(true);
          }} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm flex gap-2 items-center text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo Alumno
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Matrícula</p>
            <p className="text-3xl font-extrabold text-slate-800">{totales}</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Alumnos Activos</p>
            <p className="text-3xl font-extrabold text-slate-800">{activos}</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <svg className="w-5 h-5 absolute left-3 top-1.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Buscar por Legajo, Apellido o CUIL..." 
              className="w-full pl-10 pr-4 py-1.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
              <tr>
                {isGlobalMode && <th className="px-6 py-3">Institución</th>}
                <th className="px-6 py-3">Legajo</th>
                <th className="px-6 py-3">Apellido y Nombre</th>
                <th className="px-6 py-3">CUIL</th>
                <th className="px-6 py-3">Carrera / Año</th>
                <th className="px-6 py-3 text-center">Progreso</th>
                <th className="px-6 py-3 text-center">Estado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredAlumnos.length > 0 ? filteredAlumnos.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  {isGlobalMode && (
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {a.colegio_nombre || "-"}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 font-mono font-bold text-indigo-700">{a.id_alumno || "-"}</td>
                  <td className="px-6 py-4 font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        {a.apellido_y_nombre?.charAt(0) || "A"}
                      </div>
                      <div>
                        <div className="uppercase flex items-center gap-2 font-bold">
                          {a.apellido_y_nombre}
                          {a.pendingReview && a.pendingReview > 0 ? (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse border border-amber-200 shrink-0">
                              {a.pendingReview} Por revisar
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-400 font-normal">{a.email || "Sin email"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600">{a.cuil}</td>
                  <td className="px-6 py-4">
                     <div className="font-semibold text-slate-800" title={a.carrera_nombre || ""}>{a.carrera_diminutivo || a.carrera_nombre || "-"}</div>
                     <div className="text-xs text-slate-500">Cohorte: {a.ano_ingreso}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            a.progreso === 100 ? 'bg-emerald-500' :
                            (a.progreso ?? 0) > 40 ? 'bg-indigo-500' :
                            (a.progreso ?? 0) > 0 ? 'bg-amber-500' : 'bg-slate-300'
                          }`}
                          style={{ width: `${a.progreso}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-slate-600 w-8 text-right">{a.progreso}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      a.estado_academico === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 
                      a.estado_academico === 'Suspendido' ? 'bg-amber-100 text-amber-700' :
                      a.estado_academico === 'Egresado' ? 'bg-blue-100 text-blue-700' :
                      a.estado_academico === 'Abandono' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {a.estado_academico}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {a.progreso === 100 && (
                      <a 
                        href={`/api/legajos/descargar-completo?alumnoId=${a.id}`}
                        download
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors inline-block align-middle"
                        title="Descargar Legajo Consolidado (PDF)"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </a>
                    )}
                    <button 
                      onClick={() => abrirFichaReview(a)} 
                      className={`p-1.5 rounded-lg transition-colors inline-block align-middle ${
                        a.pendingReview && a.pendingReview > 0 
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      title="Revisar Legajo"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    </button>
                    <button onClick={() => { setSelectedAlumno(a); setShowEditModal(true); }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    {isSuperadmin && (
                      <button onClick={() => { setSelectedAlumno(a); setShowDeleteModal(true); }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    No se encontraron alumnos coincidentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">Nuevo Alumno (Legajo Automático)</h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Apellido y Nombre *</label>
                  <input required type="text" placeholder="Ej: PEREZ, JUAN ANTONIO" className="w-full uppercase px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none" value={manualForm.apellido_y_nombre} onChange={(e) => setManualForm({...manualForm, apellido_y_nombre: e.target.value.toUpperCase()})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">CUIL (Sin guiones) *</label>
                  <input required type="text" placeholder="20123456789" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono" value={manualForm.cuil} onChange={(e) => setManualForm({...manualForm, cuil: e.target.value.replace(/\D/g, "")})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Estado Académico</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={manualForm.estado_academico} onChange={(e) => setManualForm({...manualForm, estado_academico: e.target.value})}>
                    <option value="Activo">Activo</option>
                    <option value="Suspendido">Suspendido</option>
                    <option value="Egresado">Egresado</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Abandono">Abandono</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Domicilio</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none" value={manualForm.domicilio || ""} onChange={(e) => setManualForm({...manualForm, domicilio: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none" value={manualForm.telefono || ""} onChange={(e) => setManualForm({...manualForm, telefono: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Correo Electrónico</label>
                  <input type="email" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none" value={manualForm.email || ""} onChange={(e) => setManualForm({...manualForm, email: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Carrera / Curso <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                    value={manualForm.carrera_id || ""} 
                    onChange={(e) => setManualForm({...manualForm, carrera_id: e.target.value})}
                  >
                    <option value="" disabled>Seleccione una carrera</option>
                    {carrerasDisponibles.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Año Ingreso *</label>
                  <input required type="number" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none" value={manualForm.ano_ingreso || ""} onChange={(e) => setManualForm({...manualForm, ano_ingreso: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mes Ingreso</label>
                  <input type="number" min="1" max="12" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none" value={manualForm.mes_ingreso || ""} onChange={(e) => setManualForm({...manualForm, mes_ingreso: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowManualModal(false)} className="px-4 py-2 font-medium text-slate-600 text-sm hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 font-medium text-white text-sm bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting && <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                  Guardar y Generar Legajo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAlumno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">Editar Alumno: {selectedAlumno.id_alumno}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Apellido y Nombre *</label>
                  <input required type="text" className="w-full uppercase px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={selectedAlumno.apellido_y_nombre} onChange={(e) => setSelectedAlumno({...selectedAlumno, apellido_y_nombre: e.target.value.toUpperCase()})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">CUIL (No editable)</label>
                  <input type="text" disabled className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm outline-none font-mono text-slate-500" value={selectedAlumno.cuil} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Estado Académico</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={selectedAlumno.estado_academico} onChange={(e) => setSelectedAlumno({...selectedAlumno, estado_academico: e.target.value})}>
                    <option value="Activo">Activo</option>
                    <option value="Suspendido">Suspendido</option>
                    <option value="Egresado">Egresado</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Abandono">Abandono</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Domicilio</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={selectedAlumno.domicilio || ""} onChange={(e) => setSelectedAlumno({...selectedAlumno, domicilio: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={selectedAlumno.telefono || ""} onChange={(e) => setSelectedAlumno({...selectedAlumno, telefono: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Correo Electrónico</label>
                  <input type="email" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={selectedAlumno.email || ""} onChange={(e) => setSelectedAlumno({...selectedAlumno, email: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Carrera / Curso <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" 
                    value={selectedAlumno.carrera_id || ""} 
                    onChange={(e) => setSelectedAlumno({...selectedAlumno, carrera_id: e.target.value})}
                  >
                    <option value="" disabled>Seleccione una carrera</option>
                    {carrerasDisponibles.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Año Ingreso *</label>
                  <input required type="number" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={selectedAlumno.ano_ingreso || ""} onChange={(e) => setSelectedAlumno({...selectedAlumno, ano_ingreso: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mes Ingreso</label>
                  <input type="number" min="1" max="12" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={selectedAlumno.mes_ingreso || ""} onChange={(e) => setSelectedAlumno({...selectedAlumno, mes_ingreso: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 font-medium text-slate-600 text-sm hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 font-medium text-white text-sm bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting && <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedAlumno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col p-6 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-2">¿Eliminar Alumno?</h3>
            <p className="text-slate-500 text-sm mb-6">
              Estás a punto de eliminar definitivamente al alumno <strong>{selectedAlumno.apellido_y_nombre}</strong> (CUIL: {selectedAlumno.cuil}). Esta acción también destruirá su Identidad Virtual y es irreversible.
            </p>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="px-4 py-2 font-medium text-slate-600 text-sm hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleDeleteSubmit} disabled={isSubmitting} className="px-4 py-2 font-medium text-white text-sm bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                {isSubmitting && <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">Importador de Legajos CSV</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <div className="p-6">
              {/* Stepper */}
              <div className="flex items-center gap-2 mb-8">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${importStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>1</div>
                <div className={`flex-grow h-1 ${importStep >= 2 ? 'bg-indigo-600' : 'bg-slate-100'}`}></div>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${importStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</div>
                <div className={`flex-grow h-1 ${importStep >= 3 ? 'bg-indigo-600' : 'bg-slate-100'}`}></div>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${importStep >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>3</div>
              </div>

              {importStep === 1 && (
                <div className="text-center py-8">
                   <div className="mx-auto w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-4">
                     <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                   </div>
                   <h4 className="text-lg font-bold text-slate-800 mb-2">Sube tu archivo CSV</h4>
                   <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">Selecciona el padrón de alumnos. Los Legajos (ID_ALUMNO) se generarán automáticamente.</p>
                   <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                   <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition shadow-sm font-bold">
                     Seleccionar Archivo
                   </button>
                 </div>
              )}

              {importStep === 2 && (
                <div>
                   <h4 className="text-base font-bold text-slate-800 mb-1">Mapeo de Columnas</h4>
                   <p className="text-slate-500 text-sm mb-6">Hemos detectado cabeceras. Relaciónalas con los campos del sistema.</p>
                   
                   <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                     {[
                       { id: 'cuil', label: 'CUIL (Sin guiones)', required: true },
                       { id: 'apellido_y_nombre', label: 'Apellido y Nombre', required: true },
                       { id: 'ano_ingreso', label: 'Año Ingreso (Ej: 2026)', required: true },
                       { id: 'mes_ingreso', label: 'Mes Ingreso', required: false },
                       { id: 'domicilio', label: 'Domicilio', required: false },
                       { id: 'email', label: 'Email', required: false },
                       { id: 'telefono', label: 'Teléfono', required: false },
                       { id: 'carrera', label: 'Carrera / Curso', required: false }
                     ].map(field => (
                       <div key={field.id} className="flex items-center justify-between gap-4 p-3 border border-slate-100 rounded-lg bg-slate-50">
                         <div className="w-1/2">
                           <span className="text-sm font-semibold text-slate-700">{field.label} {field.required && <span className="text-red-500">*</span>}</span>
                         </div>
                         <div className="w-1/2">
                           <select 
                             className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                             value={headerMap[field.id] || ""}
                             onChange={(e) => setHeaderMap({...headerMap, [field.id]: e.target.value})}
                           >
                               <option value="">-- Ignorar --</option>
                               {csvHeaders.map(h => (
                                 <option key={h} value={h}>{h}</option>
                               ))}
                            </select>
                         </div>
                       </div>
                     ))}
                   </div>
                   
                   <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
                       <button onClick={() => setImportStep(1)} className="px-4 py-2 font-medium text-slate-600 text-sm hover:bg-slate-100 rounded-lg">Atrás</button>
                       <button onClick={() => setImportStep(3)} className="px-4 py-2 font-medium text-white text-sm bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold">Continuar</button>
                   </div>
                </div>
              )}

              {importStep === 3 && (
                <div>
                   <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-6 text-center">
                     <p className="text-sm text-indigo-800 font-medium mb-1">Resumen de Importación</p>
                     <p className="text-3xl font-extrabold text-indigo-600">{csvData.length}</p>
                     <p className="text-xs text-indigo-500">registros encontrados para procesar</p>
                   </div>
                   
                   <p className="text-slate-600 text-sm mb-8 text-center px-8">Al hacer clic en Confirmar, el sistema procesará los CUILs, aplicará formatos, generará los Legajos correlativos automáticos y creará las identidades virtuales.</p>

                   <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                       <button onClick={() => setImportStep(2)} disabled={isSubmitting} className="px-4 py-2 font-medium text-slate-600 text-sm hover:bg-slate-100 rounded-lg disabled:opacity-50">Atrás</button>
                       <button onClick={handleImportSubmit} disabled={isSubmitting} className="px-5 py-2 font-medium text-white text-sm bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 font-bold">
                         {isSubmitting && <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                         Confirmar y Procesar
                       </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REVIEW LEGAJOS MODAL (ADMIN REVIEW FLOW) */}
      {showReviewModal && reviewAlumno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col md:flex-row overflow-hidden h-[90vh] max-h-[850px] animate-in zoom-in-95 border">
            
            {/* Sidebar - Slot List */}
            <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 flex flex-col max-h-[35vh] md:max-h-full">
              <div className="p-5 border-b border-slate-200 bg-white">
                <h3 className="text-md font-extrabold text-slate-800 uppercase tracking-tight line-clamp-1">{reviewAlumno.apellido_y_nombre}</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-1">CUIL: {reviewAlumno.cuil} • LEGAJO: {reviewAlumno.id_alumno}</p>
                <div className="flex items-center gap-2 mt-3 bg-indigo-50/70 border border-indigo-100/70 rounded-lg p-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${reviewAlumno.progreso}%` }}></div>
                  </div>
                  <span className="text-[11px] font-black text-indigo-700 w-8 text-right">{reviewAlumno.progreso}%</span>
                </div>
                {reviewAlumno.progreso === 100 && (
                  <a 
                    href={`/api/legajos/descargar-completo?alumnoId=${reviewAlumno.id}`}
                    download
                    className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 text-center"
                  >
                    <svg className="w-4 h-4 text-emerald-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar Legajo Consolidado (PDF)
                  </a>
                )}
              </div>
              
              <div className="p-4 flex-grow overflow-y-auto space-y-2">
                {reviewAlumno.slots && reviewAlumno.slots.length > 0 ? (
                  reviewAlumno.slots.map((s: any) => {
                    let badgeColor = 'bg-slate-100 text-slate-400 border-slate-200';
                    if (s.estado === 'Aprobado') badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    else if (s.estado === 'Rechazado') badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
                    else if (s.estado === 'En Revisión') badgeColor = 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse';

                    const isSelected = selectedSlot?.id === s.id;
                    const borderActive = isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40' : 'border-slate-100 bg-white hover:bg-slate-50';

                    return (
                      <div 
                        key={s.id} 
                        onClick={() => handleSelectSlot(s)} 
                        className={`p-3.5 rounded-xl border shadow-sm cursor-pointer transition-all flex justify-between items-center group ${borderActive}`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className={`text-[13px] font-extrabold truncate ${isSelected ? 'text-indigo-800' : 'text-slate-700 group-hover:text-indigo-600'}`}>{s.nombre}</p>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">Subido: {s.fecha}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full border shadow-inner shrink-0 ${badgeColor}`}>
                          {s.estado}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-400 italic text-center py-8">No se encontraron slots de legajo.</p>
                )}
              </div>
            </div>

            {/* Main Preview Area */}
            <div className="w-full md:w-2/3 bg-slate-100 flex flex-col h-[55vh] md:h-full">
              <div className="flex justify-between items-center p-4 bg-white border-b border-slate-200 shrink-0">
                <div className="min-w-0 pr-2">
                  <h4 className="font-extrabold text-slate-800 text-md truncate">{selectedSlot ? selectedSlot.nombre : 'Selecciona un documento'}</h4>
                  {selectedSlot && (
                    <span className={`mt-1.5 px-2.5 py-0.5 text-[9px] font-black uppercase rounded border shadow-inner inline-block ${
                      selectedSlot.estado === 'Aprobado' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                      selectedSlot.estado === 'Rechazado' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                      selectedSlot.estado === 'En Revisión' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {selectedSlot.estado}
                    </span>
                  )}
                </div>
                <button onClick={() => setShowReviewModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              
              <div className="flex-grow p-4 md:p-6 overflow-hidden relative flex items-center justify-center">
                {previewLoading ? (
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-2"></div>
                    <p className="text-sm font-semibold text-slate-500">Cargando visor seguro...</p>
                  </div>
                ) : previewUrl ? (
                  isImageFile(selectedSlot?.enlace || '') ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-200/50 rounded-xl p-2 border border-slate-300/50 shadow-inner overflow-auto">
                      <img src={previewUrl} alt="Vista Previa" className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
                    </div>
                  ) : (
                    <iframe 
                      src={previewUrl} 
                      className="w-full h-full rounded-xl border border-slate-300/50 shadow-inner bg-white" 
                    ></iframe>
                  )
                ) : (
                  <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 w-full max-w-sm shadow-sm flex flex-col items-center">
                    <svg className="w-12 h-12 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="text-slate-400 italic text-sm">Ningún archivo cargado en este slot o no se ha seleccionado ninguno para previsualizar.</p>
                  </div>
                )}
              </div>
              
              {/* Actions Panel */}
              {selectedSlot && selectedSlot.estado === 'En Revisión' && (
                <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex flex-col gap-3 shadow-md">
                  <div className="w-full">
                    <input 
                      type="text" 
                      value={observaciones} 
                      onChange={e => setObservaciones(e.target.value)} 
                      placeholder="Escribe el motivo del rechazo aquí (Obligatorio)..." 
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800" 
                    />
                  </div>
                  <div className="flex gap-2 justify-end w-full">
                    <button 
                      onClick={() => handleEvaluarDocumento('Rechazado')} 
                      disabled={evaluating || !observaciones.trim()}
                      className="px-5 py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold rounded-xl transition-all text-sm disabled:opacity-50 shadow-sm active:scale-95"
                    >
                      Rechazar
                    </button>
                    <button 
                      onClick={() => handleEvaluarDocumento('Aprobado')} 
                      disabled={evaluating}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all text-sm disabled:opacity-50 shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                      {evaluating && <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                      ✓ Aprobar Documento
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Configurar Requisitos Modal */}
      {showSlotsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 border border-slate-100 max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="font-extrabold text-slate-800 text-lg">Configurar Requisitos del Legajo</h3>
              </div>
              <button onClick={() => setShowSlotsModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-grow">
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-800 space-y-1">
                <p className="font-extrabold">📌 ¿Cómo funciona esta configuración?</p>
                <p>Establece los requisitos obligatorios de documentación para los alumnos de la institución. Los alumnos verán estos slots inmediatamente en su portal y podrán subir los archivos correspondientes.</p>
              </div>

              {/* Add New Requirement Form */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: Certificado de Título Secundario"
                  value={newSlotName}
                  onChange={(e) => setNewSlotName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSlot();
                    }
                  }}
                  className="flex-grow px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleAddSlot}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar
                </button>
              </div>

              {/* Requirement List */}
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {slotsList.length > 0 ? (
                  slotsList.map((slot, index) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between p-3 border border-slate-100 bg-slate-50 rounded-xl hover:bg-slate-100/50 transition-all group"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-sm font-bold text-slate-700 truncate">{slot.nombre}</span>
                        <span className="text-[10px] font-mono text-slate-400">ID: {slot.id}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Move Up */}
                        <button
                          type="button"
                          onClick={() => handleMoveSlot(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 rounded hover:bg-slate-200 transition-colors"
                          title="Subir orden"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        {/* Move Down */}
                        <button
                          type="button"
                          onClick={() => handleMoveSlot(index, 'down')}
                          disabled={index === slotsList.length - 1}
                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 rounded hover:bg-slate-200 transition-colors"
                          title="Bajar orden"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleRemoveSlot(slot.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors ml-1"
                          title="Eliminar requisito"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center p-4">
                    <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-xs text-slate-400 italic">No hay requisitos de legajo configurados. Los alumnos no verán slots para subir archivos.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowSlotsModal(false)}
                disabled={savingSlots}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSlots}
                disabled={savingSlots}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
              >
                {savingSlots && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                ✓ Guardar Requisitos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-[200] px-6 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
          {toastMessage.type === 'success' ? (
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
          {toastMessage.text}
        </div>
      )}
    </div>
  );
}
