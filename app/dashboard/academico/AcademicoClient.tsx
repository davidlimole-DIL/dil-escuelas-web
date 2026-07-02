"use client";

import { useState, useEffect } from "react";
import { type Alumno, type Carrera, actualizarEstadoAcademico, crearCarrera, editarCarrera, eliminarCarrera } from "./actions";
import { useRouter } from "next/navigation";

type AcademicoClientProps = {
  initialAlumnos: Alumno[];
  initialCarreras: Carrera[];
  isGlobalMode: boolean;
};

export default function AcademicoClient({ initialAlumnos, initialCarreras, isGlobalMode }: AcademicoClientProps) {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<"alumnos" | "carreras">("alumnos");
  
  // Alumnos State
  const [alumnos, setAlumnos] = useState<Alumno[]>(initialAlumnos);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCarrera, setFilterCarrera] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  
  // Carreras State
  const [carreras, setCarreras] = useState<Carrera[]>(initialCarreras);
  const [showCarreraModal, setShowCarreraModal] = useState(false);
  const [carreraForm, setCarreraForm] = useState<{ id?: string; nombre: string; diminutivo: string; estado: string }>({ nombre: "", diminutivo: "", estado: "Activa" });
  
  // General State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    setAlumnos(initialAlumnos);
  }, [initialAlumnos]);

  useEffect(() => {
    setCarreras(initialCarreras);
  }, [initialCarreras]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- Alumnos Logic ---
  const handleEstadoChange = async (id: string, nuevoEstado: string) => {
    setAlumnos(prev => prev.map(a => a.id === id ? { ...a, estado_academico: nuevoEstado } : a));
    const res = await actualizarEstadoAcademico(id, nuevoEstado);
    if (res.success) {
      showToast("Estado actualizado correctamente");
    } else {
      setAlumnos(prev => prev.map(a => a.id === id ? { ...a, estado_academico: initialAlumnos.find(ia => ia.id === id)?.estado_academico || "No Definido" } : a));
      showToast(res.error || "Error al actualizar estado", "error");
    }
  };

  const filteredAlumnos = alumnos.filter(a => {
    const matchSearch = (a.apellido_y_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         a.id_alumno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         a.cuil?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Si la carrera es nula, consideramos que no matchea si hay un filtro aplicado
    const carreraStr = a.carrera || "";                     
    const matchCarrera = filterCarrera ? carreraStr === filterCarrera : true;
    const estadoStr = a.estado_academico || "No Definido";
    const matchEstado = filterEstado ? estadoStr === filterEstado : true;

    return matchSearch && matchCarrera && matchEstado;
  });

  const carrerasUnicasAlumnos = Array.from(new Set(alumnos.map(a => a.carrera).filter(Boolean)));
  const estadosUnicos = Array.from(new Set(alumnos.map(a => a.estado_academico || "No Definido")));

  // --- Carreras Logic ---
  const handleSaveCarrera = async () => {
    if (!carreraForm.nombre.trim()) {
      showToast("El nombre de la carrera es obligatorio", "error");
      return;
    }

    if (carreraForm.id) {
      const res = await editarCarrera(carreraForm.id, carreraForm.nombre, carreraForm.diminutivo, carreraForm.estado);
      if (res.success) {
        showToast("Carrera actualizada");
        setShowCarreraModal(false);
        router.refresh();
      } else {
        showToast(res.error || "Error al editar carrera", "error");
      }
    } else {
      const res = await crearCarrera(carreraForm.nombre, carreraForm.diminutivo);
      if (res.success) {
        showToast("Carrera creada");
        setShowCarreraModal(false);
        router.refresh();
      } else {
        showToast(res.error || "Error al crear carrera", "error");
      }
    }
  };

  const handleDeleteCarrera = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta carrera? Podría fallar si hay alumnos asignados a la misma.")) return;
    const res = await eliminarCarrera(id);
    if (res.success) {
      showToast("Carrera eliminada");
      router.refresh();
    } else {
      showToast(res.error || "Error al eliminar carrera", "error");
    }
  };


  return (
    <div className="p-4 md:p-8 space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel Académico</h1>
          <p className="text-slate-500 text-sm">Gestiona los estados académicos y las carreras de la institución.</p>
        </div>
      </div>

      {/* TABS */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("alumnos")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === "alumnos" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}
          >
            Estado Alumnos
          </button>
          <button
            onClick={() => setActiveTab("carreras")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === "carreras" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}
          >
            Gestión de Carreras / Cursos
          </button>
        </nav>
      </div>

      {activeTab === "alumnos" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:flex-1">
              <svg className="w-5 h-5 absolute left-3 top-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                type="text" 
                placeholder="Buscar alumno..." 
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none w-full md:w-48"
                value={filterCarrera} onChange={e => setFilterCarrera(e.target.value)}>
                <option value="">Todas las Carreras</option>
                {carrerasUnicasAlumnos.map((c, i) => <option key={i} value={c as string}>{c as string}</option>)}
              </select>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none w-full md:w-48"
                value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                <option value="">Todos los Estados</option>
                {estadosUnicos.map((e, i) => <option key={i} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Legajo</th>
                  <th className="px-6 py-3">Alumno</th>
                  <th className="px-6 py-3">Carrera / Curso</th>
                  <th className="px-6 py-3">Cohorte</th>
                  <th className="px-6 py-3 text-right">Estado Académico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlumnos.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900">{a.id_alumno}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{a.apellido_y_nombre}</div>
                      <div className="text-xs text-slate-400">CUIL: {a.cuil}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{a.carrera || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{a.ano_ingreso || "-"}</td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={a.estado_academico || "No Definido"}
                        onChange={(e) => handleEstadoChange(a.id, e.target.value)}
                        className={`text-xs font-bold rounded-full px-3 py-1 outline-none cursor-pointer border-2
                          ${a.estado_academico === "Activo" ? "bg-emerald-50 text-emerald-700 border-emerald-200 focus:border-emerald-500" :
                            a.estado_academico === "Suspendido" ? "bg-amber-50 text-amber-700 border-amber-200 focus:border-amber-500" :
                            a.estado_academico === "Abandono" ? "bg-red-50 text-red-700 border-red-200 focus:border-red-500" :
                            a.estado_academico === "Egresado" ? "bg-blue-50 text-blue-700 border-blue-200 focus:border-blue-500" :
                            "bg-slate-100 text-slate-600 border-slate-200 focus:border-slate-400"
                          }`}
                      >
                        <option value="Activo">Activo</option>
                        <option value="Suspendido">Suspendido</option>
                        <option value="Abandono">Abandono</option>
                        <option value="Egresado">Egresado</option>
                        <option value="Inactivo">Inactivo</option>
                        <option value="No Definido">No Definido</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {filteredAlumnos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      No se encontraron alumnos con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "carreras" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500">Administra el catálogo de carreras disponibles para la matriculación.</p>
            <button
              onClick={() => {
                if (isGlobalMode) {
                  showToast("Para crear carreras, primero debes seleccionar un colegio en la barra superior", "error");
                  return;
                }
                setCarreraForm({ nombre: "", diminutivo: "", estado: "Activa" });
                setShowCarreraModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm text-sm"
            >
              + Nueva Carrera
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {carreras.map(c => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition group">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-indigo-600 transition">
                    {c.nombre} {c.diminutivo && <span className="text-slate-400 font-normal text-sm ml-1">({c.diminutivo})</span>}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.estado === "Activa" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.estado}
                  </span>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => {
                    setCarreraForm({ id: c.id, nombre: c.nombre, diminutivo: c.diminutivo || "", estado: c.estado });
                    setShowCarreraModal(true);
                  }} className="flex-1 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition">
                    Editar
                  </button>
                  <button onClick={() => handleDeleteCarrera(c.id)} className="flex-1 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-red-50 hover:text-red-600 rounded-lg transition">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            {carreras.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-xl border-dashed">
                <p className="text-slate-400">No hay carreras configuradas.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Carrera Modal */}
      {showCarreraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800">{carreraForm.id ? "Editar Carrera" : "Nueva Carrera"}</h3>
              <button onClick={() => setShowCarreraModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nombre de la Carrera/Curso</label>
                <input 
                  type="text" 
                  value={carreraForm.nombre}
                  onChange={e => setCarreraForm({...carreraForm, nombre: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                  placeholder="Ej: Tecnicatura en Programación"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Diminutivo / Sigla (Opcional)</label>
                <input 
                  type="text" 
                  value={carreraForm.diminutivo}
                  onChange={e => setCarreraForm({...carreraForm, diminutivo: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                  placeholder="Ej: T.P."
                />
              </div>
              {carreraForm.id && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Estado</label>
                  <select 
                    value={carreraForm.estado}
                    onChange={e => setCarreraForm({...carreraForm, estado: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                  >
                    <option value="Activa">Activa (Disponible para matriculación)</option>
                    <option value="Inactiva">Inactiva (Oculta en altas)</option>
                  </select>
                </div>
              )}
              <div className="pt-4 flex gap-3">
                <button onClick={() => setShowCarreraModal(false)} className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition">
                  Cancelar
                </button>
                <button onClick={handleSaveCarrera} className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition">
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-lg font-medium text-sm flex items-center gap-2 ${toastMessage.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}>
            {toastMessage.type === 'error' ? (
              <svg className="w-5 h-5 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            )}
            {toastMessage.text}
          </div>
        </div>
      )}
    </div>
  );
}
