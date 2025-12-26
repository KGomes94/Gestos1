
import React, { useState } from 'react';
import { RecurringContract, Client, Material } from '../../types';
import { useRecurringContracts } from '../hooks/useRecurringContracts';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/Modal';

interface RecurringModalProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    materials: Material[];
    recurringHook: ReturnType<typeof useRecurringContracts>;
}

export const RecurringModal: React.FC<RecurringModalProps> = ({ 
    isOpen, onClose, clients, materials, recurringHook 
}) => {
    const { editingContract, setEditingContract, addContractItem, removeContractItem, saveContract } = recurringHook;
    const [selectedMatId, setSelectedMatId] = useState('');
    const [qty, setQty] = useState(1);

    const handleAddItem = () => {
        const m = materials.find(x => x.id === Number(selectedMatId));
        if (m) {
            addContractItem(m, qty);
            setSelectedMatId('');
            setQty(1);
        }
    };

    const handleSave = () => {
        if(saveContract()) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingContract.id ? "Editar Avença" : "Nova Avença"}>
            <div className="flex flex-col max-h-[85vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Cliente</label>
                        <select className="w-full border rounded-xl p-3 text-sm font-bold bg-white" value={editingContract.clientId || ''} onChange={e => { const c = clients.find(cl=>cl.id===Number(e.target.value)); setEditingContract(prev => ({...prev, clientId: Number(e.target.value), clientName: c?.company})) }}>
                            <option value="">Selecione o Cliente...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Frequência</label>
                        <select className="w-full border rounded-xl p-3 text-sm font-bold bg-white" value={editingContract.frequency} onChange={e => setEditingContract(prev => ({...prev, frequency: e.target.value as any}))}>
                            <option value="Mensal">Mensal</option>
                            <option value="Trimestral">Trimestral</option>
                            <option value="Semestral">Semestral</option>
                            <option value="Anual">Anual</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Próxima Execução</label>
                        <input type="date" className="w-full border rounded-xl p-3 text-sm" value={editingContract.nextRun} onChange={e => setEditingContract(prev => ({...prev, nextRun: e.target.value}))} />
                    </div>
                    <div className="flex items-center pt-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" className="w-5 h-5 text-green-600 rounded" checked={editingContract.active} onChange={e => setEditingContract(prev => ({...prev, active: e.target.checked}))} />
                            <span className="text-sm font-bold text-gray-700">Contrato Ativo</span>
                        </label>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex gap-4 items-end mb-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Adicionar Item à Avença</label>
                            <select className="w-full border rounded-xl p-2 text-sm bg-white" value={selectedMatId} onChange={e => setSelectedMatId(e.target.value)}>
                                <option value="">Procurar Material / Serviço...</option>
                                {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.price} CVE)</option>)}
                            </select>
                        </div>
                        <div className="w-20"><input type="number" className="w-full border rounded-xl p-2 text-sm text-center" value={qty} onChange={e => setQty(Number(e.target.value))} /></div>
                        <button onClick={handleAddItem} className="bg-purple-600 text-white p-2 rounded-xl"><Plus size={20}/></button>
                    </div>
                    <table className="w-full text-sm bg-white rounded-lg overflow-hidden">
                        <thead className="bg-gray-100 text-[10px] font-black uppercase text-gray-500"><tr><th className="p-2 text-left">Item</th><th className="p-2 text-center">Qtd</th><th className="p-2 text-right">Total</th><th className="w-10"></th></tr></thead>
                        <tbody>
                            {editingContract.items?.map((item, idx) => (
                                <tr key={idx} className="border-b last:border-0">
                                    <td className="p-2">{item.description}</td>
                                    <td className="p-2 text-center">{item.quantity}</td>
                                    <td className="p-2 text-right font-bold">{item.total.toLocaleString()}</td>
                                    <td className="p-2"><button onClick={() => removeContractItem(idx)} className="text-red-400"><Trash2 size={14}/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="pt-6 border-t mt-4 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 border rounded-xl font-bold text-gray-500">Cancelar</button>
                    <button onClick={handleSave} className="px-8 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700">Guardar Avença</button>
                </div>
            </div>
        </Modal>
    );
};
