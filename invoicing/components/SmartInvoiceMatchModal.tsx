
import React, { useState, useMemo } from 'react';
import { Invoice, BankTransaction, SystemSettings } from '../../types';
import Modal from '../../components/Modal';
import { ArrowRight, CheckCircle2, AlertCircle, Wand2, Search } from 'lucide-react';

interface SmartInvoiceMatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoices: Invoice[];
    bankTransactions: BankTransaction[];
    settings: SystemSettings;
    onMatch: (invoice: Invoice, bankTx: BankTransaction) => void;
}

export const SmartInvoiceMatchModal: React.FC<SmartInvoiceMatchModalProps> = ({
    isOpen, onClose, invoices, bankTransactions, settings, onMatch
}) => {
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [invoiceSearch, setInvoiceSearch] = useState('');

    // Filtrar faturas pendentes (Emitida ou Pendente Envio)
    const pendingInvoices = useMemo(() => {
        return invoices
            .filter(i => (i.status === 'Emitida' || i.status === 'Pendente Envio') && i.type !== 'NCE')
            .filter(i => 
                i.clientName.toLowerCase().includes(invoiceSearch.toLowerCase()) || 
                i.id.toLowerCase().includes(invoiceSearch.toLowerCase())
            )
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [invoices, invoiceSearch]);

    // Calcular valores explicitamente para garantir consistência
    const getInvoiceValues = (invoice: Invoice) => {
        // Recalcular para garantir que 'total' é realmente o líquido (sub + tax - retention)
        // Isso previne erros se os dados no DB estiverem inconsistentes
        const gross = invoice.subtotal + invoice.taxTotal;
        const retention = invoice.withholdingTotal;
        const liquid = gross - retention;
        return { gross, retention, liquid };
    };

    // Encontrar movimentos bancários compatíveis
    const compatibleBankTxs = useMemo(() => {
        if (!selectedInvoiceId) return [];
        const invoice = invoices.find(i => i.id === selectedInvoiceId);
        if (!invoice) return [];

        const { liquid } = getInvoiceValues(invoice);
        const margin = settings.reconciliationValueMargin || 0.1;
        
        return bankTransactions.filter(bt => {
            // Apenas movimentos não conciliados e positivos (entradas)
            if (bt.reconciled || bt.amount <= 0) return false;
            
            // Verificar valor com margem usando o Valor LÍQUIDO calculado
            const diff = Math.abs(bt.amount - liquid);
            return diff <= margin;
        });
    }, [selectedInvoiceId, bankTransactions, invoices, settings]);

    const handleSelectInvoice = (id: string) => {
        setSelectedInvoiceId(id);
    };

    if (!isOpen) return null;

    const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);
    const selectedValues = selectedInvoice ? getInvoiceValues(selectedInvoice) : null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Conciliação Inteligente de Faturas">
            <div className="flex flex-col h-[75vh]">
                <div className="bg-purple-50 p-4 mb-4 rounded-xl border border-purple-100 flex items-start gap-3 text-sm text-purple-900">
                    <Wand2 className="text-purple-600 shrink-0 mt-0.5" size={20}/>
                    <p>
                        Selecione uma fatura pendente à esquerda. O sistema irá procurar automaticamente no extrato bancário por recebimentos com valores correspondentes ao <strong>Valor Líquido (A Receber)</strong> da fatura.
                        <br/><span className="text-xs opacity-70">A margem de tolerância é de {settings.reconciliationValueMargin} CVE.</span>
                    </p>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden">
                    {/* COLUNA ESQUERDA: FATURAS PENDENTES */}
                    <div className="flex flex-col border rounded-xl overflow-hidden bg-white shadow-sm">
                        <div className="p-3 bg-gray-50 border-b flex flex-col gap-2">
                            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">1. Selecionar Fatura Pendente</h3>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Pesquisar cliente ou nº..." 
                                    className="w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                                    value={invoiceSearch}
                                    onChange={e => setInvoiceSearch(e.target.value)}
                                />
                                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400"/>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/30">
                            {pendingInvoices.length > 0 ? pendingInvoices.map(inv => {
                                const vals = getInvoiceValues(inv);
                                return (
                                <div 
                                    key={inv.id}
                                    onClick={() => handleSelectInvoice(inv.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedInvoiceId === inv.id ? 'bg-purple-100 border-purple-500 ring-1 ring-purple-500' : 'bg-white border-gray-200 hover:border-purple-300'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-gray-800 text-sm">{inv.clientName}</span>
                                        <div className="text-right">
                                            <span className="font-black text-purple-700 text-sm block">{vals.liquid.toLocaleString()} CVE</span>
                                            <span className="text-[9px] text-gray-500 uppercase font-bold bg-gray-100 px-1 rounded">A Receber</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>{inv.id}</span>
                                        <span>{new Date(inv.date).toLocaleDateString()}</span>
                                    </div>
                                    {vals.retention > 0 && (
                                        <div className="mt-2 pt-1 border-t border-dashed border-gray-200 text-[9px] text-gray-400 flex justify-between">
                                            <span>Retenção: -{vals.retention.toLocaleString()}</span>
                                            <span>Bruto: {vals.gross.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            )}) : (
                                <div className="text-center p-8 text-gray-400 text-xs italic">Nenhuma fatura pendente encontrada.</div>
                            )}
                        </div>
                    </div>

                    {/* COLUNA DIREITA: SUGESTÕES DO BANCO */}
                    <div className="flex flex-col border rounded-xl overflow-hidden bg-white shadow-sm relative">
                        {!selectedInvoiceId && (
                            <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center text-gray-400">
                                <ArrowRight size={32} className="mb-2 opacity-20"/>
                                <p className="text-sm font-medium">Selecione uma fatura para ver sugestões.</p>
                            </div>
                        )}
                        
                        <div className="p-3 bg-gray-50 border-b">
                            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">2. Correspondências Bancárias</h3>
                            {selectedValues && (
                                <div className="text-xs text-purple-800 mt-1 font-medium bg-purple-50 p-1 rounded px-2">
                                    A procurar por: <strong>{selectedValues.liquid.toLocaleString()} CVE</strong> (Valor Líquido)
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/30">
                            {compatibleBankTxs.length > 0 ? compatibleBankTxs.map(bt => (
                                <div key={bt.id} className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{bt.description}</p>
                                            <p className="text-xs text-gray-500">{new Date(bt.date).toLocaleDateString()}</p>
                                        </div>
                                        <span className="font-black text-green-700 text-lg">{bt.amount.toLocaleString()} CVE</span>
                                    </div>
                                    
                                    {selectedInvoice && (
                                        <div className="pt-3 border-t border-green-200 flex justify-between items-center">
                                            <div className="text-xs text-green-800 font-medium flex items-center gap-1">
                                                <CheckCircle2 size={12}/> Match Perfeito
                                            </div>
                                            <button 
                                                onClick={() => { onMatch(selectedInvoice, bt); onClose(); }}
                                                className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold uppercase shadow-sm hover:bg-green-700 transition-colors"
                                            >
                                                Associar e Liquidar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                                    <AlertCircle size={32} className="mb-2 opacity-20"/>
                                    <p className="text-sm">Nenhum movimento bancário não conciliado encontrado com valor próximo de <strong>{selectedValues?.liquid.toLocaleString()} CVE</strong>.</p>
                                    <p className="text-xs mt-2 opacity-70">Verifique se o extrato foi importado na Tesouraria.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t mt-4 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50">Fechar</button>
                </div>
            </div>
        </Modal>
    );
};
