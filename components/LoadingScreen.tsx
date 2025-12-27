
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  // Props removidas pois o controle é externo agora
  message?: string;
  onFinished?: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = "A carregar sistema..." }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-green-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="flex flex-col items-center animate-fade-in-up space-y-6">
        {/* Logo Animation */}
        <div className="relative">
            <div className="absolute inset-0 bg-green-400 blur-xl opacity-20 rounded-full animate-pulse"></div>
            <div className="bg-white text-green-800 font-black text-5xl px-6 py-3 rounded-2xl shadow-2xl relative z-10">
                GestOs
            </div>
        </div>
        
        {/* Spinner */}
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-green-300" size={32} />
            <p className="text-green-100/80 text-sm font-medium tracking-wide animate-pulse">{message}</p>
        </div>

        <div className="absolute bottom-8 text-green-100/20 text-[10px] font-bold tracking-[0.3em]">
            ENTERPRISE RESOURCE PLANNING
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
