"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  type PagoFacturacion,
  obtenerPagosParaFacturar,
  obtenerFacturasEmitidas,
  facturarPago,
  reintentarFacturacion,
  facturarPagosLote,
} from "./actions";

type FacturacionClientProps = {
  initialPendientes: PagoFacturacion[];
  initialHistorial: PagoFacturacion[];
  isGlobalMode: boolean;
};

type BulkResult = {
  id: string;
  nombre: string;
  monto: number;
  status: "pending" | "processing" | "success" | "error";
  details: string;
};

// Intervalo de auto-refresh cuando hay pagos en EN_PROCESO_AFIP (10 segundos)
const AUTO_REFRESH_INTERVAL = 10_000;

export default function FacturacionClient({
  initialPendientes,
  initialHistorial,
  isGlobalMode,
}: FacturacionClientProps) {
  const [activeTab, setActiveTab] = useState<"pendientes" | "historial">("pendientes");
  const [pendientes, setPendientes] = useState<PagoFacturacion[]>(initialPendientes);
  const [historial, setHistorial] = useState<PagoFacturacion[]>(initialHistorial);
  const [loading, setLoading] = useState(false);
  const [isBilling, setIsBilling] = useState(false);

  // Filtros
  const [filterNombre, setFilterNombre] = useState("");
  const [filterCuil, setFilterCuil] = useState("");
  const [filterFecha, setFilterFecha] = useState("");

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modales
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedPago, setSelectedPago] = useState<PagoFacturacion | null>(null);

  // Modal de procesamiento masivo
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkActive, setBulkActive] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);

  // Toast
  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Auto-refresh ref
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setPendientes(initialPendientes);
    setSelectedIds([]);
  }, [initialPendientes]);

  useEffect(() => {
    setHistorial(initialHistorial);
  }, [initialHistorial]);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleRefresh = useCallback(async (isBackground: boolean = false) => {
    if (!isBackground) setLoading(true);
    const [pRes, hRes] = await Promise.all([
      obtenerPagosParaFacturar(),
      obtenerFacturasEmitidas(),
    ]);

    if (pRes.success && pRes.data) {
      setPendientes(pRes.data);
    } else if (pRes.error && !isBackground) {
      showToast("Error al refrescar pendientes: " + pRes.error, "error");
    }

    if (hRes.success && hRes.data) {
      setHistorial(hRes.data);
    } else if (hRes.error && !isBackground) {
      showToast("Error al refrescar historial: " + hRes.error, "error");
    }
    if (!isBackground) setLoading(false);
  }, []);

  // Auto-refresh: cuando hay pagos EN_PROCESO_AFIP, polling cada 10s
  useEffect(() => {
    const hayEnProceso = pendientes.some((p) => p.estado === "EN_PROCESO_AFIP");

    if (hayEnProceso) {
      // Iniciar auto-refresh si no está corriendo
      if (!autoRefreshRef.current) {
        autoRefreshRef.current = setInterval(() => {
          handleRefresh(true);
        }, AUTO_REFRESH_INTERVAL);
      }
    } else {
      // No hay pagos en proceso, limpiar intervalo
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    }

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [pendientes, handleRefresh]);

  // Facturar un pago individual (fire-and-forget)
  const handleEmitirFactura = async (pago: PagoFacturacion) => {
    setIsBilling(true);
    showToast(
      `Enviando solicitud de facturación para ${pago.alumno?.apellido_y_nombre || "el alumno"}...`,
      "info"
    );

    // Optimistic UI update: bloqueamos inmediatamente el botón mostrándolo en proceso
    setPendientes((prev) => 
      prev.map(p => p.id === pago.id ? { ...p, estado: "EN_PROCESO_AFIP" } : p)
    );

    const res = await facturarPago(pago.id);

    if (res.success) {
      showToast(
        res.message || "Solicitud enviada. Esperando respuesta de AFIP...",
        "success"
      );
      await handleRefresh();
    } else {
      showToast(res.error || "Ocurrió un error al enviar la solicitud.", "error");
      await handleRefresh();
    }
    
    setIsBilling(false);
  };

  // Reintentar facturación de un pago con error
  const handleReintentar = async (pago: PagoFacturacion) => {
    setIsBilling(true);
    showToast(`Reintentando facturación para ${pago.alumno?.apellido_y_nombre || "el alumno"}...`, "info");

    // Optimistic UI update
    setPendientes((prev) => 
      prev.map(p => p.id === pago.id ? { ...p, estado: "EN_PROCESO_AFIP" } : p)
    );

    const res = await reintentarFacturacion(pago.id);

    if (res.success) {
      showToast(
        res.message || "Reintento enviado. Esperando respuesta de AFIP...",
        "success"
      );
      await handleRefresh();
    } else {
      showToast(res.error || "Ocurrió un error al reintentar la facturación.", "error");
      await handleRefresh();
    }
    
    setIsBilling(false);
  };

  // Facturar selección múltiple mediante endpoint de Lote
  const handleEmitirFacturaMasiva = async () => {
    setShowBulkModal(true);
    setBulkActive(true);

    const idsToProcess = [...selectedIds];
    const initialResults: BulkResult[] = idsToProcess.map((id) => {
      const p = pendientes.find((item) => item.id === id);
      return {
        id,
        nombre: p?.alumno?.apellido_y_nombre || "Alumno",
        monto: p?.monto || 0,
        status: "processing" as const, // Mostrar como en proceso inmediatamente
        details: "Añadiendo al lote...",
      };
    });
    setBulkResults(initialResults);
    setBulkProgress(idsToProcess.length);

    try {
      const res = await facturarPagosLote(idsToProcess);
      
      if (res.success) {
        setBulkResults((prev) =>
          prev.map((r) => ({
            ...r,
            status: "success" as const,
            details: "Enviado al lote de AFIP",
          }))
        );
      } else {
        setBulkResults((prev) =>
          prev.map((r) => ({
            ...r,
            status: "error" as const,
            details: res.error || "Fallo al enviar lote",
          }))
        );
      }
    } catch (err: any) {
      setBulkResults((prev) =>
        prev.map((r) => ({
          ...r,
          status: "error" as const,
          details: err.message || "Fallo de red conectando al lote",
        }))
      );
    }

    setBulkActive(false);
    setSelectedIds([]);
    await handleRefresh();
  };

  const openConfirm = (pago: PagoFacturacion) => {
    setSelectedPago(pago);
    setShowConfirmModal(true);
  };

  const executeConfirm = () => {
    if (!selectedPago) return;
    setShowConfirmModal(false);
    handleEmitirFactura(selectedPago);
  };

  // Filtrado de elementos
  const filterList = (lista: PagoFacturacion[]) => {
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

  // Extrae el DNI formateado del alumno a partir de su CUIL de 11 dígitos
  const getDocumentoFormateado = (cuil: string) => {
    const raw = (cuil || "").replace(/\D/g, "");
    if (raw.length === 11) {
      return `DNI ${parseInt(raw.substring(2, 10), 10)}`;
    }
    return `DNI ${raw || "S/D"}`;
  };

  // Manejar el checkbox maestro
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Solo seleccionar pendientes que no estén en proceso o con estado no facturable
      const facturables = filteredList
        .filter((p) => p.estado === "Aprobado" || p.estado === "ERROR_FACTURACION")
        .map((p) => p.id);
      setSelectedIds(facturables);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  // Indicador visual de la cantidad en proceso
  const enProcesoCount = pendientes.filter((p) => p.estado === "EN_PROCESO_AFIP").length;
  const errorCount = pendientes.filter((p) => p.estado === "ERROR_FACTURACION").length;

  // Badge de estado
  const renderEstadoBadge = (estado: string) => {
    switch (estado) {
      case "EN_PROCESO_AFIP":
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-600 border-t-transparent" />
            Generando factura...
          </div>
        );
      case "ERROR_FACTURACION":
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Error AFIP
          </div>
        );
      case "Aprobado":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
            Listo para facturar
          </span>
        );
      default:
        return <span className="text-xs text-slate-400 italic">{estado}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-8 space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-300">
            Facturación Fiscal ⚖️
          </h1>
          <p className="text-slate-500 font-medium italic">
            Módulo Fiscal Centralizado para Emisión de Comprobantes ante AFIP (ARCA)
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {/* Indicadores de estado rápido */}
          {enProcesoCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-xs font-bold text-amber-700 animate-pulse">
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-amber-600 border-t-transparent" />
              {enProcesoCount} en proceso AFIP
            </div>
          )}
          {errorCount > 0 && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl text-xs font-bold text-rose-700">
              🔴 {errorCount} con error
            </div>
          )}
          <button
            onClick={() => handleRefresh(false)}
            disabled={loading || isBilling || bulkActive}
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

      {/* Tarjeta Informativa de Seguridad */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 md:p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row items-center gap-4">
        <div className="w-12 h-12 bg-amber-500/15 rounded-xl flex items-center justify-center text-amber-500 shrink-0 text-2xl select-none animate-pulse">
          ⚠️
        </div>
        <div className="space-y-1">
          <h4 className="font-extrabold text-sm uppercase tracking-wider text-amber-400">
            Aviso de Responsabilidad Fiscal
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            La emisión de facturas o recibos a través de este módulo se conecta en tiempo real a la API de
            AFIP (ARCA) y tiene efectos impositivos legales y permanentes. El proceso es asíncrono: tras
            enviar la solicitud, el resultado (éxito o error) se actualizará automáticamente cuando AFIP
            responda. Revise los datos exhaustivamente antes de confirmar.
          </p>
        </div>
      </div>

      {/* Floating Action Bar para Facturación Masiva */}
      {activeTab === "pendientes" && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white/95 border border-indigo-100 text-slate-800 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-5 fade-in duration-300 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-sm font-black text-indigo-950">Facturación Conjunta</span>
            <span className="text-xs text-slate-500 font-medium">
              Hay <strong>{selectedIds.length}</strong> comprobantes seleccionados para procesar.
            </span>
          </div>
          <button
            onClick={handleEmitirFacturaMasiva}
            disabled={isBilling || bulkActive}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            Emitir {selectedIds.length} Facturas
          </button>
        </div>
      )}

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
          Pendientes de Facturación ({pendientes.length})
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
          Comprobantes Emitidos ({historial.length})
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
              Filtrar por Fecha Cobro
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
        <div className="overflow-x-auto max-h-[60vh] scrollbar-thin">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="bg-slate-100/75">
              <tr>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 border-b border-slate-200 w-12 text-center">
                  {activeTab === "pendientes" && (
                    <input
                      type="checkbox"
                      className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={
                        filteredList.length > 0 &&
                        selectedIds.length ===
                          filteredList.filter((p) => p.estado === "Aprobado" || p.estado === "ERROR_FACTURACION").length &&
                        selectedIds.length > 0
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  )}
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                  Alumno
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                  CUIL / Documento
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                  Fecha Depósito
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase text-right border-b border-slate-200">
                  Monto Cobrado
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase text-center border-b border-slate-200">
                  {activeTab === "pendientes" ? "Estado" : "CAE Factura"}
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase text-center border-b border-slate-200">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4" />
                    <p className="text-slate-500 font-medium">Cargando transacciones...</p>
                  </td>
                </tr>
              ) : filteredList.length > 0 ? (
                filteredList.map((p) => {
                  const isEnProceso = p.estado === "EN_PROCESO_AFIP";
                  const isError = p.estado === "ERROR_FACTURACION";
                  const isFacturable = p.estado === "Aprobado" || isError;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/50 transition-colors duration-150 ${
                        isError ? "bg-rose-50/30" : ""
                      }`}
                    >
                      <td className="p-4 w-12 text-center border-b border-slate-100">
                        {activeTab === "pendientes" && isFacturable && (
                          <input
                            type="checkbox"
                            className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={selectedIds.includes(p.id)}
                            onChange={(e) => handleSelectRow(p.id, e.target.checked)}
                          />
                        )}
                        {activeTab === "historial" && (
                          <span className="text-xs text-emerald-500 font-bold">✓</span>
                        )}
                        {isEnProceso && (
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-600 border-t-transparent mx-auto" />
                        )}
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        {p.alumno?.apellido_y_nombre || "No empadronado"}
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-600">
                        <div className="flex flex-col">
                          <span>{p.alumno?.cuil || "S/D"}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            {p.alumno?.cuil ? getDocumentoFormateado(p.alumno.cuil) : ""}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-500">
                        {formatDateStr(p.fecha_pago)}
                      </td>
                      <td className="p-4 text-right text-base font-black text-slate-900">
                        {formatMoneda(p.monto)}
                      </td>
                      <td className="p-4 text-center">
                        {activeTab === "pendientes" ? (
                          <div className="flex flex-col items-center gap-1">
                            {renderEstadoBadge(p.estado)}
                            {isError && p.error_detalle && (
                              <span
                                className="text-[9px] text-rose-500 font-medium max-w-[180px] truncate block"
                                title={p.error_detalle}
                              >
                                {p.error_detalle}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded border border-slate-200 shadow-sm">
                              {p.cae || "S/D"}
                            </span>
                            {p.nro_comprobante && p.punto_venta && (
                              <span className="text-[9px] text-slate-400 font-bold mt-1">
                                PV {String(p.punto_venta).padStart(4, "0")}-{String(p.nro_comprobante).padStart(8, "0")}
                              </span>
                            )}
                            {p.cuit_emisor && (
                              <span className="text-[9px] text-slate-400 font-bold">
                                CUIT Emisor: {p.cuit_emisor}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {activeTab === "pendientes" ? (
                          isEnProceso ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-600 border-t-transparent" />
                              Esperando AFIP...
                            </div>
                          ) : isError ? (
                            <button
                              onClick={() => handleReintentar(p)}
                              disabled={isBilling || bulkActive}
                              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-xs font-extrabold uppercase shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 mx-auto"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
                              </svg>
                              Reintentar
                            </button>
                          ) : (
                            <button
                              onClick={() => openConfirm(p)}
                              disabled={isBilling || bulkActive}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-extrabold uppercase shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                              Emitir Factura
                            </button>
                          )
                        ) : p.factura_url ? (
                          <a
                            href={p.factura_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-teal-500 hover:bg-teal-600 text-white px-3.5 py-2 rounded-lg text-xs font-black uppercase shadow-sm transition-all active:scale-95"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.5"
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            Descargar Factura
                          </a>
                        ) : (
                          <span className="text-xs text-rose-500 font-bold italic">PDF No Disponible</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-20 text-center text-slate-400 italic font-medium">
                    No se encontraron registros con los filtros indicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmación Fiscal Individual */}
      {showConfirmModal && selectedPago && (
        <div className="fixed inset-0 bg-slate-900/60 flex justify-center items-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md transform transition-all animate-in scale-in duration-200 border border-slate-100 text-slate-800">
            <h3 className="text-lg font-black text-slate-900 border-b pb-3 mb-4 flex items-center gap-2">
              ⚖️ Confirmar Emisión Fiscal
            </h3>

            <p className="text-sm text-slate-600 mb-5 leading-relaxed font-medium">
              Por favor, valide los datos del cobro que serán enviados al Facturador ARCA para generar el comprobante legal:
            </p>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-sm">
              <div className="flex justify-between border-b border-slate-200/50 pb-2">
                <span className="text-slate-400 font-bold text-xs uppercase">Alumno / Tutor:</span>
                <span className="font-extrabold text-slate-800">{selectedPago.alumno?.apellido_y_nombre}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/50 pb-2">
                <span className="text-slate-400 font-bold text-xs uppercase">Documento / CUIT:</span>
                <span className="font-mono font-bold text-slate-700">{selectedPago.alumno?.cuil || "S/D"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/50 pb-2">
                <span className="text-slate-400 font-bold text-xs uppercase">Domicilio Fiscal:</span>
                <span className="font-bold text-slate-700 max-w-[200px] truncate" title={selectedPago.alumno?.domicilio || "No Declarado"}>
                  {selectedPago.alumno?.domicilio || "No Declarado"}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-400 font-bold text-xs uppercase">Monto Total Facturado:</span>
                <span className="text-lg font-black text-slate-900">{formatMoneda(selectedPago.monto)}</span>
              </div>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-lg mb-6 text-xs text-amber-800 leading-relaxed font-medium">
              <strong>IMPORTANTE:</strong> Al confirmar, la solicitud será enviada al Facturador ARCA. El comprobante se generará
              de forma asíncrona y su estado se actualizará automáticamente cuando AFIP responda.
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedPago(null);
                }}
                disabled={isBilling}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeConfirm}
                disabled={isBilling}
                className="px-5 py-2.5 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-md cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isBilling && (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                )}
                Confirmar Emisión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Progreso de Facturación Masiva */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/70 flex justify-center items-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg transform transition-all animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[85vh] text-slate-800">
            <h3 className="text-lg font-black text-slate-900 border-b pb-3 mb-4 flex items-center justify-between">
              <span>⚖️ Facturación Masiva Conjunta</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                {bulkProgress} de {bulkResults.length}
              </span>
            </h3>

            {/* Barra de Progreso */}
            <div className="space-y-1.5 mb-6">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Progreso General</span>
                <span>{Math.round((bulkProgress / bulkResults.length) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(bulkProgress / bulkResults.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Lista scrollable de resultados */}
            <div className="flex-grow overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-2 mb-6 scrollbar-thin">
              {bulkResults.map((result) => {
                let statusBadge = "bg-slate-100 text-slate-500 border-slate-200";
                let statusIcon = "⚪";
                let statusLabel = "En espera";

                if (result.status === "processing") {
                  statusBadge = "bg-amber-50 text-amber-700 border-amber-200 font-black";
                  statusIcon = "⏳";
                  statusLabel = "Enviando...";
                } else if (result.status === "success") {
                  statusBadge = "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold";
                  statusIcon = "🟢";
                  statusLabel = "Enviado";
                } else if (result.status === "error") {
                  statusBadge = "bg-rose-50 text-rose-800 border-rose-200 font-bold";
                  statusIcon = "🔴";
                  statusLabel = "Fallo";
                }

                return (
                  <div
                    key={result.id}
                    className="p-3 border rounded-xl bg-white flex items-center justify-between shadow-sm transition-all"
                  >
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className="font-bold text-xs text-slate-800 truncate">
                        {result.nombre}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {formatMoneda(result.monto)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {result.status === "processing" && (
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-600 border-t-transparent" />
                      )}
                      {result.details && (
                        <span className="text-[10px] font-bold text-slate-500 max-w-[150px] truncate" title={result.details}>
                          {result.details}
                        </span>
                      )}
                      <span className={`border px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider flex items-center gap-1 ${statusBadge}`}>
                        <span>{statusIcon}</span>
                        <span>{statusLabel}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkResults([]);
                }}
                disabled={bulkActive}
                className="px-6 py-3 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md cursor-pointer transition-colors disabled:opacity-50"
              >
                {bulkActive ? "Enviando a AFIP..." : "Cerrar Panel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificación Flotante (Toast) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`px-4 py-3.5 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-2.5 border max-w-md ${
              toast.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : toast.type === "info"
                ? "bg-blue-50 text-blue-800 border-blue-200"
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
            ) : toast.type === "info" ? (
              <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
