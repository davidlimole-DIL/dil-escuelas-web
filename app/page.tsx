import Link from "next/link";

export default function HomeRecepcion() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-[family-name:Inter]">
      <div className="max-w-3xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Encabezado General */}
        <div className="space-y-4">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-200">
             <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21l9-5-9-5-9 5 9 5z" strokeOpacity="0.5"></path></svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">Portal Educativo <span className="text-indigo-600">DIL</span></h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto font-medium">Seleccione su perfil operativo para ingresar al panel correspondiente.</p>
        </div>

        {/* Tarjetas de Selección de Acceso */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 w-full max-w-2xl mx-auto text-left">
          
          <Link href="/alumno/login" className="group bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-100 transition-all flex flex-col justify-between relative overflow-hidden h-64">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Soy Alumno</h2>
              <p className="text-sm text-slate-500 font-medium">Accede con tu CUIL y Código Institucional para consultar estado financiero y legajos.</p>
            </div>
            <div className="relative z-10 text-indigo-600 font-bold text-sm flex items-center gap-1 mt-6">
              Ingresar <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </Link>

          <Link href="/login" className="group bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:border-slate-800 hover:shadow-xl hover:shadow-slate-200 transition-all flex flex-col justify-between relative overflow-hidden h-64">
            <div className="relative z-10">
              <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Soy Personal / Admin</h2>
              <p className="text-sm text-slate-500 font-medium">Acceso seguro para Gestores de Cobranza, Directivos y Personal Administrativo.</p>
            </div>
            <div className="relative z-10 text-slate-700 font-bold text-sm flex items-center gap-1 mt-6">
              Acceso Institucional <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </Link>

        </div>

        {/* Footer Seguro */}
        <div className="mt-12 text-slate-400 text-xs font-semibold flex items-center gap-2 justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            Infraestructura encriptada DIL Digital
        </div>

      </div>
    </div>
  );
}
