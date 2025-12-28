
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, AlertTriangle, Cloud } from 'lucide-react';

const Login: React.FC = () => {
    const { login } = useAuth();
    
    // Check if ID is configured
    const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {} as any;
    const hasClientId = metaEnv.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="mx-auto h-16 w-16 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-200 mb-6 transform rotate-3 hover:rotate-0 transition-all duration-300">
                    <Cloud className="text-white" size={32} />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    GestOs <span className="text-green-600">Cloud</span>
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                    Sistema de Gestão Integrado • Google Drive Edition
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-10 shadow-xl shadow-gray-200/50 rounded-2xl border border-gray-100">
                    {!hasClientId && (
                        <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-xl text-left">
                            <div className="flex items-center gap-2 text-red-700 font-bold mb-1">
                                <AlertTriangle size={18}/> Configuração em Falta
                            </div>
                            <p className="text-xs text-red-600">
                                O <code>VITE_GOOGLE_CLIENT_ID</code> não foi encontrado.
                            </p>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div>
                            <p className="text-sm font-medium text-gray-700 mb-4 text-center">
                                Inicie sessão para sincronizar os seus dados
                            </p>
                            <button 
                                onClick={() => login()}
                                className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-gray-300 rounded-xl shadow-sm bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                            >
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5"/>
                                Continuar com Google
                            </button>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-400">Segurança</span>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                            <ShieldCheck className="text-green-600 shrink-0" size={20} />
                            <p className="text-xs text-green-800 leading-relaxed">
                                Os seus dados permanecem privados no seu Google Drive pessoal. Nenhuma informação é enviada para servidores externos.
                            </p>
                        </div>
                    </div>
                </div>
                
                <p className="mt-6 text-center text-xs text-gray-400">
                    &copy; {new Date().getFullYear()} GestOs ERP. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
};

export default Login;
