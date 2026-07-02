"use client";

import { useState, useEffect } from "react";
import { getMasterData, crearColegio, crearUsuario, eliminarColegio, editarColegio, eliminarUsuario, editarUsuario } from "./actions";

type Colegio = {
  id: string;
  nombre: string;
  color_institucional: string;
  codigo: string;
  cuit: string | null;
  arca_habilitado: boolean;
  arca_api_key: string | null;
  arca_punto_venta: number | null;
  arca_concepto: number | null;
};
type Perfil = { id: string; colegio_id: string; nombre_completo: string; email: string; rol: string[] };

const AVAILABLE_ROLES = [
  { id: "directivo", label: "Directivo" },
  { id: "cobranzas", label: "Cobranzas" },
  { id: "devengos", label: "Devengos" },
  { id: "academico", label: "Académico" },
  { id: "legajos", label: "Legajos" },
  { id: "facturacion", label: "Facturación" },
  { id: "superadmin", label: "SuperAdmin (DIL)" }
];

export default function MasterAdminPage() {
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Form states
  const [colNombre, setColNombre] = useState("");
  const [colColor, setColColor] = useState("#4f46e5");
  const [colCodigo, setColCodigo] = useState("");
  const [colCuit, setColCuit] = useState("");
  const [colArcaHabilitado, setColArcaHabilitado] = useState(false);
  const [colArcaApiKey, setColArcaApiKey] = useState("");
  const [colArcaPuntoVenta, setColArcaPuntoVenta] = useState("");
  const [colArcaConcepto, setColArcaConcepto] = useState("2");
  
  const [usrNombre, setUsrNombre] = useState("");
  const [usrEmail, setUsrEmail] = useState("");
  const [usrPassword, setUsrPassword] = useState("");
  const [usrRol, setUsrRol] = useState<string[]>(["directivo"]);
  const [usrColId, setUsrColId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit states
  const [editColModal, setEditColModal] = useState<Colegio | null>(null);
  const [editUsrModal, setEditUsrModal] = useState<(Perfil & { newPassword?: string }) | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await getMasterData();
      setColegios(res.colegios || []);
      
      // Asegurarnos que rol sea siempre un array
      const perfilesMapeados = (res.perfiles || []).map((p: any) => ({
        ...p,
        rol: Array.isArray(p.rol) ? p.rol : [p.rol].filter(Boolean)
      }));
      setPerfiles(perfilesMapeados);
      
      if (res.colegios && res.colegios.length > 0 && !usrColId) {
        setUsrColId(res.colegios[0].id);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearColegio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colCodigo) return alert("Ingrese un código para el colegio");
    setIsSubmitting(true);
    const arcaConfig = colArcaHabilitado ? {
      arca_habilitado: true,
      arca_api_key: colArcaApiKey,
      arca_punto_venta: colArcaPuntoVenta ? parseInt(colArcaPuntoVenta, 10) : null,
      arca_concepto: parseInt(colArcaConcepto, 10) || 2,
    } : { arca_habilitado: false, arca_api_key: "", arca_punto_venta: null, arca_concepto: 2 };
    
    const res = await crearColegio(colNombre, colColor, colCodigo, colCuit, arcaConfig);
    setIsSubmitting(false);
    if (res.success) {
      setColNombre("");
      setColCodigo("");
      setColCuit("");
      setColArcaHabilitado(false);
      setColArcaApiKey("");
      setColArcaPuntoVenta("");
      setColArcaConcepto("2");
      cargarDatos();
    } else {
      alert("Error: " + res.error);
    }
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usrColId) return alert("Seleccione un colegio");
    if (usrRol.length === 0) return alert("Seleccione al menos un rol");
    setIsSubmitting(true);
    const res = await crearUsuario(usrEmail, usrPassword, usrNombre, usrRol, usrColId);
    setIsSubmitting(false);
    if (res.success) {
      setUsrNombre(""); setUsrEmail(""); setUsrPassword(""); setUsrRol(["directivo"]);
      cargarDatos();
    } else {
      alert("Error: " + res.error);
    }
  };

  const handleDeleteColegio = async (id: string) => {
    if (!window.confirm("¿Está seguro que desea eliminar este colegio? Esto puede fallar si tiene usuarios o alumnos asignados.")) return;
    const res = await eliminarColegio(id);
    if (res.success) cargarDatos();
    else alert(res.error);
  };

  const handleEditColegio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editColModal) return;
    if (!editColModal.codigo) return alert("El código del colegio es obligatorio");
    setIsSubmitting(true);
    const arcaConfig = editColModal.arca_habilitado ? {
      arca_habilitado: true,
      arca_api_key: editColModal.arca_api_key || "",
      arca_punto_venta: editColModal.arca_punto_venta,
      arca_concepto: editColModal.arca_concepto || 2,
    } : { arca_habilitado: false, arca_api_key: "", arca_punto_venta: null, arca_concepto: 2 };

    const res = await editarColegio(editColModal.id, editColModal.nombre, editColModal.color_institucional, editColModal.codigo, editColModal.cuit || "", arcaConfig);
    setIsSubmitting(false);
    if (res.success) {
      setEditColModal(null);
      cargarDatos();
    } else {
      alert("Error: " + res.error);
    }
  };

  const handleDeleteUsuario = async (id: string) => {
    if (!window.confirm("¿Está seguro que desea eliminar este usuario de forma permanente?")) return;
    const res = await eliminarUsuario(id);
    if (res.success) cargarDatos();
    else alert(res.error);
  };

  const handleEditUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUsrModal) return;
    if (editUsrModal.rol.length === 0) return alert("Seleccione al menos un rol");
    setIsSubmitting(true);
    const res = await editarUsuario(editUsrModal.id, editUsrModal.email, editUsrModal.nombre_completo, editUsrModal.rol, editUsrModal.colegio_id, editUsrModal.newPassword);
    setIsSubmitting(false);
    if (res.success) {
      setEditUsrModal(null);
      cargarDatos();
    } else {
      alert("Error: " + res.error);
    }
  };

  const toggleRoleCreation = (roleId: string) => {
    setUsrRol(prev => prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]);
  };

  if (loading && colegios.length === 0) return <div className="p-10 text-center">Cargando Master Panel...</div>;
  if (errorMsg) return <div className="p-10 text-rose-600 font-bold bg-rose-50 m-4 rounded-xl border border-rose-200">ACCESO DENEGADO: {errorMsg}</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <header className="mb-8 border-b pb-4 border-slate-200 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Master Admin 👑</h1>
          <p className="text-slate-500 font-medium">Gestión Multi-Inquilino (Colegios y Usuarios)</p>
        </div>
        <button onClick={() => window.location.href = '/dashboard/directivo'} className="text-sm font-bold bg-white border px-4 py-2 rounded-xl text-slate-600 hover:text-indigo-600 transition-all shadow-sm">
          Ir a Dashboard
        </button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Panel Colegios */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Registrar Institución</h3>
            <form onSubmit={handleCrearColegio} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre</label>
                  <input required type="text" value={colNombre} onChange={e => setColNombre(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Ej: Colegio San José" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Código del Colegio</label>
                  <input required type="text" value={colCodigo} onChange={e => setColCodigo(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="Ej: SAN-JOSE" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Color Institucional</label>
                  <input required type="color" value={colColor} onChange={e => setColColor(e.target.value)} className="h-9 w-full rounded cursor-pointer border-none" />
                </div>
              </div>

              {/* Toggle ARCA */}
              <div className="border-t border-slate-100 pt-4 mt-2">
                <label className="flex items-center gap-3 cursor-pointer group w-max">
                  <input type="checkbox" checked={colArcaHabilitado} onChange={e => setColArcaHabilitado(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  <div>
                    <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">Emite factura por ARCA</span>
                    <p className="text-[10px] text-slate-400">Habilitar facturación electrónica AFIP para esta institución</p>
                  </div>
                </label>
              </div>

              {/* Campos ARCA (condicionales) */}
              {colArcaHabilitado && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider">Configuración ARCA / AFIP</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Cabecera de Autenticación (x-api-key) *</label>
                      <input required type="password" value={colArcaApiKey} onChange={e => setColArcaApiKey(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="dil_sec_..." />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">CUIT Emisor *</label>
                      <input required type="text" value={colCuit} onChange={e => setColCuit(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="Ej: 30-70843096-6" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Punto de Venta</label>
                      <input type="number" min="1" max="99999" value={colArcaPuntoVenta} onChange={e => setColArcaPuntoVenta(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="Ej: 3 (opcional)" />
                      <p className="text-[10px] text-slate-400 mt-0.5">Si no se indica, ARCA usa el primero registrado</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Concepto *</label>
                      <select value={colArcaConcepto} onChange={e => setColArcaConcepto(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-700 bg-white outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="1">1 - Productos</option>
                        <option value="2">2 - Servicios</option>
                        <option value="3">3 - Productos y Servicios</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button disabled={isSubmitting} type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  Crear Institución
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-slate-100 p-3 font-bold text-slate-600 text-sm border-b border-slate-200">Instituciones Activas ({colegios.length})</div>
             <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
               {colegios.map(col => (
                 <div key={col.id} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between hover:bg-slate-50 group">
                   <div className="flex items-center gap-3">
                     <div className="w-4 h-4 rounded-full border border-slate-200 shadow-inner" style={{ backgroundColor: col.color_institucional }}></div>
                     <div>
                        <p className="font-bold text-slate-800 text-sm">{col.nombre}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          CÓDIGO: <span className="font-bold text-indigo-600">{col.codigo || "SIN ASIGNAR"}</span>
                          {col.cuit && <> • CUIT: <span className="font-bold text-emerald-600">{col.cuit.replace(/(\d{2})(\d{8})(\d{1})/, '$1-$2-$3')}</span></>}
                          {" "}•{" "}
                          {col.arca_habilitado ? (
                            <span className="font-bold text-indigo-600">✅ ARCA</span>
                          ) : (
                            <span className="font-bold text-slate-400">Sin ARCA</span>
                          )}
                        </p>
                     </div>
                   </div>
                   <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => setEditColModal(col)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Editar">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                     </button>
                     <button onClick={() => handleDeleteColegio(col.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg" title="Eliminar">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                     </button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>

        {/* Panel Usuarios */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Nuevo Usuario / Staff</h3>
            <form onSubmit={handleCrearUsuario} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Colegio Asignado</label>
                <select value={usrColId} onChange={e => setUsrColId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500">
                  {colegios.map(col => <option key={col.id} value={col.id}>{col.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre Completo</label>
                <input required type="text" value={usrNombre} onChange={e => setUsrNombre(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                <input required type="email" value={usrEmail} onChange={e => setUsrEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Contraseña Temporal</label>
                <input required type="text" value={usrPassword} onChange={e => setUsrPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-2">Roles de Acceso (Múltiples)</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_ROLES.map(role => (
                    <label key={role.id} className={`cursor-pointer px-3 py-1.5 rounded-lg border text-sm flex items-center gap-2 transition-colors \${usrRol.includes(role.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                        checked={usrRol.includes(role.id)}
                        onChange={() => toggleRoleCreation(role.id)}
                      />
                      {role.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-span-2 flex justify-end mt-2">
                <button disabled={isSubmitting} type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  Registrar Cuenta
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-slate-100 p-3 font-bold text-slate-600 text-sm border-b border-slate-200">Nómina Global ({perfiles.length})</div>
             <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
               {perfiles.map(perf => (
                 <div key={perf.id} className="p-3 border border-slate-100 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-slate-50 group gap-2">
                   <div>
                     <div className="flex items-center gap-2">
                       <p className="font-bold text-slate-800 text-sm">{perf.nombre_completo}</p>
                     </div>
                     <p className="text-xs text-slate-500">{perf.email}</p>
                     <p className="text-[10px] text-indigo-500 mt-1 uppercase font-semibold">{colegios.find(c => c.id === perf.colegio_id)?.nombre || "Colegio Eliminado"}</p>
                   </div>
                   <div className="flex flex-col items-end gap-2">
                     <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                        {perf.rol.map(r => (
                          <span key={r} className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded tracking-wider \${r === 'superadmin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                            {r}
                          </span>
                        ))}
                     </div>
                     <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => setEditUsrModal({...perf, newPassword: ""})} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Editar">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                       </button>
                       <button onClick={() => handleDeleteUsuario(perf.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg" title="Eliminar">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                       </button>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>

      {/* Edit Colegio Modal */}
      {editColModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex justify-between">
              <h3 className="font-bold text-slate-800">Editar Institución</h3>
              <button onClick={() => setEditColModal(null)} className="text-slate-400 hover:text-slate-600">X</button>
            </div>
            <form onSubmit={handleEditColegio} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-thin">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre</label>
                <input required type="text" value={editColModal.nombre} onChange={e => setEditColModal({...editColModal, nombre: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Código del Colegio</label>
                <input required type="text" value={editColModal.codigo || ""} onChange={e => setEditColModal({...editColModal, codigo: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="Ej: SAN-JOSE" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Color Institucional</label>
                <input required type="color" value={editColModal.color_institucional} onChange={e => setEditColModal({...editColModal, color_institucional: e.target.value})} className="h-9 w-full rounded cursor-pointer border-none" />
              </div>

              {/* Toggle ARCA */}
              <div className="border-t border-slate-100 pt-4 mt-2">
                <label className="flex items-center gap-3 cursor-pointer group w-max">
                  <input type="checkbox" checked={editColModal.arca_habilitado || false} onChange={e => setEditColModal({...editColModal, arca_habilitado: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  <div>
                    <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">Emite factura por ARCA</span>
                    <p className="text-[10px] text-slate-400">Habilitar facturación electrónica AFIP para esta institución</p>
                  </div>
                </label>
              </div>

              {/* Campos ARCA (condicionales) */}
              {editColModal.arca_habilitado && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider">Configuración ARCA / AFIP</h4>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Cabecera de Autenticación (x-api-key) *</label>
                    <input required type="password" value={editColModal.arca_api_key || ""} onChange={e => setEditColModal({...editColModal, arca_api_key: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="dil_sec_..." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">CUIT Emisor *</label>
                    <input required type="text" value={editColModal.cuit || ""} onChange={e => setEditColModal({...editColModal, cuit: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="Ej: 30-70843096-6" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Punto de Venta</label>
                      <input type="number" min="1" max="99999" value={editColModal.arca_punto_venta || ""} onChange={e => setEditColModal({...editColModal, arca_punto_venta: e.target.value ? parseInt(e.target.value, 10) : null})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="Ej: 3" />
                      <p className="text-[10px] text-slate-400 mt-0.5">Opcional</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Concepto *</label>
                      <select value={editColModal.arca_concepto || 2} onChange={e => setEditColModal({...editColModal, arca_concepto: parseInt(e.target.value, 10)})} className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-700 bg-white outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value={1}>1 - Productos</option>
                        <option value={2}>2 - Servicios</option>
                        <option value={3}>3 - Productos y Servicios</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-2 justify-end">
                <button type="button" onClick={() => setEditColModal(null)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
                <button disabled={isSubmitting} type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Usuario Modal */}
      {editUsrModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex justify-between">
              <h3 className="font-bold text-slate-800">Editar Usuario</h3>
              <button onClick={() => setEditUsrModal(null)} className="text-slate-400 hover:text-slate-600">X</button>
            </div>
            <form onSubmit={handleEditUsuario} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Colegio Asignado</label>
                <select value={editUsrModal.colegio_id} onChange={e => setEditUsrModal({...editUsrModal, colegio_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500">
                  {colegios.map(col => <option key={col.id} value={col.id}>{col.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre Completo</label>
                <input required type="text" value={editUsrModal.nombre_completo} onChange={e => setEditUsrModal({...editUsrModal, nombre_completo: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                <input required type="email" value={editUsrModal.email} onChange={e => setEditUsrModal({...editUsrModal, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nueva Contraseña (Opcional)</label>
                <input type="text" value={editUsrModal.newPassword || ""} onChange={e => setEditUsrModal({...editUsrModal, newPassword: e.target.value})} placeholder="Dejar en blanco para no cambiar" className="w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Roles de Acceso (Múltiples)</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_ROLES.map(role => (
                    <label key={role.id} className={`cursor-pointer px-3 py-1.5 rounded-lg border text-sm flex items-center gap-2 transition-colors \${editUsrModal.rol.includes(role.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                        checked={editUsrModal.rol.includes(role.id)}
                        onChange={() => {
                          setEditUsrModal(prev => {
                            if (!prev) return prev;
                            const newRoles = prev.rol.includes(role.id) ? prev.rol.filter(r => r !== role.id) : [...prev.rol, role.id];
                            return { ...prev, rol: newRoles };
                          });
                        }}
                      />
                      {role.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-2 flex gap-2 justify-end">
                <button type="button" onClick={() => setEditUsrModal(null)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
                <button disabled={isSubmitting} type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
