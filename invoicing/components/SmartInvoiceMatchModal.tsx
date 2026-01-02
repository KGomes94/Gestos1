
import React, { useState, useMemo } from 'react';
import { Invoice, BankTransaction, SystemSettings } from '../../types';
import Modal from '../../components/Modal';
import { CheckCircle2, Wand2, Search, Calendar, Filter, X, CheckSquare, AlertCircle, PlusCircle, Lock } from 'lucide-react';

interface SmartPurchaseMatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoices: Invoice[];
    bankTransactions: BankTransaction[];
    settings: SystemSettings;
    onMatch: (invoice: Invoice, bankTx: BankTransaction) => void;
}

export const SmartInvoiceMatchModal: React.FC<SmartPurchaseMatchModalProps> = ({
    isOpen, onClose, invoices, bankTransactions, settings, onMatch
}) => {
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [bankSearch, setBankSearch] = useState('');
    
    // Filtros de Tempo (Padrão: Todos os meses do ano corrente)
    const [filterMonth, setFilterMonth] = useState<number>(0); // 0 = Todos
    const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

    // Helper: Verificar correspondência de data
    const checkDateMatch = (dateStr: string) => {
        const d = new Date(dateStr);
        const matchYear = d.getFullYear() === filterYear;
        const matchMonth = filterMonth === 0 || (d.getMonth() + 1) === filterMonth;
        return matchYear && matchMonth;
    };

    // 1. LISTA DE FATURAS (Esquerda)
    const displayedInvoices = useMemo(() => {
        return invoices
            .filter(i => {
                // Excluir eliminados
                if (i._deleted) return false;
                
                // Excluir Notas de Crédito da conciliação de entrada (normalmente concilia-se recebimento)
                if (i.type === 'NCE') return false;

                // Filtro de Texto
                const matchText = 
                    i.clientName.toLowerCase().includes(invoiceSearch.toLowerCase()) || 
                    i.id.toLowerCase().includes(invoiceSearch.toLowerCase());
                
                // Filtro de Data
                const matchDate = checkDateMatch(i.date);

                return matchText && matchDate;
            })
            .sort((a, b) => {
                // Ordenar: Pendentes primeiro, depois por data
                const isAPending = a.status === 'Emitida' || a.status === 'Pendente Envio';
                const isBPending = b.status === 'Emitida' || b.status === 'Pendente Envio';
                if (isAPending && !isBPending) return -1;
                if (!isAPending && isBPending) return 1;
                return b.date.localeCompare(a.date);
            });
    }, [invoices, invoiceSearch, filterMonth, filterYear]);

    // Calcular valores da fatura selecionada
    const getInvoiceValues = (invoice: Invoice) => {
        const sub = Number(invoice.subtotal) || 0;
        const tax = Number(invoice.taxTotal) || 0;
        const retention = Number(invoice.withholdingTotal) || 0;
        const gross = sub + tax;
        const liquid = gross - retention;
        return { gross, retention, liquid };
    };

    // 2. LISTA DE MOVIMENTOS BANCÁRIOS (Direita)
    const displayedBankTxs = useMemo(() => {
        let txs = bankTransactions.filter(bt => {
            // Excluir eliminados (Soft Delete check)
            if ((bt as any)._deleted) return false;

            // Filtro de Texto
            const matchText = bt.description.toLowerCase().includes(bankSearch.toLowerCase());
            
            // Filtro de Data
            const matchDate = checkDateMatch(bt.date);

            return matchText && matchDate;
        });

        // Se houver fatura selecionada, aplicar filtro de "Smart Match"
        if (selectedInvoiceId) {
            const invoice = invoices.find(i => i.id === selectedInvoiceId);
            if (invoice) {
                const { liquid } = getInvoiceValues(invoice);
                const margin = settings.reconciliationValueMargin || 0.1;
                
                // Filtrar por valor aproximado
                txs = txs.filter(bt => {
                    // Apenas entradas (valor positivo) para faturas
                    if (Number(bt.amount) <= 0) return false; 
                    
                    const diff = Math.abs(Number(bt.amount) - liquid);
                    return diff <= margin;
                });
            }
        }

        // Ordenar: Não conciliados primeiro, depois data
        return txs.sort((a, b) => {
            if (!a.reconciled && b.reconciled) return -1;
            if (a.reconciled && !b.reconciled) return 1;
            return b.date.localeCompare(a.date);
        });

    }, [bankTransactions, bankSearch, filterMonth, filterYear, selectedInvoiceId, invoices, settings]);

    const handleConfirmMatch = (invoice: Invoice, bt: BankTransaction) => {
        onMatch(invoice, bt);
        setSelectedInvoiceId(null); 
    };

    if (!isOpen) return null;

    const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);
    const selectedValues = selectedInvoice ? getInvoiceValues(selectedInvoice) : null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Conciliação Inteligente de Faturas">
            <div className="flex flex-col h-[85vh]">
                
                {/* HEADERS E FILTROS GLOBAIS */}
                <div className="bg-gray-50 border-b p-4 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                            <Wand2 size={20}/>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-sm">Painel de Conciliação</h3>
                            <p className="text-xs text-gray-500">Liquida faturas e gera registos de pagamento automaticamente a partir do extrato.</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex items-center bg-white border rounded-lg px-2 py-1 shadow-sm">
                            <Calendar size={14} className="text-gray-400 mr-2"/>
                            <select 
                                className="text-xs font-bold text-gray-700 outline-none bg-transparent py-1"
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(Number(e.target.value))}
                            >
                                <option value={0}>Todos os Meses</option>
                                {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('pt-PT', {month: 'long'})}</option>)}
                            </select>
                            <div className="w-px h-4 bg-gray-200 mx-2"></div>
                            <select 
                                className="text-xs font-bold text-gray-700 outline-none bg-transparent py-1"
                                value={filterYear}
                                onChange={(e) => setFilterYear(Number(e.target.value))}
                            >
                                <option value={2024}>2024</option>
                                <option value={2025}>2025</option>
                                <option value={2026}>2026</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 divide-x divide-gray-200 overflow-hidden">
                    
                    {/* COLUNA ESQUERDA: FATURAS */}
                    <div className="flex flex-col bg-white overflow-hidden">
                        <div className="p-3 bg-gray-50/50 border-b flex flex-col gap-2 sticky top-0 z-10">
                            <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-700 px-1.5 rounded text-[10px]">1</span> Faturas (A Receber)
                            </h3>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Pesquisar cliente ou nº..." 
                                    className="w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                    value={invoiceSearch}
                                    onChange={e => setInvoiceSearch(e.target.value)}
                                />
                                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400"/>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-100/50">
                            {displayedInvoices.map(inv => {
                                const vals = getInvoiceValues(inv);
                                const isUnavailable = inv.status === 'Paga' || inv.status === 'Anulada';
                                const isSelected = selectedInvoiceId === inv.id;

                                return (
                                    <div 
                                        key={inv.id}
                                        onClick={() => !isUnavailable && setSelectedInvoiceId(inv.id)}
                                        className={`p-3 rounded-xl border transition-all relative ${
                                            isUnavailable ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' : 
                                            isSelected ? 'bg-purple-50 border-purple-500 shadow-md z-10 ring-1 ring-purple-500' : 
                                            'bg-white border-gray-200 hover:border-purple-300 cursor-pointer hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800 text-sm truncate max-w-[150px]">{inv.clientName}</span>
                                                <span className="text-[10px] text-gray-500 font-mono">{inv.id}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className={`font-black text-sm block ${isUnavailable ? 'text-gray-500' : 'text-purple-700'}`}>{vals.liquid.toLocaleString()} CVE</span>
                                                {inv.status === 'Paga' ? (
                                                    <span className="text-[9px] text-green-600 uppercase font-bold bg-green-100 px-1.5 py-0.5 rounded flex items-center gap-1 justify-end mt-1">
                                                        <CheckCircle2 size={10}/> Paga
                                                    </span>
                                                ) : isUnavailable ? (
                                                    <span className="text-[9px] text-gray-500 uppercase font-bold bg-gray-200 px-1.5 py-0.5 rounded">{inv.status}</span>
                                                ) : (
                                                    <span className="text-[9px] text-blue-600 uppercase font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">A Receber</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-gray-400 mt-2 border-t border-dashed border-gray-200 pt-1">
                                            <span>{new Date(inv.date).toLocaleDateString()}</span>
                                            {vals.retention > 0 && <span>(c/ Retenção)</span>}
                                        </div>
                                    </div>
                                );
                            })}
                            {displayedInvoices.length === 0 && (
                                <div className="text-center p-8 text-gray-400 text-xs italic">Nenhuma fatura encontrada.</div>
                            )}
                        </div>
                    </div>

                    {/* COLUNA DIREITA: BANCO */}
                    <div className="flex flex-col bg-white overflow-hidden relative">
                        {/* Header Contextual */}
                        <div className={`p-3 border-b flex flex-col gap-2 sticky top-0 z-10 transition-colors ${selectedInvoiceId ? 'bg-purple-50 border-purple-100' : 'bg-gray-50/50'}`}>
                            <div className="flex justify-between items-center h-5">
                                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                                    <span className={`px-1.5 rounded text-[10px] ${selectedInvoiceId ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>2</span>
                                    {selectedInvoiceId ? 'Sugestões (Filtro Automático)' : 'Movimentos Bancários'}
                                </h3>
                                {selectedInvoiceId && (
                                    <button onClick={() => setSelectedInvoiceId(null)} className="text-[10px] font-bold text-purple-700 hover:underline flex items-center gap-1">
                                        <X size={10}/> Limpar Seleção
                                    </button>
                                )}
                            </div>
                            
                            {selectedInvoiceId ? (
                                <div className="bg-white/50 border border-purple-200 rounded-lg p-2 flex justify-between items-center text-xs">
                                    <span className="text-purple-900">Procurando valor:</span>
                                    <span className="font-black text-purple-700">{selectedValues?.liquid.toLocaleString()} CVE</span>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Filtrar extrato..." 
                                        className="w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                        value={bankSearch}
                                        onChange={e => setBankSearch(e.target.value)}
                                    />
                                    <Filter size={12} className="absolute left-2.5 top-2.5 text-gray-400"/>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/30">
                            {displayedBankTxs.map(bt => {
                                const isUnavailable = bt.reconciled;
                                return (
                                    <div key={bt.id} className={`p-3 rounded-xl border transition-all ${
                                        isUnavailable ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed' : 
                                        selectedInvoiceId ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'
                                    }`}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0 mr-2">
                                                <p className="font-bold text-gray-800 text-sm truncate" title={bt.description}>{bt.description}</p>
                                                <p className="text-[10px] text-gray-500">{new Date(bt.date).toLocaleDateString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`font-black text-sm whitespace-nowrap block ${Number(bt.amount) > 0 ? 'text-green-700' : 'text-red-600'}`}>
                                                    {Number(bt.amount) > 0 ? '+' : ''}{Number(bt.amount).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* Estado e Ação */}
                                        <div className="mt-2 pt-2 border-t border-dashed border-gray-200/50 flex justify-between items-center">
                                            {isUnavailable ? (
                                                <span className="text-[9px] text-gray-400 font-bold flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded">
                                                    <Lock size={10}/> Conciliado
                                                </span>
                                            ) : (
                                                <span className="text-[9px] text-gray-400">Pendente</span>
                                            )}

                                            {selectedInvoice && !isUnavailable && (
                                                <button 
                                                    onClick={() => handleConfirmMatch(selectedInvoice, bt)}
                                                    className="bg-green-600 text-white px-3 py-1.5 rounded-md text-[10px] font-bold uppercase shadow-sm hover:bg-green-700 transition-colors flex items-center gap-1"
                                                    title="Gera movimento de pagamento e concilia"
                                                >
                                                    <PlusCircle size={10}/> Match
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {displayedBankTxs.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-400 p-6 text-center">
                                    <AlertCircle size={24} className="mb-2 opacity-20"/>
                                    <p className="text-xs">
                                        {selectedInvoiceId 
                                            ? "Nenhum valor correspondente encontrado." 
                                            : "Nenhum movimento para os filtros selecionados."}
                                    </p>
                                    {selectedInvoiceId && (
                                        <p className="text-[10px] mt-1 opacity-70">
                                            Margem: +/- {settings.reconciliationValueMargin} CVE
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-3 border-t text-[10px] text-gray-500 flex justify-between items-center shrink-0">
                    <span className="italic">
                        Nota: Esta ação cria automaticamente um Registo Financeiro (Pago) e liga-o à linha do banco.
                    </span>
                    <button onClick={onClose} className="px-4 py-1.5 border bg-white rounded-lg font-bold text-gray-600 hover:bg-gray-100">Fechar</button>
                </div>
            </div>
        </Modal>
    );
};
