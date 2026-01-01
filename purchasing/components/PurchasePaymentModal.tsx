
import React, { useState, useEffect } from 'react';
import { Purchase, SystemSettings, Account } from '../../types';
import Modal from '../../components/Modal';
import { db } from '../../services/db';

interface PurchasePaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    purchase: Purchase | null;
    settings: SystemSettings;
    categories: Account[];
    onConfirm: (purchase: Purchase, method: string, date: string, description: string, category: string) => void;
}

export const PurchasePaymentModal: React.FC<PurchasePaymentModalProps> = ({ 
    isOpen, onClose, purchase, settings, categories, onConfirm 
}) => {
    const [method, setMethod] = useState('Transferência');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState('');
    
    useEffect(() => {
        if (isOpen && purchase) {
            setDescription(`Pagamento Doc. ${purchase.referenceDocument || purchase.id} - ${purchase.supplierName}`);
            // Tenta usar a categoria definida na compra, senão procura uma categoria de Custo Direto padrão
            const defaultCat = purchase.categoryId || categories.find(c => c.type === 'Custo Direto')?.name || '';
            setCategoryId(defaultCat);
        }
    }, [isOpen, purchase, categories]);

    if (!isOpen || !purchase) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(purchase, method, date, description, categoryId);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Registar Pagamento (Saída)">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 mb-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs font-bold text-red-800 uppercase">{purchase.supplierName}</p>
                            <p className="text-xs text-red-600">Ref: {purchase.referenceDocument || purchase.id}</p>
                        </div>
                        <p className="text-right font-black text-xl text-red-700">{purchase.total.toLocaleString()} CVE</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Pagamento</label>
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
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Conta de Custo / Categoria</label>
                    <select className="w-full border rounded-lg p-2 bg-white" required value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                        <option value="">Selecione...</option>
                        <optgroup label="Custos Diretos">
                            {categories.filter(c => c.type === 'Custo Direto').map(c => (
                                <option key={c.id} value={c.name}>{c.code} - {c.name}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Custos Fixos">
                            {categories.filter(c => c.type === 'Custo Fixo').map(c => (
                                <option key={c.id} value={c.name}>{c.code} - {c.name}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Outros">
                            {categories.filter(c => !['Custo Direto', 'Custo Fixo'].includes(c.type)).map(c => (
                                <option key={c.id} value={c.name}>{c.code} - {c.name}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancelar</button>
                    <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md">Confirmar Pagamento</button>
                </div>
            </form>
        </Modal>
    );
};
