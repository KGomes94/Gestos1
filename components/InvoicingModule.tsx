
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, Client, Material, SystemSettings, RecurringContract, BankTransaction, StockMovement } from '../types';
import { useInvoiceImport } from '../invoicing/hooks/useInvoiceImport';
import { useInvoiceDraft } from '../invoicing/hooks/useInvoiceDraft';
import { useRecurringContracts } from '../invoicing/hooks/useRecurringContracts';
import { 
    Plus, LayoutDashboard, FileText, Repeat, FileBarChart, Upload, Wand2, Search, DollarSign, 
    ArrowUp, ArrowDown, BarChart4, Play, Calendar, Filter, Download, Check, Printer, FileInput, RotateCcw,
    CheckCircle2, Circle
} from 'lucide-react';
import { 
    BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, ResponsiveContainer 
} from 'recharts';
import { currency } from '../utils/currency';
import { printService } from '../services/printService';
import { InvoiceModal } from '../invoicing/components/InvoiceModal';
import { RecurringModal } from '../invoicing/components/RecurringModal';
import { InvoiceImportModal } from '../invoicing/components/InvoiceImportModal';
import { SmartInvoiceMatchModal } from '../invoicing/components/SmartInvoiceMatchModal';
import { PaymentModal } from '../invoicing/components/PaymentModal';
import Modal from './Modal';
import { db } from '../services/db';

interface InvoicingModuleProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    materials: Material[];
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
    settings: SystemSettings;
    setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
    invoices: Invoice[];
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
    recurringContracts: RecurringContract[];
    setRecurringContracts: React.Dispatch<React.SetStateAction<RecurringContract[]>>;
    bankTransactions: BankTransaction[];
    setBankTransactions: React.Dispatch<React.SetStateAction<BankTransaction[]>>;
    stockMovements: StockMovement[];
    setStockMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>;
}

