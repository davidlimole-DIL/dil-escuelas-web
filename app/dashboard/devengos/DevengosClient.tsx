"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  type AlumnoDevengo,
  type DevengamientoHistorico,
  registrarDevengosMasivos,
  eliminarDevengamiento
} from "./actions";

type DevengosClientProps = {
  alumnos: AlumnoDevengo[];
  historialInicial: DevengamientoHistorico[];
  colegioNombre: string;
};

export default function DevengosClient({
  alumnos,
  historialInicial,
  colegioNombre
}: DevengosClientProps) {
  const router = useRouter();

  // Navigation State
  const [activeTab, setActiveTab] = useState<"generar" | "historial">("generar");

  // Form State
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [fechaVto, setFechaVto] = useState("");

  // Filters State (Generar Tab)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCarrera, setSelectedCarrera] = useState("");

  // Filters State (Historial Tab)
  const [historialSearch, setHistorialSearch] = useState("");

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // History State
  const [historial, setHistorial] = useState<DevengamientoHistorico[]>(historialInicial);

  // Modal / Feedback State
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [targetDeleteDevengo, setTargetDeleteDevengo] = useState<DevengamientoHistorico | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Sync history when props update from server revalidation
  useEffect(() => {
    setHistorial(historialInicial);
  }, [historialInicial]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Get unique careers from students list
  const careers = Array.from(
    new Set(alumnos.map((a) => a.carrera).filter(Boolean))
  ).sort();

  // Filter students based on text query and career selection
  const filteredAlumnos = alumnos.filter((al) => {
    const matchText =
      al.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      al.cuil.includes(searchQuery) ||
      al.legajo.toLowerCase().includes(searchQuery.toLowerCase());

    const matchCarrera = selectedCarrera ? al.carrera === selectedCarrera : true;

    return matchText && matchCarrera;
  });

  // Filter history based on search query
  const filteredHistorial = historial.filter((item) => {
    const query = historialSearch.toLowerCase();
    const matchConcepto = item.concepto.toLowerCase().includes(query);
    const matchNombre = item.alumno?.apellido_y_nombre.toLowerCase().includes(query) || false;
    const matchCuil = item.alumno?.cuil.includes(query) || false;
    
    return matchConcepto || matchNombre || matchCuil;
  });

  // Toggle selection for a single student
  const handleToggleStudent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle selection for all currently visible (filtered) students
  const handleToggleVisible = (checked: boolean) => {
    const visibleIds = filteredAlumnos.map((a) => a.id);
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    } else {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    }
  };

  const allVisibleSelected =
    filteredAlumnos.length > 0 &&
    filteredAlumnos.every((a) => selectedIds.includes(a.id));

  // Prepare Accrual Billing
  const handlePrepareBilling = (e: React.FormEvent) => {
    e.preventDefault();

    if (!concepto.trim()) {
      showToast("Por favor complete el Concepto del cargo.", "error");
      return;
    }
    if (!monto || parseFloat(monto) <= 0) {
      showToast("Por favor ingrese un Monto a cobrar válido.", "error");
      return;
    }
    if (!fechaVto) {
      showToast("Por favor seleccione la Fecha de Vencimiento.", "error");
      return;
    }
    if (selectedIds.length === 0) {
      showToast("Debe seleccionar al menos un alumno destinatario.", "error");
      return;
    }

    setModalOpen(true);
  };

  // Execute Accrual Billing
  const handleExecuteBilling = async () => {
    setModalOpen(false);
    setLoading(true);

    try {
      const res = await registrarDevengosMasivos(
        concepto,
        parseFloat(monto),
        fechaVto,
        selectedIds
      );

      if (res.success) {
        showToast(
          `¡Operación Exitosa! Se han registrado ${res.cantidad} cargos en las cuentas corrientes.`,
          "success"
        );
        // Clear form and selection
        setConcepto("");
        setMonto("");
        setFechaVto("");
        setSelectedIds([]);
        
        // Refresh server data to fetch updated history
        router.refresh();
      } else {
        showToast(res.error || "Ocurrió un error al procesar la solicitud.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Error del servidor.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Trigger Deletion Confirmation
  const handleRequestDelete = (devengo: DevengamientoHistorico) => {
    setTargetDeleteDevengo(devengo);
    setDeleteConfirmOpen(true);
  };

  // Execute Accrual Deletion
  const handleExecuteDelete = async () => {
    if (!targetDeleteDevengo) return;

    setDeleteConfirmOpen(false);
    setLoading(true);

    try {
      const res = await eliminarDevengamiento(targetDeleteDevengo.id);
      if (res.success) {
        showToast("Se ha eliminado el cargo seleccionado correctamente.", "success");
        // Optimistically update client UI state
        setHistorial((prev) => prev.filter((d) => d.id !== targetDeleteDevengo.id));
        router.refresh();
      } else {
        showToast(res.error || "No se pudo eliminar el devengamiento.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Error al intentar borrar el registro.", "error");
    } finally {
      setLoading(false);
      setTargetDeleteDevengo(null);
    }
  };

  const totalAmount = selectedIds.length * (parseFloat(monto) || 0);

  // Format date safely helper
  const formatDateStr = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch {
      return isoString;
    }
  };

  // Format datetime safely helper
  const formatDateTimeStr = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      
      // Ajustar zona horaria si es necesario, o usar formateo estándar
      const dateStr = d.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
      const timeStr = d.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit"
      });
      
      return `${dateStr} ${timeStr}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{colegioNombre}</h1>
          <p className="text-slate-500 font-semibold italic text-sm mt-1">
            Módulo de Administración de Devengamientos
          </p>
        </div>

        {/* Tab Switcher Buttons */}
        <div className="bg-slate-200/60 p-1 rounded-xl flex gap-1 self-stretch md:self-auto">
          <button
            onClick={() => setActiveTab("generar")}
            className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold text-xs transition flex items-center justify-center gap-2 ${
              activeTab === "generar"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Generar Cargos
          </button>
          <button
            onClick={() => setActiveTab("historial")}
            className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold text-xs transition flex items-center justify-center gap-2 ${
              activeTab === "historial"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Historial de Cargos
          </button>
        </div>
      </header>

      {/* Render Main Content depending on Tab */}
      {activeTab === "generar" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Step 1: Form Card */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 self-start space-y-6">
            <div className="border-b pb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                1
              </span>
              <h2 className="text-lg font-bold text-slate-800">Definir los datos del Cargo</h2>
            </div>

            <form onSubmit={handlePrepareBilling} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Concepto
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cuota Junio 2026"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  className="w-full px-4 py-2 text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Monto a Cobrar ($)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full px-4 py-2 text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Fecha de Vencimiento
                </label>
                <input
                  type="date"
                  value={fechaVto}
                  onChange={(e) => setFechaVto(e.target.value)}
                  className="w-full px-4 py-2 text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  required
                />
              </div>

              {selectedIds.length > 0 && monto && (
                <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-slate-700 space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Monto unitario:</span>
                    <span className="font-bold text-slate-900">${parseFloat(monto).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Destinatarios:</span>
                    <span className="font-bold text-slate-900">{selectedIds.length}</span>
                  </div>
                  <div className="border-t border-indigo-100 my-2 pt-2 flex justify-between text-sm font-bold text-indigo-700">
                    <span>Total devengado:</span>
                    <span>${totalAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || selectedIds.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? "Generando Cargos..." : "Procesar Cargos"}
              </button>
            </form>
          </div>

          {/* Step 2: Recipients List */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[75vh]">
            
            {/* List Toolbar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  2
                </span>
                <h2 className="text-lg font-bold text-slate-800">Seleccionar Destinatarios</h2>
              </div>
              
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-grow">
                  <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar alumno por nombre, legajo o CUIL..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                  />
                </div>

                <select
                  value={selectedCarrera}
                  onChange={(e) => setSelectedCarrera(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 md:max-w-[200px]"
                >
                  <option value="">Todas las carreras</option>
                  {careers.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <label className="flex items-center justify-center gap-2 cursor-pointer font-bold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 transition text-sm">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => handleToggleVisible(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  Marcar Visibles ({filteredAlumnos.length})
                </label>
              </div>
            </div>

            {/* List Content */}
            <div className="overflow-y-auto flex-grow">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <th className="p-3 pl-6 w-12">Sel.</th>
                    <th className="p-3">Alumno</th>
                    <th className="p-3">Carrera / Curso</th>
                    <th className="p-3 text-right pr-6">CUIL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                  {filteredAlumnos.map((al) => {
                    const isChecked = selectedIds.includes(al.id);
                    return (
                      <tr
                        key={al.id}
                        onClick={() => handleToggleStudent(al.id)}
                        className={`hover:bg-indigo-50/20 transition-colors cursor-pointer ${
                          isChecked ? "bg-indigo-50/10 font-medium" : ""
                        }`}
                      >
                        <td className="p-3 pl-6 w-12" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleStudent(al.id)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{al.nombre}</div>
                          {al.legajo && (
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Legajo: {al.legajo}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-500 text-xs">{al.carrera}</td>
                        <td className="p-3 text-right font-mono text-slate-500 pr-6 text-xs">
                          {al.cuil}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAlumnos.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-400 italic">
                        No se encontraron alumnos activos con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* List Footer Status */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-sm font-semibold text-slate-600">
              <span>{selectedIds.length} alumnos seleccionados</span>
              <span className="text-xs text-slate-400">Total activos: {alumnos.length}</span>
            </div>
          </div>

        </div>
      ) : (
        /* Historial Tab */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[75vh] animate-in fade-in duration-200">
          
          {/* Historial Toolbar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
            <h2 className="text-lg font-bold text-slate-800">Historial de Devengamientos Generados</h2>
            <div className="flex">
              <div className="relative flex-grow">
                <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar en el historial por concepto, alumno o CUIL..."
                  value={historialSearch}
                  onChange={(e) => setHistorialSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Historial Content */}
          <div className="overflow-y-auto flex-grow">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="p-3 pl-6">Concepto</th>
                  <th className="p-3">Alumno</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3 text-center">Vto.</th>
                  <th className="p-3">Generado El</th>
                  <th className="p-3 text-center pr-6 w-20">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                {filteredHistorial.map((hist) => (
                  <tr key={hist.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 pl-6 font-semibold text-slate-900">{hist.concepto}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">
                        {hist.alumno?.apellido_y_nombre || "Alumno no empadronado"}
                      </div>
                      {hist.alumno?.cuil && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          CUIL: {hist.alumno.cuil}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-800">
                      ${hist.monto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center font-medium text-slate-600 text-xs">
                      {formatDateStr(hist.fecha_vencimiento)}
                    </td>
                    <td className="p-3 text-slate-500 text-xs">
                      {formatDateTimeStr(hist.created_at)}
                    </td>
                    <td className="p-3 text-center pr-6" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleRequestDelete(hist)}
                        title="Eliminar cargo por error"
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredHistorial.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400 italic">
                      No se encontraron registros de cargos en el historial.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Historial Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-400 text-right">
            Se muestran los cargos ordenados del más reciente al más antiguo.
          </div>
        </div>
      )}

      {/* Confirmation Accrual Generation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 transform transition-all text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-950">Confirmar Operación</h3>
              <p className="text-sm text-slate-500">
                Se generará un cargo a cuenta para los alumnos seleccionados con las siguientes especificaciones:
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border text-left text-xs space-y-2 text-slate-600 font-medium">
              <div className="flex justify-between border-b pb-2">
                <span>Concepto:</span>
                <span className="font-bold text-slate-900">{concepto}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span>Monto Unitario:</span>
                <span className="font-bold text-slate-900">${parseFloat(monto).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span>Vencimiento:</span>
                <span className="font-bold text-slate-900">
                  {fechaVto.split("-").reverse().join("/")}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span>Destinatarios:</span>
                <span className="font-bold text-slate-900">{selectedIds.length} alumno(s)</span>
              </div>
              <div className="flex justify-between pt-1 text-sm font-bold text-indigo-700">
                <span>Importe Total:</span>
                <span>${totalAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-white border rounded-xl hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteBilling}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition"
              >
                Generar Cargos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Deletion Modal */}
      {deleteConfirmOpen && targetDeleteDevengo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 transform transition-all text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto animate-bounce">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-950">¿Eliminar Cargo Devengado?</h3>
              <p className="text-sm text-slate-500">
                Esta acción es irreversible y eliminará el cargo de la cuenta corriente del alumno.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border text-left text-xs space-y-2 text-slate-600 font-medium">
              <div className="flex justify-between border-b pb-2">
                <span>Concepto:</span>
                <span className="font-bold text-slate-900">{targetDeleteDevengo.concepto}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span>Alumno:</span>
                <span className="font-bold text-slate-900">
                  {targetDeleteDevengo.alumno?.apellido_y_nombre}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span>CUIL Alumno:</span>
                <span className="font-bold text-slate-900">{targetDeleteDevengo.alumno?.cuil}</span>
              </div>
              <div className="flex justify-between pt-1 text-sm font-bold text-rose-600">
                <span>Monto a Borrar:</span>
                <span>${targetDeleteDevengo.monto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-white border rounded-xl hover:bg-slate-50 transition"
              >
                Conservar Cargo
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition"
              >
                Eliminar de Cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Status Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`px-4 py-3.5 rounded-xl shadow-xl font-semibold text-sm flex items-center gap-3 text-white ${
              toast.type === "error" ? "bg-rose-600" : "bg-slate-900"
            }`}
          >
            {toast.type === "error" ? (
              <svg className="w-5 h-5 text-rose-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}
