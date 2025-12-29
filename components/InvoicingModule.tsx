
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, Client, Material, SystemSettings, Transaction, RecurringContract, DraftInvoice, BankTransaction, StockMovement } from '../types';
import { FileText, Plus, Search, Printer, CreditCard, LayoutDashboard, Repeat, BarChart4, DollarSign, FileInput, RotateCcw, Play, Calendar, Upload, ArrowUp, ArrowDown, Wand2, FileBarChart, Filter, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNotification } from '../contexts/NotificationContext';
import { printService } from '../services/printService';
import { InvoiceModal } from '../invoicing/components/InvoiceModal';
import { RecurringModal } from '../invoicing/components/RecurringModal';
import { PaymentModal } from '../invoicing/components/PaymentModal';
import { InvoiceImportModal } from '../invoicing/components/InvoiceImportModal';
import { SmartInvoiceMatchModal } from '../invoicing/components/SmartInvoiceMatchModal';
import { useInvoiceDraft } from '../invoicing/hooks/useInvoiceDraft';
import { useRecurringContracts } from '../invoicing/hooks/useRecurringContracts';
import { useInvoiceImport } from '../invoicing/hooks/useInvoiceImport';
import { fiscalRules } from '../invoicing/services/fiscalRules';
import { db } from '../services/db';
import { currency } from '../utils/currency';

interface InvoicingModuleProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    materials: Material[];
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
    settings: SystemSettings;
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    invoices: Invoice[];
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
    recurringContracts: RecurringContract[];
    setRecurringContracts: React.Dispatch<React.SetStateAction<RecurringContract[]>>;
    bankTransactions?: BankTransaction[];
    setBankTransactions?: React.Dispatch<React.SetStateAction<BankTransaction[]>>;
    stockMovements?: StockMovement[]; // NEW
    setStockMovements?: React.Dispatch<React.SetStateAction<StockMovement[]>>; // NEW
}

type SortDirection = 'asc' | 'desc';
interface SortConfig {
  key: keyof Invoice;
  direction: SortDirection;
}

