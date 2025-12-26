
import React, { useState } from 'react';
import { Invoice, SystemSettings } from '../../types';
import Modal from '../../components/Modal';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice | null;
    settings: SystemSettings;
    onConfirm: (invoice: Invoice, method: string, date: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, invoice, settings, onConfirm }) => {
    const [method, setMethod] = useState('Transferência');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    if (!isOpen || !invoice) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(invoice, method, date);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Registar Pagamento">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-4 bg-green-50 rounded-xl border border-green-100 mb-4">
                    <p className="text-xs font-bold text-green-800 uppercase">Documento {invoice.id}</p>
                    <p className="text-right font-black text-xl text-green-700">{invoice.total.toLocaleString()} CVE</p>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                    <input type="date" required className="w-full border rounded-lg p-2" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método</label>
                    <select className="w-full border rounded-lg p-2" value={method} onChange={e => setMethod(e.target.value)}>
                        {settings.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="pt-4 flex justify-end gap-3 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 font-bold">Cancelar</button>
                    <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold">Confirmar</button>
                </div>
            </form>
        </Modal>
    );
};
