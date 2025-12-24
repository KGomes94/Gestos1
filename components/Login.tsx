
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, User, Lock, ArrowRight, Loader2, AlertCircle, FlaskConical } from 'lucide-react';

const Login: React.FC = () => {
    const { login } = useAuth();
    const [form, setForm] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        const success = await login(form.username, form.password);
        if (!success) {
            setError('Credenciais inválidas ou conta inativa.');
            setLoading(false);
        }
    };

    const handleTestLogin = async () => {
        setLoading(true);
        const success = await login('admin', 'admin123');
        if (!success) {
            setError('Falha no login de teste.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-950 flex items-center justify-center p-4">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-green-500 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-400 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-md bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/20 shadow-2xl animate-fade-in-up">
                <div className="text-center mb-8">
                    <div className="bg-white text-green-700 font-black text-4xl py-2 px-4 rounded-xl inline-block shadow-lg transform -rotate-1 mb-4">GestOs</div>
                    <h2 className="text-white text-lg font-bold">Acesso ao Ecossistema</h2>
                    <p className="text-green-100/60 text-sm">Insira as suas credenciais para continuar</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="relative group">
                            <User className="absolute left-3 top-3 text-green-200/50 group-focus-within:text-green-400 transition-colors" size={20} />
                            <input 
                                required
                                type="text"
                                placeholder="Utilizador"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                value={form.username}
                                onChange={e => setForm({...form, username: e.target.value})}
                            />
                        </div>

                        <div className="relative group">
                            <Lock className="absolute left-3 top-3 text-green-200/50 group-focus-within:text-green-400 transition-colors" size={20} />
                            <input 
                                required
                                type="password"
                                placeholder="Palavra-passe"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                value={form.password}
                                onChange={e => setForm({...form, password: e.target.value})}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 p-3 rounded-xl flex items-center gap-2 text-red-200 text-xs font-bold animate-shake">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <button 
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-green-900/40 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (
                            <>Entrar no Sistema <ArrowRight size={20} /></>
                        )}
                    </button>
                </form>

                {/* Botão de Teste Temporário */}
                <div className="mt-6">
                    <button 
                        onClick={handleTestLogin}
                        disabled={loading}
                        className="w-full bg-white/5 hover:bg-white/10 text-green-200/60 hover:text-green-200 border border-dashed border-white/20 hover:border-green-500/50 py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-xs font-bold"
                    >
                        <FlaskConical size={16} /> Login Rápido (Ambiente de Teste)
                    </button>
                </div>

                <div className="mt-8 pt-8 border-t border-white/10 flex items-center justify-center gap-2 text-[10px] text-white/30 font-bold uppercase tracking-widest">
                    <ShieldCheck size={14} /> Ambiente Encriptado de Alta Segurança
                </div>
            </div>
            
            <div className="absolute bottom-4 text-white/20 text-[10px] uppercase font-bold tracking-widest">
                GestOs Enterprise Resource Planning v1.7.0
            </div>
        </div>
    );
};

export default Login;
