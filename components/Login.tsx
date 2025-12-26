
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, User, Lock, ArrowRight, Loader2, AlertCircle, HelpCircle } from 'lucide-react';
import Modal from './Modal';

const Login: React.FC = () => {
    const { login } = useAuth();
    const [form, setForm] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isRecoverModalOpen, setIsRecoverModalOpen] = useState(false);
    const [recoverEmail, setRecoverEmail] = useState('');
    const [recoverStatus, setRecoverStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            const success = await login(form.username, form.password);
            if (!success) {
                setError('Credenciais inválidas.');
                setLoading(false);
            }
        } catch (e) {
            setError('Erro de conexão ao servidor.');
            setLoading(false);
        }
    };

    const handleRecover = (e: React.FormEvent) => {
        e.preventDefault();
        setRecoverStatus('sending');
        // Simulação de envio
        setTimeout(() => {
            setRecoverStatus('sent');
        }, 1500);
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
                    <h2 className="text-white text-lg font-bold">Acesso Seguro</h2>
                    <p className="text-green-100/60 text-sm">ERP & Gestão Empresarial</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="relative group">
                            <User className="absolute left-3 top-3 text-green-200/50 group-focus-within:text-green-400 transition-colors" size={20} />
                            <input 
                                required
                                type="text"
                                placeholder="Email ou Utilizador"
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

                    <div className="flex justify-end">
                        <button type="button" onClick={() => { setRecoverStatus('idle'); setRecoverEmail(''); setIsRecoverModalOpen(true); }} className="text-xs text-green-200 hover:text-white hover:underline transition-colors">
                            Esqueceu a palavra-passe?
                        </button>
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
                            <>Entrar <ArrowRight size={20} /></>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-8 border-t border-white/10 flex items-center justify-center gap-2 text-[10px] text-white/30 font-bold uppercase tracking-widest">
                    <ShieldCheck size={14} /> Conexão Encriptada SSL
                </div>
            </div>
            
            <div className="absolute bottom-4 text-white/20 text-[10px] uppercase font-bold tracking-widest">
                GestOs Cloud v2.0
            </div>

            {/* Modal de Recuperação de Senha */}
            <Modal isOpen={isRecoverModalOpen} onClose={() => setIsRecoverModalOpen(false)} title="Recuperar Acesso">
                {recoverStatus === 'sent' ? (
                    <div className="text-center p-6 space-y-4">
                        <div className="bg-green-100 text-green-700 p-4 rounded-full inline-block">
                            <ShieldCheck size={48} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Verifique o seu Email</h3>
                        <p className="text-gray-600 text-sm">
                            Se a conta existir, receberá instruções para redefinir a palavra-passe em instantes.
                        </p>
                        <button onClick={() => setIsRecoverModalOpen(false)} className="mt-4 bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-200">Voltar ao Login</button>
                    </div>
                ) : (
                    <form onSubmit={handleRecover} className="space-y-4 p-2">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                            <HelpCircle className="text-blue-600 shrink-0 mt-1" size={20}/>
                            <p className="text-xs text-blue-800">
                                Insira o seu email registado. Enviaremos um link seguro para redefinição.
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                            <input 
                                required
                                type="email" 
                                className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                                placeholder="ex: gestor@empresa.com"
                                value={recoverEmail}
                                onChange={e => setRecoverEmail(e.target.value)}
                            />
                        </div>
                        <div className="pt-4 flex justify-end gap-3 border-t mt-4">
                            <button type="button" onClick={() => setIsRecoverModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancelar</button>
                            <button type="submit" disabled={recoverStatus === 'sending'} className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center gap-2">
                                {recoverStatus === 'sending' ? <><Loader2 className="animate-spin" size={16}/> Processando...</> : 'Recuperar Senha'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default Login;