export const InvoicingModule: React.FC<InvoicingModuleProps> = ({ 
    clients = [], setClients, materials = [], setMaterials, settings, setTransactions, invoices = [], setInvoices, recurringContracts = [], setRecurringContracts,
    bankTransactions = [], setBankTransactions,
    stockMovements = [], setStockMovements
}) => {
    // View State
    const [subView, setSubView] = useState<'dashboard' | 'list' | 'recurring' | 'reports'>('dashboard');
    
    // Persistent Filters Initialization
    const [filters, setFilters] = useState(() => db.filters.getInvoicing());
    const [statusFilter, setStatusFilter] = useState(() => db.filters.getInvoicing().status || 'Todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [valueSearch, setValueSearch] = useState('');
    
    // Save filters on change
    useEffect(() => {
        db.filters.saveInvoicing({ ...filters, status: statusFilter });
    }, [filters, statusFilter]);

    // Reports State
    const [reportFilters, setReportFilters] = useState<{ clientId: string, year: number, month: number, status: 'Todos' | 'Pendente' | 'Pago' }>({
        clientId: '',
        year: new Date().getFullYear(),
        month: 0,
        status: 'Todos'
    });

    // Modals
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isSmartMatchOpen, setIsSmartMatchOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);

    // Batch Processing State
    const [pendingBatch, setPendingBatch] = useState<any[]>([]);

    // Sorting
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    // Hooks
    const invoiceDraft = useInvoiceDraft(settings, (savedInv) => {
        setInvoices(prev => [savedInv, ...prev.filter(i => i.id !== savedInv.id)]);
        setIsInvoiceModalOpen(false);
    }, (inv) => {
        // Create Transaction Hook (Automatic for TVE/FRE/NCE)
        // Correctly use the selected payment method or fallback
        const paymentMethod = inv.paymentMethod || 'Caixa';
        const isCreditNote = inv.type === 'NCE';
        const category = isCreditNote ? 'Devolução de Vendas' : 'Receita Operacional';
        
        // Se for NC, o valor é negativo (Expense) ou dedução de Income. 
        // Na lógica de transação:
        // TVE/FRE: Income = Total, Expense = null
        // NCE: Income = null, Expense = Total (ou Income negativo, depende da contabilidade)
        // Aqui assumimos Expense para NC para simplificar fluxo de caixa visual
        
        const tx = {
            id: Date.now(),
            date: inv.date,
            description: `${isCreditNote ? 'Devolução' : 'Pagamento'} ${inv.type} ${inv.id}`,
            reference: inv.id,
            type: paymentMethod,
            category: category,
            income: isCreditNote ? null : inv.total,
            expense: isCreditNote ? Math.abs(inv.total) : null,
            status: 'Pago',
            invoiceId: inv.id
        };
        setTransactions(prev => [tx, ...prev]);
    }, materials, setMaterials, setStockMovements);

    const importHook = useInvoiceImport(clients, setClients, materials, setMaterials, settings, setInvoices);
    
    const recurring = useRecurringContracts(recurringContracts, setRecurringContracts, setInvoices, settings);

    // --- COMPUTED ---
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        years.add(new Date().getFullYear());
        invoices.forEach(i => years.add(new Date(i.date).getFullYear()));
        return Array.from(years).sort((a,b) => b-a);
    }, [invoices]);

    const dashboardStats = useMemo(() => {
        const yearInvoices = invoices.filter(i => new Date(i.date).getFullYear() === filters.year);
        // Apply month filter for the cards (0 = all months)
        const visibleInvoices = yearInvoices.filter(i => (filters.month === 0) || (new Date(i.date).getMonth() + 1) === filters.month);

        const isCounted = (inv: Invoice) => inv.status !== 'Anulada' && inv.status !== 'Rascunho' && inv.type !== 'NCE';

        const totalIssuedValue = visibleInvoices.filter(isCounted).reduce((acc, i) => currency.add(acc, i.total), 0);
        const pendingValue = visibleInvoices.filter(i => (i.status === 'Emitida' || i.status === 'Pendente Envio') && i.type !== 'NCE').reduce((acc, i) => currency.add(acc, i.total), 0);
        const totalInvoiced = totalIssuedValue;
        const draftCount = invoices.filter(i => i.status === 'Rascunho').length;

        // Monthly billing (for selected month)
        const monthlyBilled = visibleInvoices.filter(isCounted).reduce((acc, i) => currency.add(acc, i.total), 0);
        const monthlyTarget = settings?.monthlyTarget ?? 0;
        const billingPercent = monthlyTarget > 0 ? Math.round((monthlyBilled / monthlyTarget) * 100) : 0;

        const chartData = Array.from({length: 12}, (_, i) => {
            const m = i + 1;
            const monthInvs = yearInvoices.filter(inv => new Date(inv.date).getMonth() + 1 === m);
            return {
                name: new Date(0, i).toLocaleString('pt-PT', {month: 'short'}),
                faturado: monthInvs.filter(i => isCounted(i)).reduce((acc, i) => currency.add(acc, i.total), 0),
                pago: monthInvs.filter(i => i.status === 'Paga').reduce((acc, i) => currency.add(acc, i.total), 0)
            };
        });

        return { totalIssuedValue, pendingValue, totalInvoiced, draftCount, chartData, monthlyBilled, monthlyTarget, billingPercent };
    }, [invoices, filters.year, filters.month, settings?.monthlyTarget]);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(i => {
            const d = new Date(i.date);
            const matchYear = d.getFullYear() === filters.year;
            const matchMonth = filters.month === 0 || (d.getMonth() + 1) === filters.month;
            const matchStatus = statusFilter === 'Todos' || i.status === statusFilter;
            const matchSearch = searchTerm ? (
                i.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                i.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (i.iud && i.iud.toLowerCase().includes(searchTerm.toLowerCase()))
            ) : true;
            const matchValue = valueSearch ? String(i.total).includes(valueSearch) : true;

            return matchYear && matchMonth && matchStatus && matchSearch && matchValue;
        }).sort((a: any, b: any) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [invoices, filters, statusFilter, searchTerm, valueSearch, sortConfig]);

    const verifiedCount = useMemo(() => {
        return filteredInvoices.filter(i => i.isVerified).length;
    }, [filteredInvoices]);

    const reportData = useMemo(() => {
        return invoices.filter(i => {
            if (i.status === 'Rascunho' || i.status === 'Anulada') return false;
            const d = new Date(i.date);
            const matchYear = d.getFullYear() === reportFilters.year;
            const matchMonth = reportFilters.month === 0 || (d.getMonth() + 1) === reportFilters.month;
            const matchClient = reportFilters.clientId ? String(i.clientId) === String(reportFilters.clientId) : true;
            
            let matchStatus = true;
            if (reportFilters.status === 'Pendente') matchStatus = i.status === 'Emitida' || i.status === 'Pendente Envio';
            if (reportFilters.status === 'Pago') matchStatus = i.status === 'Paga';

            return matchYear && matchMonth && matchClient && matchStatus;
        }).sort((a,b) => b.date.localeCompare(a.date));
    }, [invoices, reportFilters]);

    // --- HANDLERS ---
    const handleNewInvoice = () => {
        invoiceDraft.initDraft();
        setIsInvoiceModalOpen(true);
    };

    const handleEditInvoice = (inv: Invoice) => {
        invoiceDraft.initDraft(inv);
        setIsInvoiceModalOpen(true);
    };

    const handlePrepareCreditNote = (inv: Invoice) => {
        invoiceDraft.initDraft();
        invoiceDraft.setType('NCE');
        invoiceDraft.setReferenceInvoice(inv);
        setIsInvoiceModalOpen(true);
    };

    const prepareRecurringProcessing = () => {
        // Mock logic for demo
        const pending = recurringContracts.filter(c => c.active).map(c => ({
            clientName: c.clientName,
            description: c.description,
            originalAmount: c.amount,
            processAmount: c.amount
        }));
        setPendingBatch(pending);
        setIsBatchModalOpen(true);
    };

    const executeRecurringProcessing = () => {
        recurring.processContractsNow(invoices);
        setIsBatchModalOpen(false);
    };

    const handleSmartMatchConfirm = (inv: Invoice, bt: BankTransaction) => {
        // Mark Invoice as Paid
        const updatedInvoices = invoices.map(i => i.id === inv.id ? { ...i, status: 'Paga' as const } : i);
        setInvoices(updatedInvoices);

        // Mark Bank as Reconciled
        const updatedBank = bankTransactions.map(b => b.id === bt.id ? { ...b, reconciled: true } : b);
        setBankTransactions(updatedBank);

        // Create Transaction Record
        const tx: any = {
            id: Date.now(),
            date: bt.date,
            description: `Recebimento Ref: ${inv.id}`,
            reference: bt.id, // Link to bank ID
            type: 'Transferência',
            category: 'Receita Operacional',
            income: Number(bt.amount),
            expense: null,
            status: 'Pago',
            isReconciled: true,
            invoiceId: inv.id
        };
        setTransactions(prev => [tx, ...prev]);
    };

    const handlePaymentConfirm = (invoice: Invoice, method: string, date: string, desc: string, cat: string) => {
        // Update Invoice
        setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, status: 'Paga' } : i));
        
        // Create Transaction
        const tx: any = {
            id: Date.now(),
            date,
            description: desc,
            reference: invoice.id,
            type: method,
            category: cat,
            income: invoice.total,
            expense: null,
            status: 'Pago',
            invoiceId: invoice.id
        };
        setTransactions(prev => [tx, ...prev]);
        setIsPayModalOpen(false);
    };

    const handlePrintReport = () => {
        if (!reportFilters.clientId) return;
        const client = clients.find(c => String(c.id) === String(reportFilters.clientId));
        if (client) {
            printService.printClientStatement(reportData, client, `${reportFilters.year}`, settings);
        }
    };

    const toggleVerification = (inv: Invoice, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = { ...inv, isVerified: !inv.isVerified };
        setInvoices(prev => prev.map(i => i.id === inv.id ? updated : i));
    };

    // CORREÇÃO DE DATAS: Parse direto de YYYY-MM-DD
    const safeDate = (dateStr: string) => {
        if (!dateStr) return '';
        const cleanDate = dateStr.split('T')[0];
        const parts = cleanDate.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    // Helper Components
    const SortableHeader = ({ label, column }: any) => (
        <th className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100" onClick={() => setSortConfig({ key: column, direction: sortConfig.key === column && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
            <div className="flex items-center gap-1">
                {label}
                {sortConfig.key === column && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
            </div>
        </th>
    );

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* ... (rest of the render is largely unchanged, just uses persistent filters) */}
            <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3 self-end md:self-auto">
                    <button onClick={handleNewInvoice} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide shadow-lg shadow-green-100 hover:bg-green-700 transition-all flex items-center gap-2"><Plus size={16} /> Novo Doc</button>
                    <div className="flex bg-gray-100 p-1 rounded-lg border">
                        <button onClick={() => setSubView('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'dashboard' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><LayoutDashboard size={16} /> Dash</button>
                        <button onClick={() => setSubView('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'list' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><FileText size={16} /> Documentos</button>
                        <button onClick={() => setSubView('recurring')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'recurring' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><Repeat size={16} /> Avenças</button>
                        <button onClick={() => setSubView('reports')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'reports' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><FileBarChart size={16} /> Relatórios</button>
                    </div>
                </div>
            </div>

            {/* VIEWS */}
            {subView === 'dashboard' && (
                <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto pr-2">
                    <div className="flex justify-end mb-2 gap-2">
                        <select className="border rounded px-2 py-1 text-sm bg-white" value={filters.month} onChange={e => setFilters({...filters, month: Number(e.target.value)})}>
                            <option value={0}>Todos os Meses</option>
                            {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('pt-PT', {month: 'long'})}</option>)}
                        </select>
                        <select className="border rounded px-2 py-1 text-sm bg-white" value={filters.year} onChange={e => setFilters({...filters, year: Number(e.target.value)})}>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    {/* ... Dashboard stats render ... */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div title={`Total de faturas emitidas (exclui rascunhos, anuladas e notas de crédito) para o período selecionado`} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200"><div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Emitido</div><div className="text-2xl font-black text-gray-900">{dashboardStats.totalIssuedValue.toLocaleString()} CVE</div></div>
                        <div title={`Total de faturas pendentes de pagamento (exclui rascunhos, anuladas e notas de crédito) para o período selecionado`} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200"><div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Pendente Recebimento</div><div className="text-2xl font-black text-orange-600">{dashboardStats.pendingValue.toLocaleString()} CVE</div></div>
                        <div title={`Volume de negócios pelas faturas (exclui rascunhos, anuladas e notas de crédito) para o período selecionado`} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200"><div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Volume de Negócios</div><div className="text-2xl font-black text-green-700">{dashboardStats.totalInvoiced.toLocaleString()} CVE</div></div>
                        <div title={`Número de faturas em rascunho`} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200"><div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Rascunhos</div><div className="text-2xl font-black text-blue-600">{dashboardStats.draftCount} docs</div></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[350px]">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><BarChart4 size={18}/> Evolução Anual ({filters.year})</h3>
                        <ResponsiveContainer width="100%" height="90%"><BarChart data={dashboardStats.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} /><YAxis axisLine={false} tickLine={false} fontSize={12} /><Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/><Bar dataKey="faturado" fill="#3b82f6" name="Emitido" radius={[4, 4, 0, 0]} /><Bar dataKey="pago" fill="#22c55e" name="Recebido" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
                    </div>
                </div>
            )}

            {subView === 'list' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up flex flex-col flex-1">
                    <div className="p-4 border-b flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between shrink-0 bg-gray-50/50">
                        <div className="flex flex-wrap gap-2 items-center flex-1 w-full xl:w-auto">
                            <div className="relative flex-1 min-w-[200px]"><input type="text" placeholder="IUD, Nº ou Cliente..." className="pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none w-full bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /><Search size={16} className="absolute left-3 top-2.5 text-gray-400" /></div>
                            <div className="relative w-32"><input type="text" placeholder="Valor..." className="pl-8 pr-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none w-full bg-white" value={valueSearch} onChange={e => setValueSearch(e.target.value)} /><DollarSign size={14} className="absolute left-3 top-3 text-gray-400" /></div>
                            <select className="border rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="Todos">Todos os Estados</option><option value="Rascunho">Rascunho</option><option value="Emitida">Emitida</option><option value="Paga">Paga</option><option value="Anulada">Anulada</option></select>
                            <div className="flex items-center gap-1 border-l pl-2 ml-1">
                                <select className="border rounded-xl px-2 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" value={filters.month} onChange={e => setFilters({...filters, month: Number(e.target.value)})}>
                                    <option value={0}>Todos</option>
                                    {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('pt-PT', {month: 'short'})}</option>)}
                                </select>
                                <select className="border rounded-xl px-2 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" value={filters.year} onChange={e => setFilters({...filters, year: Number(e.target.value)})}>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
                            </div>
                        </div>
                        {/* ... Rest of list view ... */}
                        <div className="flex gap-2 w-full xl:w-auto justify-end">
                            {verifiedCount > 0 && <span className="bg-green-100 text-green-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center">{verifiedCount} Verificados</span>}
                            <button onClick={importHook.openModal} className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all text-xs uppercase tracking-widest shadow-sm"><Upload size={16} /> Importar</button>
                            <button onClick={() => setIsSmartMatchOpen(true)} className="bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-100 transition-all text-xs uppercase tracking-widest shadow-sm"><Wand2 size={16} /> Conciliar</button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black sticky top-0 z-10 border-b">
                                <tr>
                                    <th className="px-4 py-4 w-12 text-center">Verif.</th>
                                    <SortableHeader label="Documento" column="id" />
                                    <SortableHeader label="Data" column="date" />
                                    <SortableHeader label="Cliente" column="clientName" />
                                    <th className="px-6 py-4 text-left">Obs</th>
                                    <th className="px-6 py-4 text-right cursor-pointer" onClick={() => setSortConfig({ key: 'total', direction: sortConfig.key === 'total' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}><div className="flex items-center justify-end gap-1">Total {sortConfig.key === 'total' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div></th>
                                    <SortableHeader label="Estado" column="status" />
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredInvoices.map(inv => {
                                    const grossTotal = currency.add(inv.subtotal, inv.taxTotal);
                                    const netTotal = inv.total;
                                    return (
                                    <tr key={inv.id} className="hover:bg-gray-50 group">
                                        <td className="px-4 py-4 text-center">
                                            <button 
                                                onClick={(e) => toggleVerification(inv, e)} 
                                                className={`transition-colors p-1 rounded-full hover:bg-gray-100 ${inv.isVerified ? 'text-green-600' : 'text-gray-300'}`}
                                                title={inv.isVerified ? "Marcado como confirmado/verificado" : "Marcar como verificado"}
                                            >
                                                {inv.isVerified ? <CheckCircle2 size={18} fill="currentColor" className="text-green-100" /> : <Circle size={18} />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4"><div className="font-black text-gray-800 flex items-center gap-2">{inv.id}{inv.type === 'NCE' && <span className="bg-red-100 text-red-600 text-[9px] px-1 rounded">NC</span>}</div><div className="font-mono text-[9px] text-green-700 truncate max-w-[150px]">{inv.iud || 'RASCUNHO / INTERNO'}</div></td>
                                        <td className="px-6 py-4 text-gray-600">{safeDate(inv.date)}</td>
                                        <td className="px-6 py-4 font-bold text-gray-700">{inv.clientName}</td>
                                        <td className="px-6 py-4"><div className="truncate max-w-[150px] text-xs italic text-gray-500" title={inv.notes}>{inv.notes || '-'}</div></td>
                                        <td className="px-6 py-4 text-right"><div className="flex flex-col items-end"><div className={`font-black ${inv.type === 'NCE' ? 'text-red-600' : 'text-gray-900'} flex items-center gap-2`}>{netTotal.toLocaleString()} CVE<span className="text-[9px] bg-green-50 text-green-700 px-1 rounded border border-green-100 font-bold">A Receber</span></div>{inv.withholdingTotal > 0 && (<div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2"><span className="line-through">{grossTotal.toLocaleString()} CVE</span><span className="text-[9px]">Bruto</span></div>)}</div></td>
                                        <td className="px-6 py-4 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${inv.status === 'Paga' ? 'bg-green-100 text-green-700' : inv.status === 'Emitida' ? 'bg-blue-100 text-blue-700' : inv.status === 'Rascunho' ? 'bg-gray-200 text-gray-600' : 'bg-orange-100 text-orange-700'}`}>{inv.status}</span></td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {inv.status === 'Rascunho' ? (<button onClick={() => handleEditInvoice(inv)} className="text-blue-600 hover:underline text-xs font-bold">Editar</button>) : (<>{inv.status === 'Emitida' && inv.type !== 'NCE' && (<button onClick={() => { setSelectedInvoiceForPayment(inv); setIsPayModalOpen(true); }} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-colors" title="Registar Pagamento"><DollarSign size={16}/></button>)}<button onClick={(e) => { e.stopPropagation(); printService.printInvoice(inv, settings, 'A4'); }} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-colors" title="PDF A4"><Printer size={16}/></button><button onClick={(e) => { e.stopPropagation(); printService.printInvoice(inv, settings, 'Thermal'); }} className="p-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-600 hover:text-white transition-colors" title="Talão"><FileInput size={16}/></button>{inv.type !== 'NCE' && (<button onClick={() => handlePrepareCreditNote(inv)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition-colors" title="Nota de Crédito"><RotateCcw size={16}/></button>)}</>)}
                                            </div>
                                        </td>
                                    </tr>
                                );})}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Other views and modals remain... */}
            {subView === 'recurring' && (
                // ... Recurring view ...
                <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto">
                   {/* ... content ... */}
                   <div className="flex justify-between items-center bg-purple-50 p-4 rounded-xl border border-purple-100">
                       <div>
                           <h3 className="text-purple-900 font-bold">Automação de Avenças</h3>
                           <p className="text-xs text-purple-700">Contratos mensais são processados automaticamente no dia agendado.</p>
                       </div>
                       <div className="flex gap-2">
                           <button onClick={prepareRecurringProcessing} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-purple-700 transition-colors shadow-lg shadow-purple-100">
                               <Play size={14}/> Processar Avenças Agora
                           </button>
                           <button onClick={() => { recurring.initContract(); setIsRecurringModalOpen(true); }} className="bg-white border border-purple-200 text-purple-700 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-purple-50 transition-colors">
                               <Plus size={14}/> Novo Contrato
                           </button>
                       </div>
                   </div>
                   {/* Grid... */}
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

            {subView === 'reports' && (
                // ... Reports view ...
                <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto flex flex-col">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm shrink-0">
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Filter size={16}/> Filtros do Relatório</h3>
                        <div className="flex flex-wrap gap-3 items-end">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cliente</label>
                                <select className="w-full border rounded-xl p-2.5 text-sm bg-white font-medium outline-none focus:ring-2 focus:ring-green-500" value={reportFilters.clientId} onChange={e => setReportFilters({...reportFilters, clientId: e.target.value})}>
                                    <option value="">Todos os Clientes</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                                </select>
                            </div>
                            <div className="w-32"><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Ano</label><select className="w-full border rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" value={reportFilters.year} onChange={e => setReportFilters({...reportFilters, year: Number(e.target.value)})}>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                            <div className="w-40"><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Mês</label><select className="w-full border rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" value={reportFilters.month} onChange={e => setReportFilters({...reportFilters, month: Number(e.target.value)})}> <option value={0}>Todos</option> {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('pt-PT', {month: 'long'})}</option>)}</select></div>
                            <div className="w-40"><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Estado</label><select className="w-full border rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" value={reportFilters.status} onChange={e => setReportFilters({...reportFilters, status: e.target.value as any})}><option value="Todos">Todos</option><option value="Pendente">Em Dívida (Pendente)</option><option value="Pago">Liquidado (Pago)</option></select></div>
                            <div className="flex-none"><button onClick={handlePrintReport} className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100 uppercase text-xs tracking-wide"><Download size={16} /> Extrato PDF</button></div>
                        </div>
                    </div>
                    {/* ... Table preview ... */}
                    <div className="bg-white border rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
                        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-700 text-sm">Pré-visualização ({reportData.length} documentos)</h3>
                            <div className="text-xs text-gray-500 font-medium">Total: <span className="text-gray-900 font-bold">{reportData.reduce((acc, i) => { const val = Math.abs(i.total); return currency.add(acc, (i.type === 'NCE' ? -val : val)); }, 0).toLocaleString()} CVE</span></div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="min-w-full text-xs">
                                <thead className="bg-gray-100 text-gray-500 font-bold uppercase sticky top-0">
                                    <tr>
                                        <th className="p-3 text-left w-24">Data</th>
                                        <th className="p-3 text-left">Documento</th>
                                        <th className="p-3 text-left">Cliente</th>
                                        <th className="p-3 text-right">Valor</th>
                                        <th className="p-3 text-center w-24">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reportData.map(doc => (
                                        <tr key={doc.id} className="hover:bg-gray-50"><td className="p-3 text-gray-600">{safeDate(doc.date)}</td><td className="p-3 font-medium text-gray-800">{doc.id}</td><td className="p-3 text-gray-600">{doc.clientName}</td><td className={`p-3 text-right font-mono font-bold ${doc.type === 'NCE' ? 'text-red-600' : 'text-gray-900'}`}>{doc.type === 'NCE' ? '-' : ''}{doc.total.toLocaleString()}</td><td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${doc.status === 'Paga' ? 'bg-green-100 text-green-700' : doc.status === 'Emitida' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>{doc.status}</span></td></tr>
                                    ))}
                                    {reportData.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Nenhum registo encontrado para os filtros selecionados.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
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

            <Modal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} title="Processar Avenças a Vencer (Faturação)">
                <div className="flex flex-col h-[70vh]">
                    <div className="bg-purple-50 p-4 rounded-xl mb-4 border border-purple-100 flex items-start gap-3">
                        <Wand2 className="text-purple-600 mt-1" size={20}/>
                        <div className="text-sm text-purple-900">
                            <p className="font-bold">Confirme os valores a faturar</p>
                            <p>Pode ajustar o valor de cada avença antes de gerar o rascunho da fatura.</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-xl">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100 sticky top-0 text-gray-500 font-bold uppercase text-xs">
                                <tr>
                                    <th className="p-3 text-left">Cliente</th>
                                    <th className="p-3 text-left">Descrição</th>
                                    <th className="p-3 text-right">Valor Contrato</th>
                                    <th className="p-3 text-right w-40">Valor a Faturar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pendingBatch.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="p-3 font-bold text-gray-700">{item.clientName}</td>
                                        <td className="p-3 text-gray-500">{item.description}</td>
                                        <td className="p-3 text-right font-mono text-gray-400">{item.originalAmount.toLocaleString()}</td>
                                        <td className="p-3 text-right">
                                            <input 
                                                type="number" 
                                                className="w-full border rounded-lg p-1.5 text-right font-bold text-gray-800 focus:ring-2 focus:ring-purple-500 outline-none"
                                                value={item.processAmount}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setPendingBatch(prev => prev.map((x, i) => i === idx ? { ...x, processAmount: val } : x));
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="pt-4 border-t flex justify-end gap-3 mt-auto">
                        <button onClick={() => setIsBatchModalOpen(false)} className="px-4 py-2 border rounded-lg font-bold text-gray-500 hover:bg-gray-50">Cancelar</button>
                        <button onClick={executeRecurringProcessing} className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-purple-700 shadow-lg">
                            <Check size={18}/> Gerar Faturas (Rascunho)
                        </button>
                    </div>
                </div>
            </Modal>

            <InvoiceImportModal
                isOpen={importHook.isModalOpen}
                onClose={() => importHook.setIsModalOpen(false)}
                isLoading={importHook.isLoading}
                drafts={importHook.previewDrafts}
                errors={importHook.validationErrors}
                summary={importHook.summary}
                onConfirm={importHook.confirmImport}
                onFileSelect={importHook.handleFileSelect}
                fileInputRef={importHook.fileInputRef}
            />

            <SmartInvoiceMatchModal
                isOpen={isSmartMatchOpen}
                onClose={() => setIsSmartMatchOpen(false)}
                invoices={invoices}
                bankTransactions={bankTransactions}
                settings={settings}
                onMatch={handleSmartMatchConfirm}
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
