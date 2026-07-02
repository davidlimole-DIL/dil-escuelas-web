"use client";

import { useEffect, useState } from "react";
import { obtenerDatosDashboard } from "../actions";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

export default function DirectivoDashboard() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Inicializar fechas (del primero del mes anterior a hoy)
    const hoy = new Date();
    const strHasta = hoy.toISOString().split('T')[0];
    const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    
    const yyyy = mesAnterior.getFullYear();
    const mm = String(mesAnterior.getMonth() + 1).padStart(2, '0');
    const dd = String(mesAnterior.getDate()).padStart(2, '0');
    const strDesde = `${yyyy}-${mm}-${dd}`;

    setDesde(strDesde);
    setHasta(strHasta);
  }, []);

  useEffect(() => {
    if (desde && hasta) {
      cargarDatos();
    }
  }, [desde, hasta]);

  const cargarDatos = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await obtenerDatosDashboard(desde, hasta);
      setData(res);
    } catch (err: any) {
      setErrorMsg("Error de renderizado: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatMoneda = (valor: number) => 
    Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });

  // Configuración de Colores Fijos
  const colorFirme = "#4f46e5"; // Indigo 600
  const coloresEstados: Record<string, string> = { 
    'Activo': '#10b981', 
    'Suspendido': '#f59e0b', 
    'Abandono': '#f43f5e', 
    'Inactivo': '#94a3b8', 
    'No Definido': '#e2e8f0' 
  };

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-8">
      
      {/* Header Institucional (Idéntico a Dashboard.html) */}
      {data && (
        <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div 
              className="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg border-2 flex-shrink-0" 
              style={{ borderColor: `${data.colegio.color}33`, backgroundColor: `${data.colegio.color}11` }}
            >
              {/* Logo genérico DIL si no hay imagen provista */}
              <svg className="w-8 h-8" style={{ color: data.colegio.color }} fill="currentColor" viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 2.3L6.46 8.4 12 11.5l5.54-3.1L12 5.3zm-6.55 4.3v7.3l5.55 3.12v-7.3l-5.55-3.12zm13.1 0l-5.55 3.12v7.3l5.55-3.12v-7.3z"/></svg>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.colegio.nombre}</h1>
              <p className="font-semibold italic text-sm" style={{ color: data.colegio.color }}>Tablero Gerencial y Control Financiero</p>
            </div>
          </div>
        </header>
      )}

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          Periodo de Análisis (KPIs):
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Desde</label>
            <input 
              type="date" 
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-indigo-600 focus:border-indigo-600 block px-3 py-2 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Hasta</label>
            <input 
              type="date" 
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-indigo-600 focus:border-indigo-600 block px-3 py-2 outline-none"
            />
          </div>
          <button 
            onClick={cargarDatos}
            disabled={loading}
            className="bg-slate-900 hover:bg-black disabled:bg-slate-400 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-md flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
            Aplicar Filtro
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="py-12 text-center flex flex-col justify-center items-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent mb-4"></div>
          <p className="text-slate-600 font-bold">Procesando cubos de datos...</p>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-100 text-rose-700 p-6 rounded-xl border border-rose-200 shadow-sm max-w-md mx-auto my-8">
          <p className="font-extrabold text-lg">Error de Carga</p>
          <p className="text-[11px] font-mono bg-white/50 p-3 mt-2 rounded-lg border border-rose-200">{errorMsg}</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
          
          {/* Tarjetas KPI */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 hover:border-indigo-600 transition-colors cursor-default">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13.288 9.646a7.001 7.001 0 001.278-4.354z"></path></svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Matrícula Activa</p>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{data.kpis.alumnosActivos}</p>
                <p className="text-xs text-slate-400">Total: <span>{data.kpis.alumnosTotales}</span></p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 hover:border-indigo-600 transition-colors cursor-default">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cobranza del Periodo</p>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{formatMoneda(data.kpis.totalRecaudadoPeriodo)}</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 hover:border-indigo-600 transition-colors cursor-default">
              <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Devengo del Periodo</p>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{formatMoneda(data.kpis.totalDevengadoPeriodo)}</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 hover:border-indigo-600 transition-colors cursor-default">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Morosidad en Periodo</p>
                <p className="text-3xl font-extrabold text-rose-600 tracking-tight">{data.kpis.indiceMorosidad} %</p>
                <p className="text-xs text-rose-400">Brecha: <span>{formatMoneda(data.kpis.morosidadTotal)}</span></p>
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                Evolución Financiera Histórica (6 Meses)
              </h3>
              <div className="h-80 w-full relative">
                <Line 
                  data={{
                    labels: data.charts.lineaMeses || [],
                    datasets: [
                      {
                        label: 'Devengo (Proyectado)',
                        data: data.charts.lineaDevengado || [],
                        borderColor: '#cbd5e1',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.3,
                        fill: false
                      },
                      {
                        label: 'Recaudación (Real)',
                        data: data.charts.lineaRecaudado || [],
                        borderColor: colorFirme,
                        backgroundColor: 'rgba(79, 70, 229, 0.10)',
                        borderWidth: 3,
                        pointBackgroundColor: 'white',
                        pointBorderColor: colorFirme,
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        tension: 0.3,
                        fill: true
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top', labels: { boxWidth: 15, usePointStyle: true, font: { size: 12, weight: 500 } } }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: function(value) { return '$ ' + Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0 }); },
                          font: { size: 10 }
                        },
                        grid: { color: '#f1f5f9' }
                      },
                      x: {
                        grid: { display: false },
                        ticks: { font: { size: 11, weight: 500 } }
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.003 9.003 0 003.055 11H11V3.055zM13 3.055V11h7.945A9.003 9.003 0 0013 3.055zM11 13H3.055A9.003 9.003 0 0011 20.945V13zM13 13v7.945A9.003 9.003 0 0020.945 13H13z"></path></svg>
                Composición de Matrícula
              </h3>
              <div className="h-80 w-full relative flex justify-center items-center">
                <Doughnut 
                  data={{
                    labels: data.charts.donutMatriculaLabels || [],
                    datasets: [{
                      data: data.charts.donutMatriculaDatos || [],
                      backgroundColor: (data.charts.donutMatriculaLabels || []).map((label: string) => coloresEstados[label] || coloresEstados['No Definido']),
                      borderWidth: 3,
                      borderColor: 'white',
                      hoverOffset: 8
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                      legend: { position: 'bottom', labels: { boxWidth: 12, padding: 20, font: { size: 12 } } }
                    }
                  }}
                />
              </div>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
