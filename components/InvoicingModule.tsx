
import React, { useState, useMemo } from 'react';
import { Invoice, Client, Material, SystemSettings, Transaction, RecurringContract, DraftInvoice } from '../types';
import { FileText, Plus, Search, Printer, CreditCard, LayoutDashboard, Repeat, BarChart4, DollarSign, FileInput, RotateCcw, Play, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNotification } from '../contexts/NotificationContext';
import { printService } from '../services/printService';
import { InvoiceModal } from '../invoicing/components/InvoiceModal';
import { RecurringModal } from '../invoicing/components/RecurringModal';
import { PaymentModal } from '../invoicing/components/PaymentModal';
import { useInvoiceDraft } from '../invoicing/hooks/useInvoiceDraft';
import { useRecurringContracts } from '../invoicing/hooks/useRecurringContracts';
import { fiscalRules } from '../invoicing/services/fiscalRules';

interface InvoicingModuleProps {
    clients: Client[];
    materials: Material[];
    settings: SystemSettings;
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    invoices: Invoice[];
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
    recurringContracts: RecurringContract[];
    setRecurringContracts: React.Dispatch<React.SetStateAction<RecurringContract[]>>;
}

const InvoicingModule: React.FC<InvoicingModuleProps> = ({ 
    clients = [], materials = [], settings, setTransactions, invoices = [], setInvoices, recurringContracts = [], setRecurringContracts 
}) => {
    const { notify } = useNotification();
    const [subView, setSubView] = useState<'dashboard' | 'list' | 'recurring'>('dashboard');
    const [searchTerm, setSearchTerm] = useState('');
    
    // UI States
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);

    // Helpers
    const safeDate = (dateStr: string | undefined | null) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-PT');
    };

    // --- INTEGRATION HANDLERS ---
    const handleCreateTransaction = (inv: Invoice) => {
        const isCreditNote = fiscalRules.isCreditNote(inv.type);
        const tx: Transaction = {
            id: Date.now(),
            date: inv.date,
            description: `${isCreditNote ? 'Nota Crédito' : 'Fatura'} Ref: ${inv.id} - ${inv.clientName}`,
            reference: inv.id,
            type: 'Transferência', // Default, can be updated later
            category: isCreditNote ? 'Devoluções / Estornos' : 'Receita Operacional',
            income: isCreditNote ? null : inv.total,
            expense: isCreditNote ? Math.abs(inv.total) : null,
            status: 'Pago', // Auto-transactions are usually paid immediately if type implies it
            clientId: inv.clientId,
            clientName: inv.clientName,
            invoiceId: inv.id
        };
        setTransactions(prev => [tx, ...prev]);
    };

    const handleSaveInvoiceSuccess = (invoice: Invoice) => {
        if (invoices.some(i => i.id === invoice.id)) {
            setInvoices(prev => prev.map(i => i.id === invoice.id ? invoice : i));
        } else {
            setInvoices(prev => [invoice, ...prev]);
        }
        // Fechar modal apenas se for rascunho salvo, se for emitido mantemos aberto ou fechamos? 
        // A lógica original fechava.
        setIsInvoiceModalOpen(false); 
    };

    // --- HOOKS ---
    const invoiceDraft = useInvoiceDraft(settings, handleSaveInvoiceSuccess, handleCreateTransaction);
    const recurring = useRecurringContracts(recurringContracts, setRecurringContracts, setInvoices, settings);

    // --- ACTIONS ---
    const handleNewInvoice = () => {
        invoiceDraft.initDraft();
        setIsInvoiceModalOpen(true);
    };

    const handleEditInvoice = (inv: Invoice) => {
        invoiceDraft.initDraft(inv);
        setIsInvoiceModalOpen(true);
    };

    const handlePaymentConfirm = (inv: Invoice, method: string, date: string) => {
        const updatedInvoice: Invoice = { ...inv, status: 'Paga' };
        setInvoices(prev => prev.map(i => i.id === inv.id ? updatedInvoice : i));
        
        // Create Transaction
        const tx: Transaction = {
            id: Date.now(),
            date: date,
            description: `Pagamento Ref: ${inv.id} - ${inv.clientName}`,
            reference: inv.id,
            type: method as any,
            category: 'Receita Operacional',
            income: inv.total,
            expense: null,
            status: 'Pago',
            clientId: inv.clientId,
            clientName: inv.clientName,
            invoiceId: inv.id
        };
        setTransactions(prev => [tx, ...prev]);
        
        setIsPayModalOpen(false);
        setSelectedInvoiceForPayment(null);
        notify('success', 'Pagamento registado.');
    };

    const handlePrepareCreditNote = (inv: Invoice) => {
        invoiceDraft.initDraft(); // Reset first
        // Need to set it up specifically for NC, logic exists inside the hook/component but 
        // to launch directly from list we might need to pass the invoice to the modal or hook.
        // For now, consistent with UI, user opens "New", selects Type NC, selects Ref.
        // Or we can add a shortcut:
        invoiceDraft.initDraft();
        invoiceDraft.setType('NCE');
        // We can't easily pre-select the ref invoice without exposing more hook internals or passing props.
        // The original logic did it inside the modal mostly. Let's keep "New Invoice -> NCE -> Select Ref" flow for simplicity 
        // OR open modal and let user navigate.
        setIsInvoiceModalOpen(true);
    };

    // --- DASHBOARD DATA (Memoized) ---
    const dashboardStats = useMemo(() => {
        const validInvoices = Array.isArray(invoices) ? invoices : [];
        const issued = validInvoices.filter(i => i.status !== 'Rascunho' && i.status !== 'Anulada');
        const totalInvoiced = issued.reduce((acc, i) => acc + (i.type === 'NCE' ? -Math.abs(i.total) : i.total), 0);
        const pendingValue = issued.filter(i => i.status === 'Emitida' || i.status === 'Pendente Envio').reduce((acc, i) => acc + i.total, 0);
        const draftCount = validInvoices.filter(i => i.status === 'Rascunho').length;
        
        const currentYear = new Date().getFullYear();
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const chartData = months.map((m, idx) => {
            const monthInvoices = issued.filter(i => {
                if (!i.date) return false;
                const d = new Date(i.date);
                return d.getMonth() === idx && d.getFullYear() === currentYear;
            });
            return {
                name: m,
                faturado: monthInvoices.reduce((acc, i) => acc + (i.type==='NCE' ? -i.total : i.total), 0),
                pago: monthInvoices.filter(i => i.status === 'Paga').reduce((acc, i) => acc + (i.type==='NCE' ? -i.total : i.total), 0)
            };
        });

        return { totalInvoiced, pendingValue, draftCount, chartData };
    }, [invoices]);

    const filteredInvoices = useMemo(() => (Array.isArray(invoices) ? invoices : []).filter(i => 
        (i.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (i.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.iud && i.iud.includes(searchTerm))
    ), [invoices, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><CreditCard className="text-green-600"/> Faturação Profissional</h2>
                    <p className="text-gray-500 text-sm">Gestão de Documentos Fiscais (FTE, Recibos, Notas de Crédito)</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg border">
                    <button onClick={() => setSubView('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'dashboard' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><LayoutDashboard size={16} /> Dash</button>
                    <button onClick={() => setSubView('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'list' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><FileText size={16} /> Documentos</button>
                    <button onClick={() => setSubView('recurring')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'recurring' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><Repeat size={16} /> Avenças</button>
                </div>
            </div>

            {subView === 'dashboard' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Volume de Negócios</div>
                            <div className="text-2xl font-black text-gray-900">{dashboardStats.totalInvoiced.toLocaleString()} CVE</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Valores a Receber</div>
                            <div className="text-2xl font-black text-orange-600">{dashboardStats.pendingValue.toLocaleString()} CVE</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Rascunhos em Aberto</div>
                            <div className="text-2xl font-black text-blue-600">{dashboardStats.draftCount} docs</div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[350px]">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><BarChart4 size={18}/> Faturação vs Recebimento</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={dashboardStats.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                                <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
                                <Bar dataKey="faturado" fill="#3b82f6" name="Emitido" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="pago" fill="#22c55e" name="Recebido" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {subView === 'list' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center gap-4 bg-gray-50/50">
                        <div className="relative flex-1 max-w-md">
                            <input type="text" placeholder="IUD, Nº ou Cliente..." className="pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                        </div>
                        <button onClick={handleNewInvoice} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100">
                            <Plus size={18} /> Novo Documento
                        </button>
                    </div>
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black">
                            <tr>
                                <th className="px-6 py-4 text-left">Documento</th>
                                <th className="px-6 py-4 text-left">Data</th>
                                <th className="px-6 py-4 text-left">Cliente</th>
                                <th className="px-6 py-4 text-right">Total</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredInvoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-gray-50 group">
                                    <td className="px-6 py-4">
                                        <div className="font-black text-gray-800 flex items-center gap-2">
                                            {inv.id}
                                            {inv.type === 'NCE' && <span className="bg-red-100 text-red-600 text-[9px] px-1 rounded">NC</span>}
                                        </div>
                                        <div className="font-mono text-[9px] text-green-700 truncate max-w-[150px]">{inv.iud || 'RASCUNHO / INTERNO'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{safeDate(inv.date)}</td>
                                    <td className="px-6 py-4 font-bold text-gray-700">{inv.clientName}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`font-black ${inv.type === 'NCE' ? 'text-red-600' : 'text-gray-900'}`}>{inv.total.toLocaleString()} CVE</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            inv.status === 'Paga' ? 'bg-green-100 text-green-700' : 
                                            inv.status === 'Emitida' ? 'bg-blue-100 text-blue-700' :
                                            inv.status === 'Rascunho' ? 'bg-gray-200 text-gray-600' :
                                            'bg-orange-100 text-orange-700'
                                        }`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {inv.status === 'Rascunho' ? (
                                                <button onClick={() => handleEditInvoice(inv)} className="text-blue-600 hover:underline text-xs font-bold">Editar</button>
                                            ) : (
                                                <>
                                                    {inv.status === 'Emitida' && inv.type !== 'NCE' && (
                                                        <button onClick={() => { setSelectedInvoiceForPayment(inv); setIsPayModalOpen(true); }} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-colors" title="Registar Pagamento"><DollarSign size={16}/></button>
                                                    )}
                                                    <button onClick={() => printService.printInvoice(inv, settings, 'A4')} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-colors" title="PDF A4"><Printer size={16}/></button>
                                                    <button onClick={() => printService.printInvoice(inv, settings, 'Thermal')} className="p-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-600 hover:text-white transition-colors" title="Talão"><FileInput size={16}/></button>
                                                    {inv.type !== 'NCE' && (
                                                        <button onClick={() => handlePrepareCreditNote(inv)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition-colors" title="Nota de Crédito"><RotateCcw size={16}/></button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {subView === 'recurring' && (
               <div className="space-y-6 animate-fade-in-up">
                   <div className="flex justify-between items-center bg-purple-50 p-4 rounded-xl border border-purple-100">
                       <div>
                           <h3 className="text-purple-900 font-bold">Automação de Avenças</h3>
                           <p className="text-xs text-purple-700">Contratos mensais são processados automaticamente no dia agendado.</p>
                       </div>
                       <div className="flex gap-2">
                           <button onClick={() => recurring.processContractsNow(invoices)} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-purple-700 transition-colors shadow-lg shadow-purple-100">
                               <Play size={14}/> Processar Avenças Agora
                           </button>
                           <button onClick={() => { recurring.initContract(); setIsRecurringModalOpen(true); }} className="bg-white border border-purple-200 text-purple-700 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-purple-50 transition-colors">
                               <Plus size={14}/> Novo Contrato
                           </button>
                       </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(Array.isArray(recurringContracts) ? recurringContracts : []).map(c => (
                            <div key={c.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between hover:shadow-md transition-shadow group">
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.active ? 'Ativo' : 'Inativo'}</span>
                                        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">{c.frequency}</span>
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">{c.clientName}</h3>
                                    <p className="text-xs text-gray-500 mb-4">{c.description || 'Sem descrição'}</p>
                                    <div className="space-y-2 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="flex justify-between"><span>Próxima Emissão:</span> <span className={`font-bold flex items-center gap-1 ${new Date(c.nextRun) <= new Date() ? 'text-red-600' : 'text-gray-700'}`}><Calendar size={12}/> {safeDate(c.nextRun)}</span></div>
                                        <div className="flex justify-between"><span>Valor Previsto:</span> <span className="font-bold text-green-700">{(c.amount || 0).toLocaleString()} CVE</span></div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { recurring.initContract(c); setIsRecurringModalOpen(true); }} className="text-blue-600 text-xs font-bold uppercase hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">Editar</button>
                                </div>
                            </div>
                        ))}
                   </div>
               </div>
            )}

            <InvoiceModal 
                isOpen={isInvoiceModalOpen}
                onClose={() => setIsInvoiceModalOpen(false)}
                draftState={invoiceDraft}
                clients={clients}
                materials={materials}
                invoices={invoices}
            />

            <RecurringModal 
                isOpen={isRecurringModalOpen}
                onClose={() => setIsRecurringModalOpen(false)}
                clients={clients}
                materials={materials}
                recurringHook={recurring}
            />

            <PaymentModal 
                isOpen={isPayModalOpen}
                onClose={() => setIsPayModalOpen(false)}
                invoice={selectedInvoiceForPayment}
                settings={settings}
                onConfirm={handlePaymentConfirm}
            />
        </div>
    );
};

export default InvoicingModule;
