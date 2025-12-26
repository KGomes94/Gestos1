
import React, { useState } from 'react';
import { SystemSettings, Account, AccountType } from '../../types';
import { Wallet, Plus, Edit2, Trash2, List, CreditCard } from 'lucide-react';
import Modal from '../Modal';
import { useNotification } from '../../contexts/NotificationContext';

interface FinancialSettingsProps {
    settings: SystemSettings;
    setSettings: (newSettings: SystemSettings) => void;
    categories: Account[];
    setCategories: React.Dispatch<React.SetStateAction<Account[]>>;
}

export const FinancialSettings: React.FC<FinancialSettingsProps> = ({ settings, setSettings, categories, setCategories }) => {
    const { notify } = useNotification();
    
    // Account Modal State
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Partial<Account>>({ type: 'Receita Operacional' });
    
    // Payment Method State
    const [newMethod, setNewMethod] = useState('');

    const accountTypes: AccountType[] = ['Receita Operacional', 'Custo Direto', 'Custo Fixo', 'Despesa Financeira', 'Movimento de Balanço'];

    // --- ACCOUNT HANDLERS ---
    const handleSaveAccount = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAccount.code || !editingAccount.name || !editingAccount.type) {
            notify('error', 'Preencha todos os campos da conta.');
            return;
        }

        if (editingAccount.id) {
            setCategories(prev => prev.map(a => a.id === editingAccount.id ? { ...a, ...editingAccount } as Account : a));
            notify('success', 'Conta atualizada.');
        } else {
            const newAcc: Account = {
                ...editingAccount as Account,
                id: Date.now().toString()
            };
            setCategories(prev => [...prev, newAcc]);
            notify('success', 'Conta criada.');
        }
        setIsAccountModalOpen(false);
    };

    const removeAccount = (id: string) => {
        if (confirm(`Remover esta conta do plano?`)) {
            setCategories(prev => prev.filter(a => a.id !== id));
        }
    };

    // --- PAYMENT METHODS HANDLERS ---
    const addPaymentMethod = () => {
        if (!newMethod.trim()) return;
        const current = settings.paymentMethods || [];
        if (current.includes(newMethod.trim())) {
            notify('error', 'Método já existe.');
            return;
        }
        setSettings({ ...settings, paymentMethods: [...current, newMethod.trim()] });
        setNewMethod('');
    };

    const removePaymentMethod = (method: string) => {
        if (confirm(`Remover método "${method}"?`)) {
            setSettings({ 
                ...settings, 
                paymentMethods: (settings.paymentMethods || []).filter(m => m !== method) 
            });
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            
            {/* PLANO DE CONTAS */}
            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                            <List size={16}/> Plano de Contas
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Estrutura de receitas e despesas</p>
                    </div>
                    <button 
                        onClick={() => { setEditingAccount({ type: 'Receita Operacional' }); setIsAccountModalOpen(true); }} 
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 hover:bg-green-700 shadow-sm"
                    >
                        <Plus size={14}/> Nova Conta
                    </button>
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="min-w-full text-xs">
                        <thead className="bg-gray-100 text-gray-500 font-bold uppercase sticky top-0">
                            <tr>
                                <th className="p-3 text-left w-20 border-r">Código</th>
                                <th className="p-3 text-left">Nome da Conta</th>
                                <th className="p-3 text-left">Grupo / Tipo</th>
                                <th className="p-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {categories.sort((a,b) => a.code.localeCompare(b.code, undefined, {numeric: true})).map(acc => (
                                <tr key={acc.id} className="hover:bg-gray-50 group">
                                    <td className="p-3 font-mono font-bold text-gray-600 border-r">{acc.code}</td>
                                    <td className="p-3 font-bold text-gray-800">{acc.name}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                                            acc.type.includes('Receita') ? 'bg-green-100 text-green-700' :
                                            acc.type.includes('Custo Direto') ? 'bg-orange-100 text-orange-700' :
                                            acc.type.includes('Custo Fixo') ? 'bg-yellow-100 text-yellow-700' :
                                            acc.type.includes('Balanço') ? 'bg-blue-100 text-blue-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {acc.type}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingAccount(acc); setIsAccountModalOpen(true); }} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit2 size={14}/></button>
                                            <button onClick={() => removeAccount(acc.id)} className="text-red-400 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MÉTODOS DE PAGAMENTO E OUTROS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border rounded-2xl p-6 shadow-sm">
                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <CreditCard size={16}/> Métodos de Pagamento
                    </h4>
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            placeholder="Novo método..." 
                            className="flex-1 border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                            value={newMethod}
                            onChange={e => setNewMethod(e.target.value)}
                        />
                        <button onClick={addPaymentMethod} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg text-gray-600"><Plus size={18}/></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {settings.paymentMethods.map(m => (
                            <div key={m} className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 flex items-center gap-2">
                                {m}
                                <button onClick={() => removePaymentMethod(m)} className="text-gray-400 hover:text-red-500"><Trash2 size={12}/></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white border rounded-2xl p-6 shadow-sm">
                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Wallet size={16}/> Metas & Orçamento
                    </h4>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1">Meta Mensal de Faturação</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                className="w-full border rounded-lg p-2 text-sm font-bold" 
                                value={settings.monthlyTarget} 
                                onChange={e => setSettings({...settings, monthlyTarget: Number(e.target.value)})} 
                            />
                            <span className="text-sm font-bold text-gray-500">CVE</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">Este valor é usado para calcular o progresso no Dashboard.</p>
                    </div>
                </div>
            </div>

            {/* MODAL EDITAR CONTA */}
            <Modal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} title={editingAccount.id ? "Editar Conta" : "Nova Conta"}>
                <form onSubmit={handleSaveAccount} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Código</label>
                            <input required placeholder="Ex: 1.1" className="w-full border rounded-xl p-3 text-sm font-mono font-bold" value={editingAccount.code || ''} onChange={e => setEditingAccount({...editingAccount, code: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Grupo / Tipo</label>
                            <select className="w-full border rounded-xl p-3 text-sm bg-white" value={editingAccount.type} onChange={e => setEditingAccount({...editingAccount, type: e.target.value as AccountType})}>
                                {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nome da Conta</label>
                        <input required placeholder="Ex: Serviços Prestados" className="w-full border rounded-xl p-3 text-sm" value={editingAccount.name || ''} onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} />
                    </div>
                    <div className="pt-4 border-t flex justify-end gap-3">
                        <button type="button" onClick={() => setIsAccountModalOpen(false)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancelar</button>
                        <button type="submit" className="px-8 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700">Guardar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
