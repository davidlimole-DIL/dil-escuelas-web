"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Por favor complete todos los campos obligatorios.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // 1. Iniciamos sesión en Auth usando email y contraseña
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        throw new Error("Credenciales inválidas. Error original: " + (authError?.message || "Usuario nulo"));
      }

      // 2. Extraemos información relacional (rol y colegio_id)
      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles_admin')
        .select('rol, colegio_id')
        .eq('id', authData.user.id)
        .single();
        
      if (perfilError || !perfil) {
         throw new Error("Su identificación fue exitosa, pero no tiene perfil administrativo en la base de datos.");
      }

      // 3. Redirigimos al módulo específico según su rol de acceso
      let roles: string[] = [];
      if (Array.isArray(perfil.rol)) {
        roles = perfil.rol;
      } else if (typeof perfil.rol === 'string') {
        if (perfil.rol.startsWith('{') && perfil.rol.endsWith('}')) {
           roles = perfil.rol.slice(1, -1).split(',').map(r => r.trim());
        } else {
           roles = [perfil.rol];
        }
      }
      roles = roles.filter(Boolean);
      
      if (roles.includes("superadmin")) {
        router.push("/master");
      } else if (roles.length > 0) {
        // Redirigir al primer rol que tengan en su arreglo (limpio de comillas si tuviese)
        let primerRol = roles[0].replace(/"/g, '').trim();
        if (primerRol === "admin" || primerRol === "administrativo") {
          primerRol = "directivo";
        }
        router.push(`/dashboard/${primerRol}?colegio=${perfil.colegio_id}`);
      } else {
        throw new Error("Su perfil no tiene ningún rol asignado. Contacte a soporte.");
      }

    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative font-inter">
      {/* Botón Volver (Header) */}
      <div className="absolute top-6 left-6 z-20">
        <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 transition-all hover:shadow-md">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          Volver a Inicio
        </Link>
      </div>

      {/* Tarjeta Modal Original DIL-Escuelas */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-sm relative z-10 transition-all">
        
        <div className="text-center mb-5 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center mb-3">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">Acceso Seguro</h3>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Correo Electrónico Institucional</label>
            <input 
              type="email" 
              placeholder="directivo@colegio.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-slate-900"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold py-2.5 sm:py-3 text-sm sm:text-base rounded-lg shadow-md transition-all mt-3"
          >
            {loading ? "Verificando..." : "Ingresar"}
          </button>
          
          {errorMsg && (
            <p className="text-red-500 text-xs text-center font-semibold mt-3 p-2 bg-red-50 rounded-lg border border-red-100">
              {errorMsg}
            </p>
          )}
        </form>
      </div>

      <div className="mt-8 bg-slate-200/50 rounded-xl p-3 max-w-sm flex items-start sm:items-center justify-center gap-3 text-slate-500 border border-slate-200">
        <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
        </svg>
        <span className="text-[10px] sm:text-xs font-medium leading-tight">
          <strong>Seguridad DIL:</strong> Encriptación de origen a fin garantizada. Identidades respaldadas por infraestructura de alto nivel.
        </span>
      </div>
    </div>
  );
}
