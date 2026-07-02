"use client";

import { useState, useEffect } from "react";
import {
  type Pago,
  actualizarEstadoPago,
  obtenerPagosPendientes,
  obtenerHistorialPagos,
} from "./actions";
import { useRouter } from "next/navigation";

type CobranzasClientProps = {
  initialPendientes: Pago[];
  initialHistorial: Pago[];
  isGlobalMode: boolean;
};

export default function CobranzasClient({
  initialPendientes,
  initialHistorial,
  isGlobalMode,
}: CobranzasClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"pendientes" | "historial">("pendientes");
  const [pendientes, setPendientes] = useState<Pago[]>(initialPendientes);
  const [historial, setHistorial] = useState<Pago[]>(initialHistorial);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [filterNombre, setFilterNombre] = useState("");
  const [filterCuil, setFilterCuil] = useState("");
  const [filterFecha, setFilterFecha] = useState("");

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    id: string;
    action: "Aprobado" | "Rechazado" | "Pendiente";
    title: string;
    message: string;
    requiresInput: boolean;
    confirmText: string;
    confirmClass: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState(false);

  // Toast
  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    setPendientes(initialPendientes);
  }, [initialPendientes]);

  useEffect(() => {
    setHistorial(initialHistorial);
  }, [initialHistorial]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRefresh = async () => {
    setLoading(true);
    const [pRes, hRes] = await Promise.all([
      obtenerPagosPendientes(),
      obtenerHistorialPagos(),
    ]);

    if (pRes.success && pRes.data) {
      setPendientes(pRes.data);
    } else if (pRes.error) {
      showToast("Error al refrescar pendientes: " + pRes.error, "error");
    }

    if (hRes.success && hRes.data) {
      setHistorial(hRes.data);
    } else if (hRes.error) {
      showToast("Error al refrescar historial: " + hRes.error, "error");
    }
    setLoading(false);
  };

  const handleAction = async (
    idPago: string,
    action: "Aprobado" | "Rechazado" | "Pendiente",
    reason: string = ""
  ) => {
    setLoading(true);
    const res = await actualizarEstadoPago(idPago, action, reason);
    setLoading(false);

    if (res.success) {
      showToast(
        action === "Aprobado"
          ? "Pago aprobado exitosamente."
          : action === "Rechazado"
          ? "Pago rechazado correctamente."
          : "Pago devuelto a estado pendiente."
      );
      handleRefresh();
    } else {
      showToast(res.error || "Ocurrió un error inesperado al procesar el pago.", "error");
    }
  };

  const openConfirmModal = (id: string, action: "Aprobado" | "Rechazado" | "Pendiente") => {
    setRejectionReason("");
    setRejectionError(false);

    if (action === "Rechazado") {
      setModalConfig({
        id,
        action,
        title: "Rechazar Pago",
        message: "Por favor, indique el motivo detallado del rechazo para notificar al alumno:",
        requiresInput: true,
        confirmText: "Confirmar Rechazo",
        confirmClass: "bg-rose-600 hover:bg-rose-700 text-white",
      });
      setShowModal(true);
    } else if (action === "Pendiente") {
      setModalConfig({
        id,
        action,
        title: "Corregir Estado",
        message: "¿Está seguro de devolver este comprobante al estado Pendiente?",
        requiresInput: false,
        confirmText: "Sí, corregir",
        confirmClass: "bg-slate-800 hover:bg-slate-900 text-white",
      });
      setShowModal(true);
    } else {
      // Aprobado va directo para agilizar el trabajo operativo
      handleAction(id, "Aprobado");
    }
  };

  const executeModalAction = () => {
    if (!modalConfig) return;

    if (modalConfig.requiresInput) {
      if (!rejectionReason.trim()) {
        setRejectionError(true);
        return;
      }
      handleAction(modalConfig.id, modalConfig.action, rejectionReason.trim());
    } else {
      handleAction(modalConfig.id, modalConfig.action);
    }

    setShowModal(false);
    setModalConfig(null);
  };

  // Filtrado de elementos
  const filterList = (lista: Pago[]) => {
    return lista.filter((p) => {
      const matchNombre =
        !filterNombre ||
        (p.alumno?.apellido_y_nombre || "")
          .toLowerCase()
          .includes(filterNombre.toLowerCase());
      const matchCuil =
        !filterCuil ||
        (p.alumno?.cuil || "").toLowerCase().includes(filterCuil.toLowerCase());
      
      let formattedFecha = "";
      if (p.fecha_pago) {
        const dateObj = new Date(p.fecha_pago);
        formattedFecha = dateObj.toLocaleDateString("es-AR");
      }
      const matchFecha =
        !filterFecha ||
        formattedFecha.toLowerCase().includes(filterFecha.toLowerCase());

      return matchNombre && matchCuil && matchFecha;
    });
  };

  const currentList = activeTab === "pendientes" ? pendientes : historial;
  const filteredList = filterList(currentList);

  const formatMoneda = (monto: number) => {
    return monto.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    });
  };

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return "-";
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString("es-AR", {
      timeZone: "UTC",
    });
  };

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-8 space-y-6">
      
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Cobranzas</h1>
          <p className="text-slate-500 font-medium italic">
            Panel de Validación Administrativa de Comprobantes
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18"
                />
              </svg>
            )}
            Actualizar Datos
          </button>
        </div>
      </div>

      {/* Selector de Pestañas (Tabs) */}
      <div className="flex gap-8 border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab("pendientes");
            setFilterNombre("");
            setFilterCuil("");
            setFilterFecha("");
          }}
          className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === "pendientes"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-400 hover:text-indigo-600"
          }`}
        >
          Pagos Pendientes ({pendientes.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("historial");
            setFilterNombre("");
            setFilterCuil("");
            setFilterFecha("");
          }}
          className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === "historial"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-400 hover:text-indigo-600"
          }`}
        >
          Historial de Decisiones
        </button>
      </div>

      {/* Contenedor Principal de la Tabla */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Controles de Filtrado */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Filtrar por Alumno
            </label>
            <input
              type="text"
              placeholder="Nombre del alumno..."
              value={filterNombre}
              onChange={(e) => setFilterNombre(e.target.value)}
              className="w-full text-sm p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Filtrar por CUIL
            </label>
            <input
              type="text"
              placeholder="CUIL del alumno..."
              value={filterCuil}
              onChange={(e) => setFilterCuil(e.target.value)}
              className="w-full text-sm p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Filtrar por Fecha
            </label>
            <input
              type="text"
              placeholder="Ej: DD/MM/AAAA..."
              value={filterFecha}
              onChange={(e) => setFilterFecha(e.target.value)}
              className="w-full text-sm p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none text-slate-800"
            />
          </div>
        </div>

        {/* Vista de Tabla */}
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="bg-slate-100/75">
              <tr>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                  Alumno
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                  CUIL
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                  Fecha Depósito
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase text-right border-b border-slate-200">
                  Monto
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase text-center border-b border-slate-200">
                  {activeTab === "pendientes" ? "Comprobante" : "Estado"}
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase text-center border-b border-slate-200">
                  Gestión
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4" />
                    <p className="text-slate-500 font-medium">Procesando datos contables...</p>
                  </td>
                </tr>
              ) : filteredList.length > 0 ? (
                filteredList.map((p) => {
                  let statusBadgeClass = "bg-slate-100 text-slate-700";
                  if (p.estado === "Aprobado") statusBadgeClass = "bg-emerald-100 text-emerald-700";
                  else if (p.estado === "Rechazado") statusBadgeClass = "bg-rose-100 text-rose-700";
                  else if (p.estado === "FACTURADO") statusBadgeClass = "bg-teal-100 text-teal-800 border border-teal-200";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/50 transition-colors duration-150"
                    >
                      <td className="p-4 font-bold text-slate-800">
                        {p.alumno?.apellido_y_nombre || "No empadronado"}
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-600">
                        {p.alumno?.cuil || "S/D"}
                      </td>
                      <td className="p-4 text-sm text-slate-500">
                        {formatDateStr(p.fecha_pago)}
                      </td>
                      <td className="p-4 text-right text-base font-black text-slate-900">
                        {formatMoneda(p.monto)}
                      </td>
                      <td className="p-4 text-center">
                        {activeTab === "pendientes" ? (
                          p.link ? (
                            <a
                              href={p.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-100 shadow-sm"
                            >
                              Ver Compr.
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sin archivo</span>
                          )
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${statusBadgeClass}`}
                            >
                              {p.estado}
                            </span>
                            {p.observacion && (
                              <span className="text-[10px] text-slate-400 max-w-[150px] truncate" title={p.observacion}>
                                {p.observacion}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          {activeTab === "pendientes" ? (
                            <>
                              <button
                                onClick={() => openConfirmModal(p.id, "Aprobado")}
                                className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-600 shadow-sm transition-all active:scale-95 cursor-pointer"
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => openConfirmModal(p.id, "Rechazado")}
                                className="bg-rose-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-rose-600 shadow-sm transition-all active:scale-95 cursor-pointer"
                              >
                                Rechazar
                              </button>
                            </>
                          ) : p.estado === "FACTURADO" ? (
                            <span
                              className="text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-not-allowed select-none bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
                              title="Comprobante legal emitido en ARCA. Modificación bloqueada."
                            >
                              Bloqueado
                            </span>
                          ) : (
                            <button
                              onClick={() => openConfirmModal(p.id, "Pendiente")}
                              className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-black transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                              Corregir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-slate-400 italic font-medium">
                    No se encontraron registros con los filtros indicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Personalizado */}
      {showModal && modalConfig && (
        <div className="fixed inset-0 bg-slate-900/60 flex justify-center items-center z-50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 transform transition-all text-center animate-in zoom-in-95 duration-200 border border-slate-100">
            <h3 className={`text-lg font-bold mb-2 ${
              modalConfig.action === "Rechazado" ? "text-rose-600" : "text-slate-800"
            }`}>
              {modalConfig.title}
            </h3>
            <p className="text-sm text-slate-600 mb-4 font-medium">{modalConfig.message}</p>

            {modalConfig.requiresInput && (
              <div className="mb-4">
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (e.target.value.trim()) setRejectionError(false);
                  }}
                  className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:outline-none text-sm bg-slate-50 text-slate-900 ${
                    rejectionError
                      ? "border-rose-500 focus:ring-rose-200"
                      : "border-slate-200 focus:ring-indigo-300"
                  }`}
                  placeholder="Ej: Comprobante ilegible / Monto inválido..."
                  autoFocus
                />
                {rejectionError && (
                  <p className="text-rose-600 text-xs text-left font-bold mt-1.5 ml-1">
                    Este campo es obligatorio.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-center gap-3 mt-5">
              <button
                onClick={() => {
                  setShowModal(false);
                  setModalConfig(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={executeModalAction}
                className={`px-4 py-2 text-sm font-bold rounded-lg shadow-sm cursor-pointer transition-colors ${modalConfig.confirmClass}`}
              >
                {modalConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificación Flotante (Toast) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`px-4 py-3.5 rounded-xl shadow-xl font-bold text-sm flex items-center gap-2.5 border ${
              toast.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-slate-800 text-white border-slate-700"
            }`}
          >
            {toast.type === "error" ? (
              <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span>{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
