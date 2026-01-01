
import React, { useState, useMemo } from 'react';
import { Purchase, BankTransaction, SystemSettings } from '../../types';
import Modal from '../../components/Modal';
import { CheckCircle2, Wand2, Search, Calendar, Filter, X, CheckSquare, AlertCircle, PlusCircle } from 'lucide-react';

interface SmartPurchaseMatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    purchases: Purchase[];
    bankTransactions: BankTransaction[];
    settings: SystemSettings;
    onMatch: (purchase: Purchase, bankTx: BankTransaction) => void;
}

export const SmartPurchaseMatchModal: React.FC<SmartPurchaseMatchModalProps> = ({
    isOpen, onClose, purchases, bankTransactions, settings, onMatch
}) => {
    const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
    const [purchaseSearch, setPurchaseSearch] = useState('');
    const [bankSearch, setBankSearch] = useState('');
    const [filterMonth, setFilterMonth] = useState<number>(0);
    const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

    const checkDateMatch = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.getFullYear() === filterYear && (filterMonth === 0 || (d.getMonth() + 1) === filterMonth);
    };

    // 1. COMPRAS (Aberta)
    const displayedPurchases = useMemo(() => {
        return purchases
            .filter(p => {
                if (p._deleted || p.status !== 'Aberta') return false;
                const matchText = p.supplierName.toLowerCase().includes(purchaseSearch.toLowerCase()) || 
                                  p.referenceDocument?.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
                                  p.id.toLowerCase().includes(purchaseSearch.toLowerCase());
                return matchText && checkDateMatch(p.date);
            })
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [purchases, purchaseSearch, filterMonth, filterYear]);

    // 2. BANCO (Saídas)
    const displayedBankTxs = useMemo(() => {
        let txs = bankTransactions.filter(bt => {
            if ((bt as any)._deleted) return false;
            const matchText = bt.description.toLowerCase().includes(bankSearch.toLowerCase());
            return matchText && checkDateMatch(bt.date);
        });

        if (selectedPurchaseId) {
            const purchase = purchases.find(p => p.id === selectedPurchaseId);
            if (purchase) {
                const target = purchase.total;
                const margin = settings.reconciliationValueMargin || 0.1;
                txs = txs.filter(bt => {
                    if (bt.reconciled) return false;
                    // Apenas Saídas (negativo)
                    if (Number(bt.amount) >= 0) return false;
                    const diff = Math.abs(Math.abs(Number(bt.amount)) - target);
                    return diff <= margin;
                });
            }
        }

        return txs.sort((a, b) => b.date.localeCompare(a.date));
    }, [bankTransactions, bankSearch, filterMonth, filterYear, selectedPurchaseId, purchases, settings]);

    if (!isOpen) return null;

    const selectedPurchase = purchases.find(p => p.id === selectedPurchaseId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Conciliação de Pagamentos a Fornecedores">
            <div className="flex flex-col h-[85vh]">
                <div className="bg-red-50 border-b p-4 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white text-red-600 rounded-lg shadow-sm border border-red-100"><Wand2 size={20}/></div>
                        <div>
                            <h3 className="font-bold text-red-900 text-sm">Smart Match (Pagamentos)</h3>
                            <p className="text-xs text-red-700">Liquida contas a pagar e gera registos automaticamente a partir do extrato.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex items-center bg-white border rounded-lg px-2 py-1 shadow-sm">
                            <Calendar size={14} className="text-gray-400 mr-2"/>
                            <select className="text-xs font-bold text-gray-700 outline-none bg-transparent py-1" value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}>
                                <option value={0}>Todos os Meses</option>
                                {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('pt-PT', {month: 'long'})}</option>)}
                            </select>
                            <select className="text-xs font-bold text-gray-700 outline-none bg-transparent py-1 ml-2 border-l pl-2" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
                                <option value={2024}>2024</option><option value={2025}>2025</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 divide-x divide-gray-200 overflow-hidden">
                    {/* ESQUERDA: COMPRAS */}
                    <div className="flex flex-col bg-white overflow-hidden">
                        <div className="p-3 bg-gray-50 border-b flex flex-col gap-2">
                            <h3 className="font-bold text-gray-700 text-xs uppercase">1. Contas a Pagar (Em Dívida)</h3>
                            <div className="relative">
                                <input type="text" placeholder="Pesquisar fornecedor..." className="w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500" value={purchaseSearch} onChange={e => setPurchaseSearch(e.target.value)}/>
                                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400"/>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-100">
                            {displayedPurchases.map(p => (
                                <div key={p.id} onClick={() => setSelectedPurchaseId(p.id)} className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedPurchaseId === p.id ? 'bg-red-50 border-red-500 shadow-md ring-1 ring-red-500' : 'bg-white border-gray-200 hover:border-red-300'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-bold text-gray-800 text-sm block">{p.supplierName}</span>
                                            <span className="text-[10px] text-gray-500 font-mono">Ref: {p.referenceDocument || p.id}</span>
                                        </div>
                                        <span className="font-black text-sm text-red-600">{p.total.toLocaleString()} CVE</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-2">{new Date(p.date).toLocaleDateString()} • Vence: {new Date(p.dueDate).toLocaleDateString()}</div>
                                </div>
                            ))}
                            {displayedPurchases.length === 0 && <div className="text-center p-8 text-gray-400 text-xs italic">Nenhuma conta encontrada.</div>}
                        </div>
                    </div>

                    {/* DIREITA: BANCO */}
                    <div className="flex flex-col bg-white overflow-hidden">
                        <div className={`p-3 border-b flex flex-col gap-2 ${selectedPurchaseId ? 'bg-red-50' : 'bg-gray-50'}`}>
                            <div className="flex justify-between items-center h-5">
                                <h3 className="font-bold text-gray-700 text-xs uppercase">2. Extrato (Débitos)</h3>
                                {selectedPurchaseId && <button onClick={() => setSelectedPurchaseId(null)} className="text-[10px] font-bold text-red-700 flex items-center gap-1"><X size={10}/> Limpar</button>}
                            </div>
                            {selectedPurchaseId ? (
                                <div className="bg-white border border-red-200 rounded-lg p-2 flex justify-between items-center text-xs">
                                    <span className="text-red-900">Procurando:</span>
                                    <span className="font-black text-red-700">{selectedPurchase?.total.toLocaleString()} CVE</span>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input type="text" placeholder="Filtrar extrato..." className="w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500" value={bankSearch} onChange={e => setBankSearch(e.target.value)}/>
                                    <Filter size={12} className="absolute left-2.5 top-2.5 text-gray-400"/>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-100">
                            {displayedBankTxs.map(bt => (
                                <div key={bt.id} className={`p-3 rounded-xl border bg-white border-gray-200 ${bt.reconciled ? 'opacity-60' : ''}`}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 mr-2">
                                            <p className="font-bold text-gray-800 text-sm truncate">{bt.description}</p>
                                            <p className="text-[10px] text-gray-500">{new Date(bt.date).toLocaleDateString()}</p>
                                        </div>
                                        <span className="font-black text-sm text-red-600 whitespace-nowrap">{Number(bt.amount).toLocaleString()}</span>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-dashed border-gray-200 flex justify-between items-center">
                                        {bt.reconciled ? <span className="text-[9px] text-gray-400 font-bold flex items-center gap-1"><CheckSquare size={10}/> Conciliado</span> : <span className="text-[9px] text-gray-400">Pendente</span>}
                                        {selectedPurchase && !bt.reconciled && (
                                            <button 
                                                onClick={() => { onMatch(selectedPurchase, bt); setSelectedPurchaseId(null); }} 
                                                className="bg-red-600 text-white px-3 py-1.5 rounded-md text-[10px] font-bold uppercase shadow-sm hover:bg-red-700 flex items-center gap-1"
                                                title="Gera movimento de pagamento e concilia"
                                            >
                                                <PlusCircle size={10}/> Gerar Movimento & Conciliar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {displayedBankTxs.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-gray-400 p-6 text-center"><AlertCircle size={24} className="mb-2 opacity-20"/><p className="text-xs">Nenhum movimento correspondente.</p></div>}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
