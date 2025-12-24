
import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface LoadingScreenProps {
  onFinished: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onFinished }) => {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Inicializando sistemas...');

  useEffect(() => {
    const messages = [
      'Conectando ao banco de dados...',
      'Carregando módulos de tesouraria...',
      'Sincronizando agenda e propostas...',
      'Preparando interface...',
      'Ambiente pronto!'
    ];

    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.floor(Math.random() * 15) + 5;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onFinished, 500);
          return 100;
        }
        
        // Update message based on progress
        const msgIndex = Math.min(Math.floor((next / 100) * messages.length), messages.length - 1);
        setMessage(messages[msgIndex]);
        
        return next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [onFinished]);

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-green-700 via-green-800 to-green-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-green-500/10 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-400/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="relative flex flex-col items-center max-w-md w-full text-center space-y-8 animate-fade-in-up">
        {/* Logo Section */}
        <div className="space-y-2">
          <div className="bg-white text-green-700 font-black text-6xl px-6 py-3 rounded-2xl shadow-2xl transform -rotate-2 hover:rotate-0 transition-transform duration-500 animate-bounce-slow">
            GestOs
          </div>
          <p className="text-green-200 uppercase tracking-[0.3em] font-bold text-xs">Enterprise Resource Planning</p>
        </div>

        {/* Welcome Message */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Bem-vindo</h1>
          <p className="text-green-100/70 text-sm">Otimizando a gestão da sua empresa</p>
        </div>

        {/* Progress Section (Inspired by Financial Import) */}
        <div className="w-full bg-green-900/50 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-inner">
          <div className="flex justify-between items-end mb-4">
            <div className="text-left">
              <p className="text-[10px] font-black uppercase text-green-400 tracking-wider">Status do Carregamento</p>
              <p className="text-sm font-medium text-white h-5 transition-all duration-300">{message}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black">{progress}%</span>
            </div>
          </div>

          <div className="w-full bg-green-950 h-3 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-emerald-300 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(74,222,128,0.5)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-green-300/50 font-bold uppercase">
             <CheckCircle2 size={10} /> Conexão Segura Ativa
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-8 text-green-400/40 text-[10px] font-medium flex items-center gap-4">
        {/* Atualizada versão para 1.3.0 */}
        <span>VER 1.3.0</span>
        <span className="w-1 h-1 bg-green-800 rounded-full"></span>
        <span>© {new Date().getFullYear()} GESTOS CLOUD SOLUTIONS</span>
      </div>
    </div>
  );
};

export default LoadingScreen;
