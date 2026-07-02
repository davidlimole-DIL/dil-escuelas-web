"use client";

import { useState } from "react";
import { cambiarContextoSuperadmin } from "../actions";

export default function SuperAdminContextSwitcher({
  colegios,
  colegioActivoId
}: {
  colegios: { id: string; nombre: string }[];
  colegioActivoId: string;
}) {
  const [isChanging, setIsChanging] = useState(false);

  const handleCambio = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIsChanging(true);
    await cambiarContextoSuperadmin(e.target.value);
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-2 mr-6 border-r border-slate-200 pr-6">
      <div className="flex flex-col items-end">
        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Contexto Global</span>
        <select 
          value={colegioActivoId || "todos"}
          onChange={handleCambio}
          disabled={isChanging}
          className="text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer disabled:opacity-50"
        >
          <option value="todos">✨ Todos los Colegios</option>
          {colegios.map(col => (
            <option key={col.id} value={col.id}>{col.nombre}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
