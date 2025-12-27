
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, HardDrive } from 'lucide-react';

const Login: React.FC = () => {
    const { login } = useAuth();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl text-center">
                <div className="bg-blue-100 text-blue-700 p-4 rounded-full inline-block mb-6">
                    <HardDrive size={48} />
                </div>
                <h1 className="text-3xl font-black text-gray-800 mb-2">GestOs Cloud</h1>
                <p className="text-gray-500 mb-8">Edição Google Drive Personal</p>

                <button 
                    onClick={() => login()}
                    className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6"/>
                    Entrar com Google
                </button>

                <div className="mt-8 pt-6 border-t flex justify-center text-xs text-gray-400 gap-2">
                    <ShieldCheck size={14}/> Dados encriptados e armazenados no seu Drive
                </div>
            </div>
        </div>
    );
};

export default Login;
