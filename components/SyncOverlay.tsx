
import React from 'react';
import { RefreshCw, CloudCheck } from 'lucide-react';

interface SyncOverlayProps {
  isVisible: boolean;
}

const SyncOverlay: React.FC<SyncOverlayProps> = ({ isVisible }) => {
  return (
    <div className={`fixed bottom-4 right-4 z-[110] transition-all duration-500 ease-in-out transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
      <div className="bg-white/90 backdrop-blur-md border border-green-200 shadow-xl rounded-full px-4 py-2 flex items-center gap-3">
        <div className="relative">
          <RefreshCw className="text-green-600 animate-spin" size={14} />
        </div>
        <div>
          <p className="text-[10px] font-black text-green-800 uppercase tracking-wider leading-none">A Sincronizar</p>
        </div>
      </div>
    </div>
  );
};

export default SyncOverlay;
