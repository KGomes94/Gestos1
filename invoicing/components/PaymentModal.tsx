
import React, { useState, useEffect } from 'react';
import { Invoice, SystemSettings, Account } from '../../types';
import Modal from '../../components/Modal';
import { db } from '../../services/db'; // Import to fetch categories if not passed

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice | null;
    settings: SystemSettings;
    onConfirm: (invoice: Invoice, method: string, date: string, description: string, category: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, invoice, settings, onConfirm }) => {
    const [method, setMethod] = useState('Transferência');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    
    // Load categories for dropdown
    const [categories, setCategories] = useState<Account[]>([]);
    
    useEffect(() => {
        db.categories.getAll().then(setCategories);
    }, []);

    useEffect(() => {
        if (isOpen && invoice) {
            setDescription(`Pagamento Doc. ${invoice.id} - ${invoice.clientName}`);
            // Default category logic
            const defaultCat = categories.find(c => c.type === 'Receita Operacional')?.name || 'Serviços Prestados';
            setCategory(defaultCat);
        }
    }, [isOpen, invoice, categories]);

    if (!isOpen || !invoice) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(invoice, method, date, description, category);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Registar Pagamento">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-4 bg-green-50 rounded-xl border border-green-100 mb-4">
                    <p className="text-xs font-bold text-green-800 uppercase">Documento {invoice.id}</p>
                    <p className="text-right font-black text-xl text-green-700">{invoice.total.toLocaleString()} CVE</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                        <input type="date" required className="w-full border rounded-lg p-2" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método</label>
                        <select className="w-full border rounded-lg p-2 bg-white" value={method} onChange={e => setMethod(e.target.value)}>
                            {settings.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição do Movimento</label>
                    <input 
                        type="text" 
                        required 
                        className="w-full border rounded-lg p-2" 
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria (Plano de Contas)</label>
                    <select className="w-full border rounded-lg p-2 bg-white" required value={category} onChange={e => setCategory(e.target.value)}>
                        <option value="">Selecione...</option>
                        {categories.filter(c => c.type === 'Receita Operacional').map(c => (
                            <option key={c.id} value={c.name}>{c.code} - {c.name}</option>
                        ))}
                        <optgroup label="Outros">
                            {categories.filter(c => c.type !== 'Receita Operacional').map(c => (
                                <option key={c.id} value={c.name}>{c.code} - {c.name}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancelar</button>
                    <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md">Confirmar Recebimento</button>
                </div>
            </form>
        </Modal>
    );
};
