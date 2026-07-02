"use client";

import { useState } from "react";
import { loginAlumnoAccion } from "./actions";

export default function AlumnoLogin() {
  const [codigoColegio, setCodigoColegio] = useState("");
  const [cuil, setCuil] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoColegio || !cuil) {
      setErrorMsg("Completa todos los campos");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await loginAlumnoAccion(codigoColegio.trim().toUpperCase(), cuil.trim());
      if (res && res.error) {
        setErrorMsg(res.error);
      }
    } catch (error: any) {
      setErrorMsg("Error al iniciar sesión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-4 transform rotate-3">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
          </div>
          <h1 className="text-2xl font-black text-slate-800">Portal Alumno</h1>
          <p className="text-sm text-slate-500 mt-1">Ingresá para ver tu estado de cuenta</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Código del Colegio</label>
            <input 
              type="text" 
              placeholder="Ej: VALLE-UCO"
              value={codigoColegio}
              onChange={(e) => setCodigoColegio(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm transition-all uppercase"
            />
            <p className="text-[10px] text-slate-400 mt-1">El código asignado por tu institución (Ej: VALLE-UCO)</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Tu CUIL o DNI</label>
            <input 
              type="text" 
              placeholder="Sin guiones ni espacios"
              value={cuil}
              onChange={(e) => setCuil(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-lg transition-all"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all mt-2"
          >
            {loading ? "Verificando..." : "Ingresar a mi Cuenta"}
          </button>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold p-3 rounded-lg text-center mt-4">
              {errorMsg}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
