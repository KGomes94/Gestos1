
import React from 'react';
import { RefreshCw } from 'lucide-react';

interface SyncOverlayProps {
  isVisible: boolean;
}

const SyncOverlay: React.FC<SyncOverlayProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none transition-opacity duration-300 bg-white/5 backdrop-blur-[2px]">
      <div className="bg-white/90 backdrop-blur-xl border border-green-100 shadow-2xl rounded-2xl px-8 py-5 flex items-center gap-4 animate-fade-in-up">
        <div className="relative">
          <RefreshCw className="text-green-600 animate-spin" size={24} />
          <div className="absolute inset-0 bg-green-400/20 blur-lg rounded-full"></div>
        </div>
        <div>
          <p className="text-sm font-black text-gray-800 uppercase tracking-tight">Sincronizando</p>
          <p className="text-[10px] text-gray-500 font-medium">Gravando alterações na nuvem...</p>
        </div>
      </div>
    </div>
  );
};

export default SyncOverlay;