const InvoicingModule: React.FC<InvoicingModuleProps> = ({ 
    clients = [], setClients, materials = [], setMaterials, settings, setTransactions, invoices = [], setInvoices, recurringContracts = [], setRecurringContracts,
    bankTransactions = [], setBankTransactions,
    stockMovements = [], setStockMovements // NEW
}) => {
    const { notify } = useNotification();
    
    // PERSISTÊNCIA DO SUBMENU
    const [subView, setSubView] = useState<'dashboard' | 'list' | 'recurring' | 'reports'>(() => {
        return (localStorage.getItem('inv_subView') as any) || 'dashboard';
    });

    // PERSISTÊNCIA DOS FILTROS
    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem('inv_filters');
        return saved ? JSON.parse(saved) : { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
    });

    useEffect(() => { localStorage.setItem('inv_subView', subView); }, [subView]);
    useEffect(() => { localStorage.setItem('inv_filters', JSON.stringify(filters)); }, [filters]);

    const [searchTerm, setSearchTerm] = useState('');
    // Novos Filtros
    const [valueSearch, setValueSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');

    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });

    // Report Filters
    const [reportFilters, setReportFilters] = useState({
        clientId: '',
        year: new Date().getFullYear(),
        month: 0, // 0 = Todos
        status: 'Todos' as 'Todos' | 'Pendente' | 'Pago'
    });

    // UI States
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isSmartMatchOpen, setIsSmartMatchOpen] = useState(false);
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

    const handleSaveInvoiceSuccess = (invoice: Invoice, originalId?: string) => {
        setInvoices(prev => {
            let list = [...prev];
            
            // 1. Remove o ID original se ele for diferente do novo (caso de Rascunho -> Emitida)
            // Isso evita a duplicação do rascunho na lista.
            if (originalId && originalId !== invoice.id) {
                list = list.filter(i => i.id !== originalId);
            }

            // 2. Se o ID novo já existe, atualiza; se não, adiciona.
            const existsIndex = list.findIndex(i => i.id === invoice.id);
            if (existsIndex >= 0) {
                list[existsIndex] = invoice;
                return list;
            } else {
                return [invoice, ...list];
            }
        });
        setIsInvoiceModalOpen(false); 
    };

    const handleSmartMatchConfirm = (invoice: Invoice, bankTx: BankTransaction) => {
        // 1. Atualizar Fatura para Paga
        const updatedInvoice: Invoice = { ...invoice, status: 'Paga' };
        setInvoices(prev => prev.map(i => i.id === invoice.id ? updatedInvoice : i));

        // 2. Criar Transação de Recebimento
        const newTx: Transaction = {
            id: Date.now(),
            date: bankTx.date, // Data do banco
            description: `Recebimento Fatura ${invoice.id} (Via Banco)`,
            reference: invoice.id,
            type: 'Transferência',
            category: 'Receita Operacional',
            income: invoice.total,
            expense: null,
            status: 'Pago',
            clientId: invoice.clientId,
            clientName: invoice.clientName,
            invoiceId: invoice.id,
            isReconciled: true // Já nasce conciliado
        };
        setTransactions(prev => [newTx, ...prev]);

        // 3. Atualizar Transação Bancária para Conciliada
        if (setBankTransactions) {
            setBankTransactions(prev => prev.map(b => 
                b.id === bankTx.id 
                ? { ...b, reconciled: true, systemMatchIds: [...(b.systemMatchIds || []), newTx.id] } 
                : b
            ));
        }

        notify('success', `Fatura ${invoice.id} liquidada e conciliada com sucesso.`);
    };

    // --- HOOKS ---
    // Passar setters de stock para o hook de rascunho
    const invoiceDraft = useInvoiceDraft(
        settings, 
        handleSaveInvoiceSuccess, 
        handleCreateTransaction, 
        materials, 
        setMaterials, 
        setStockMovements
    );
    
    const recurring = useRecurringContracts(recurringContracts, setRecurringContracts, setInvoices, settings);
    const importHook = useInvoiceImport(clients, setClients, materials, setMaterials, settings, setInvoices);

    // --- ACTIONS ---
    const handleNewInvoice = () => {
        invoiceDraft.initDraft();
        setIsInvoiceModalOpen(true);
    };

    const handleEditInvoice = (inv: Invoice) => {
        invoiceDraft.initDraft(inv);
        setIsInvoiceModalOpen(true);
    };

    const handlePaymentConfirm = (inv: Invoice, method: string, date: string, description: string, category: string) => {
        const updatedInvoice: Invoice = { ...inv, status: 'Paga' };
        setInvoices(prev => prev.map(i => i.id === inv.id ? updatedInvoice : i));
        
        // Create Transaction
        const tx: Transaction = {
            id: Date.now(),
            date: date,
            description: description, // Usa descrição personalizada
            reference: inv.id,
            type: method as any,
            category: category, // Usa categoria selecionada
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
        invoiceDraft.initDraft();
        invoiceDraft.setType('NCE');
        invoiceDraft.setReferenceInvoice(inv);
        setIsInvoiceModalOpen(true);
    };

    const handlePrintReport = () => {
        const client = clients.find(c => c.id === Number(reportFilters.clientId));
        if (!client && reportFilters.clientId !== '') {
            notify('error', 'Cliente inválido selecionado.');
            return;
        }
        
        const periodText = reportFilters.month === 0 
            ? `Ano ${reportFilters.year}` 
            : `${new Date(0, reportFilters.month - 1).toLocaleString('pt-PT', { month: 'long' })} ${reportFilters.year}`;

        printService.printClientStatement(
            reportData, 
            client || { company: 'Todos os Clientes', address: '', nif: '' } as any, 
            periodText,
            settings
        );
    };

    // --- DASHBOARD DATA (Memoized) ---
    const dashboardStats = useMemo(() => {
        const validInvoices = Array.isArray(invoices) ? invoices : [];
        const issued = validInvoices.filter(i => i.status !== 'Rascunho' && i.status !== 'Anulada');
        
        // Filter by Date for Cards
        const filteredIssued = issued.filter(i => {
            const d = new Date(i.date);
            const matchMonth = Number(filters.month) === 0 || (d.getMonth() + 1) === Number(filters.month);
            const matchYear = d.getFullYear() === Number(filters.year);
            return matchMonth && matchYear;
        });

        // Volume Negócios (Tudo que foi faturado valido no periodo)
        const totalInvoiced = filteredIssued.reduce((acc, i) => currency.add(acc, (i.type === 'NCE' ? -Math.abs(i.total) : i.total)), 0);
        
        // Pendente Recebimento (Emitida mas não paga no periodo)
        const pendingValue = filteredIssued.filter(i => i.status === 'Emitida' || i.status === 'Pendente Envio').reduce((acc, i) => currency.add(acc, i.total), 0);
        
        // Total Emitido (Soma absoluta das faturas emitidas no periodo, ignorando status de pagamento)
        const totalIssuedValue = filteredIssued.reduce((acc, i) => currency.add(acc, (i.type === 'NCE' ? -Math.abs(i.total) : i.total)), 0);

        const draftCount = validInvoices.filter(i => i.status === 'Rascunho').length;
        
        // Chart Data (Always Annual for context, or monthly if filtered? Let's keep Annual trend)
        const currentYear = filters.year;
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const chartData = months.map((m, idx) => {
            const monthInvoices = issued.filter(i => {
                if (!i.date) return false;
                const d = new Date(i.date);
                return d.getMonth() === idx && d.getFullYear() === currentYear;
            });
            return {
                name: m,
                faturado: monthInvoices.reduce((acc, i) => currency.add(acc, (i.type==='NCE' ? -i.total : i.total)), 0),
                pago: monthInvoices.filter(i => i.status === 'Paga').reduce((acc, i) => currency.add(acc, (i.type==='NCE' ? -i.total : i.total)), 0)
            };
        });

        return { totalInvoiced, pendingValue, totalIssuedValue, draftCount, chartData };
    }, [invoices, filters.year, filters.month]);

    // --- FILTERED & SORTED LIST ---
    const filteredInvoices = useMemo(() => {
        let result = (Array.isArray(invoices) ? invoices : []).filter(i => {
            const d = new Date(i.date);
            const matchMonth = Number(filters.month) === 0 || (d.getMonth() + 1) === Number(filters.month);
            const matchYear = d.getFullYear() === Number(filters.year);
            const matchSearch = (i.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (i.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (i.iud && i.iud.includes(searchTerm));
            
            const matchValue = !valueSearch || i.total.toString().includes(valueSearch);
            const matchStatus = statusFilter === 'Todos' || i.status === statusFilter;

            return matchMonth && matchYear && matchSearch && matchValue && matchStatus;
        });

        return result.sort((a, b) => {
            const aVal: any = a[sortConfig.key] || '';
            const bVal: any = b[sortConfig.key] || '';
            
            if (sortConfig.key === 'total') {
                return sortConfig.direction === 'asc' ? a.total - b.total : b.total - a.total;
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [invoices, searchTerm, filters, sortConfig, valueSearch, statusFilter]);

    // --- REPORT DATA ---
    const reportData = useMemo(() => {
        return invoices.filter(i => {
            // Ignorar rascunhos e anuladas para extratos oficiais
            if (i.status === 'Rascunho' || i.status === 'Anulada') return false;

            const d = new Date(i.date);
            const matchYear = d.getFullYear() === Number(reportFilters.year);
            const matchMonth = Number(reportFilters.month) === 0 || (d.getMonth() + 1) === Number(reportFilters.month);
            const matchClient = reportFilters.clientId === '' || i.clientId === Number(reportFilters.clientId);
            
            let matchStatus = true;
            if (reportFilters.status === 'Pendente') {
                matchStatus = i.status === 'Emitida' || i.status === 'Pendente Envio';
            } else if (reportFilters.status === 'Pago') {
                matchStatus = i.status === 'Paga';
            }

            return matchYear && matchMonth && matchClient && matchStatus;
        }).sort((a, b) => a.date.localeCompare(b.date));
    }, [invoices, reportFilters]);

    const SortableHeader = ({ label, column }: { label: string, column: keyof Invoice }) => (
        <th className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100 select-none group" onClick={() => setSortConfig({ key: column, direction: sortConfig.key === column && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
            <div className="flex items-center gap-1">
                {label}
                {sortConfig.key === column && (
                    sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-green-600"/> : <ArrowDown size={12} className="text-green-600"/>
                )}
            </div>
        </th>
    );

    return (
        <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
            <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3 self-end md:self-auto">
                    {/* Botão Novo Doc sempre visível para consistência */}
                    <button onClick={handleNewInvoice} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide shadow-lg shadow-green-100 hover:bg-green-700 transition-all flex items-center gap-2">
                        <Plus size={16} /> Novo Doc
                    </button>
                    <div className="flex bg-gray-100 p-1 rounded-lg border">
                        <button onClick={() => setSubView('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'dashboard' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><LayoutDashboard size={16} /> Dash</button>
                        <button onClick={() => setSubView('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'list' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><FileText size={16} /> Documentos</button>
                        <button onClick={() => setSubView('recurring')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'recurring' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><Repeat size={16} /> Avenças</button>
                        <button onClick={() => setSubView('reports')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'reports' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><FileBarChart size={16} /> Relatórios</button>
                    </div>
                </div>
            </div>

            {subView === 'dashboard' && (
                <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto pr-2">
                    <div className="flex justify-end mb-2 gap-2">
                        <select className="border rounded px-2 py-1 text-sm bg-white" value={filters.month} onChange={e => setFilters({...filters, month: Number(e.target.value)})}>
                            <option value={0}>Todos os Meses</option>
                            <option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option><option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option><option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option><option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option>
                        </select>
                        <select className="border rounded px-2 py-1 text-sm bg-white" value={filters.year} onChange={e => setFilters({...filters, year: Number(e.target.value)})}>
                            <option value={2024}>2024</option><option value={2025}>2025</option><option value={2026}>2026</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Emitido</div>
                            <div className="text-2xl font-black text-gray-900">{dashboardStats.totalIssuedValue.toLocaleString()} CVE</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Pendente Recebimento</div>
                            <div className="text-2xl font-black text-orange-600">{dashboardStats.pendingValue.toLocaleString()} CVE</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Volume de Negócios</div>
                            <div className="text-2xl font-black text-green-700">{dashboardStats.totalInvoiced.toLocaleString()} CVE</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Rascunhos</div>
                            <div className="text-2xl font-black text-blue-600">{dashboardStats.draftCount} docs</div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[350px]">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><BarChart4 size={18}/> Evolução Anual ({filters.year})</h3>
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
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up flex flex-col flex-1">
                    <div className="p-4 border-b flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between shrink-0 bg-gray-50/50">
                        <div className="flex flex-wrap gap-2 items-center flex-1 w-full xl:w-auto">
                            <div className="relative flex-1 min-w-[200px]">
                                <input type="text" placeholder="IUD, Nº ou Cliente..." className="pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none w-full bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                            </div>
                            <div className="relative w-32">
                                <input type="text" placeholder="Valor..." className="pl-8 pr-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none w-full bg-white" value={valueSearch} onChange={e => setValueSearch(e.target.value)} />
                                <DollarSign size={14} className="absolute left-3 top-3 text-gray-400" />
                            </div>
                            <select className="border rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                <option value="Todos">Todos os Estados</option>
                                <option value="Rascunho">Rascunho</option>
                                <option value="Emitida">Emitida</option>
                                <option value="Paga">Paga</option>
                                <option value="Anulada">Anulada</option>
                            </select>
                            
                            <div className="flex items-center gap-1 border-l pl-2 ml-1">
                                <select className="border rounded-xl px-2 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" value={filters.month} onChange={e => setFilters({...filters, month: Number(e.target.value)})}>
                                    <option value={0}>Todos</option>
                                    <option value={1}>Jan</option><option value={2}>Fev</option><option value={3}>Mar</option><option value={4}>Abr</option><option value={5}>Mai</option><option value={6}>Jun</option><option value={7}>Jul</option><option value={8}>Ago</option><option value={9}>Set</option><option value={10}>Out</option><option value={11}>Nov</option><option value={12}>Dez</option>
                                </select>
                                <select className="border rounded-xl px-2 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" value={filters.year} onChange={e => setFilters({...filters, year: Number(e.target.value)})}>
                                    <option value={2024}>2024</option><option value={2025}>2025</option><option value={2026}>2026</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full xl:w-auto justify-end">
                            <button onClick={importHook.openModal} className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all text-xs uppercase tracking-widest shadow-sm">
                                <Upload size={16} /> Importar
                            </button>
                            <button onClick={() => setIsSmartMatchOpen(true)} className="bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-100 transition-all text-xs uppercase tracking-widest shadow-sm">
                                <Wand2 size={16} /> Conciliar
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black sticky top-0 z-10 border-b">
                                <tr>
                                    <SortableHeader label="Documento" column="id" />
                                    <SortableHeader label="Data" column="date" />
                                    <SortableHeader label="Cliente" column="clientName" />
                                    <th className="px-6 py-4 text-left">Obs</th>
                                    <th className="px-6 py-4 text-right cursor-pointer" onClick={() => setSortConfig({ key: 'total', direction: sortConfig.key === 'total' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                                        <div className="flex items-center justify-end gap-1">Total {sortConfig.key === 'total' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                                    </th>
                                    <SortableHeader label="Estado" column="status" />
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredInvoices.map(inv => {
                                    const grossTotal = currency.add(inv.subtotal, inv.taxTotal);
                                    const netTotal = inv.total; // Payable
                                    return (
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
                                        <td className="px-6 py-4">
                                            <div className="truncate max-w-[150px] text-xs italic text-gray-500" title={inv.notes}>{inv.notes || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <div className={`font-black ${inv.type === 'NCE' ? 'text-red-600' : 'text-gray-900'} flex items-center gap-2`}>
                                                    {netTotal.toLocaleString()} CVE
                                                    <span className="text-[9px] bg-green-50 text-green-700 px-1 rounded border border-green-100 font-bold">A Receber</span>
                                                </div>
                                                {inv.withholdingTotal > 0 && (
                                                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                                                        <span className="line-through">{grossTotal.toLocaleString()} CVE</span>
                                                        <span className="text-[9px]">Bruto</span>
                                                    </div>
                                                )}
                                            </div>
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
                                                        <button onClick={(e) => { e.stopPropagation(); printService.printInvoice(inv, settings, 'A4'); }} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-colors" title="PDF A4"><Printer size={16}/></button>
                                                        <button onClick={(e) => { e.stopPropagation(); printService.printInvoice(inv, settings, 'Thermal'); }} className="p-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-600 hover:text-white transition-colors" title="Talão"><FileInput size={16}/></button>
                                                        {inv.type !== 'NCE' && (
                                                            <button onClick={() => handlePrepareCreditNote(inv)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition-colors" title="Nota de Crédito"><RotateCcw size={16}/></button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );})}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {subView === 'recurring' && (
               <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto">
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

            {subView === 'reports' && (
                <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto flex flex-col">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm shrink-0">
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Filter size={16}/> Filtros do Relatório</h3>
                        <div className="flex flex-wrap gap-3 items-end">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cliente</label>
                                <select 
                                    className="w-full border rounded-xl p-2.5 text-sm bg-white font-medium outline-none focus:ring-2 focus:ring-green-500" 
                                    value={reportFilters.clientId} 
                                    onChange={e => setReportFilters({...reportFilters, clientId: e.target.value})}
                                >
                                    <option value="">Todos os Clientes</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                                </select>
                            </div>
                            <div className="w-32">
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Ano</label>
                                <select 
                                    className="w-full border rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" 
                                    value={reportFilters.year} 
                                    onChange={e => setReportFilters({...reportFilters, year: Number(e.target.value)})}
                                >
                                    <option value={2023}>2023</option>
                                    <option value={2024}>2024</option>
                                    <option value={2025}>2025</option>
                                    <option value={2026}>2026</option>
                                </select>
                            </div>
                            <div className="w-40">
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Mês</label>
                                <select 
                                    className="w-full border rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" 
                                    value={reportFilters.month} 
                                    onChange={e => setReportFilters({...reportFilters, month: Number(e.target.value)})}
                                >
                                    <option value={0}>Todos</option>
                                    <option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option><option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option><option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option><option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option>
                                </select>
                            </div>
                            <div className="w-40">
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Estado</label>
                                <select 
                                    className="w-full border rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" 
                                    value={reportFilters.status} 
                                    onChange={e => setReportFilters({...reportFilters, status: e.target.value as any})}
                                >
                                    <option value="Todos">Todos</option>
                                    <option value="Pendente">Em Dívida (Pendente)</option>
                                    <option value="Pago">Liquidado (Pago)</option>
                                </select>
                            </div>
                            <div className="flex-none">
                                <button 
                                    onClick={handlePrintReport}
                                    className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100 uppercase text-xs tracking-wide"
                                >
                                    <Download size={16} /> Extrato PDF
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
                        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-700 text-sm">Pré-visualização ({reportData.length} documentos)</h3>
                            <div className="text-xs text-gray-500 font-medium">
                                Total: <span className="text-gray-900 font-bold">{reportData.reduce((acc, i) => currency.add(acc, (i.type==='NCE' ? -i.total : i.total)), 0).toLocaleString()} CVE</span>
                            </div>
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
                                        <tr key={doc.id} className="hover:bg-gray-50">
                                            <td className="p-3 text-gray-600">{safeDate(doc.date)}</td>
                                            <td className="p-3 font-medium text-gray-800">{doc.id}</td>
                                            <td className="p-3 text-gray-600">{doc.clientName}</td>
                                            <td className={`p-3 text-right font-mono font-bold ${doc.type === 'NCE' ? 'text-red-600' : 'text-gray-900'}`}>
                                                {doc.type === 'NCE' ? '-' : ''}{doc.total.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                    doc.status === 'Paga' ? 'bg-green-100 text-green-700' : 
                                                    doc.status === 'Emitida' ? 'bg-orange-100 text-orange-700' : 
                                                    'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {doc.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {reportData.length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Nenhum registo encontrado para os filtros selecionados.</td></tr>
                                    )}
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

export default InvoicingModule;
