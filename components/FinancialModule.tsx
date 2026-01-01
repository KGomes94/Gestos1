
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Transaction, Account, BankTransaction, Client, Invoice, SystemSettings } from '../types';
import { 
    Plus, Upload, Download, Search, Filter, Trash2, Edit2, Check, X, 
    AlertTriangle, CheckSquare, Wallet, ArrowUp, ArrowDown, TrendingUp, 
    BarChart4, Table, RefreshCw, EyeOff, FileText, ShoppingBag, CopyPlus, 
    Zap, Wand2, Unlink, Ban, Loader2
} from 'lucide-react';
import { currency } from '../utils/currency';
import { db } from '../services/db';
import Modal from './Modal';
import { useNotification } from '../contexts/NotificationContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    AreaChart, Area, ComposedChart 
} from 'recharts';
import * as XLSX from 'xlsx';

interface FinancialModuleProps {
    target: number;
    settings: SystemSettings;
    categories: Account[];
    onAddCategories: (categories: Account[]) => void;
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    bankTransactions: BankTransaction[];
    setBankTransactions: React.Dispatch<React.SetStateAction<BankTransaction[]>>;
    clients: Client[];
    invoices: Invoice[];
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
}

export const FinancialModule: React.FC<FinancialModuleProps> = ({ 
    target, settings, categories = [], onAddCategories, transactions = [], setTransactions, bankTransactions = [], setBankTransactions, clients = [], invoices, setInvoices 
}) => {
    const { notify } = useNotification();
    const { requestConfirmation } = useConfirmation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // View State
    const [subView, setSubView] = useState<'dashboard' | 'records' | 'reconciliation'>('dashboard');
    const [isLoading, setIsLoading] = useState(false);
    
    // Filters
    const [dashFilters, setDashFilters] = useState(() => db.filters.getGlobalDate());
    const [regFilters, setRegFilters] = useState({ month: 0, year: new Date().getFullYear(), hideVoided: false, category: 'Todas', status: 'Todos' });
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction | 'income', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

    // Sync filters
    useEffect(() => {
        db.filters.saveGlobalDate(dashFilters);
        setRegFilters(prev => ({ ...prev, month: dashFilters.month, year: dashFilters.year }));
    }, [dashFilters]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [newTransaction, setNewTransaction] = useState<any>({
        date: new Date().toISOString().split('T')[0],
        type: 'Dinheiro',
        category: '',
        status: 'Pago',
        description: '',
        income: 0,
        expense: 0,
        absValue: ''
    });
    const [newTxType, setNewTxType] = useState<'income' | 'expense'>('income');

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importType, setImportType] = useState<'system' | 'bank'>('system');
    const [previewData, setPreviewData] = useState<any[]>([]);

    // Reconciliation State
    const [recBankStatus, setRecBankStatus] = useState<'all' | 'reconciled' | 'unreconciled'>('unreconciled');
    const [recSysStatus, setRecSysStatus] = useState<'all' | 'reconciled' | 'unreconciled'>('unreconciled');
    const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
    const [selectedSystemIds, setSelectedSystemIds] = useState<number[]>([]);
    
    // Bank Filters
    const [recBankDateMode, setRecBankDateMode] = useState<'month' | 'day'>('month');
    const [recBankDate, setRecBankDate] = useState(new Date().toISOString().slice(0, 7));
    const [recBankSearch, setRecBankSearch] = useState('');
    const [recBankValue, setRecBankValue] = useState('');

    // System Filters
    const [recSysDateMode, setRecSysDateMode] = useState<'month' | 'day'>('month');
    const [recSysDate, setRecSysDate] = useState(new Date().toISOString().slice(0, 7));
    const [recSysSearch, setRecSysSearch] = useState('');
    const [recSysValue, setRecSysValue] = useState('');

    // Auto Match
    const [isAutoFilterEnabled, setIsAutoFilterEnabled] = useState(false);
    const [isAutoMatchModalOpen, setIsAutoMatchModalOpen] = useState(false);
    const [autoMatchProposals, setAutoMatchProposals] = useState<any[]>([]);

    // --- AUTO FILTER EFFECT ---
    useEffect(() => {
        // Se o Auto-Filtro estiver ligado e selecionarmos exatamente 1 linha do banco
        if (isAutoFilterEnabled && selectedBankIds.length === 1) {
            const bankTx = bankTransactions.find(b => b.id === selectedBankIds[0]);
            if (bankTx) {
                // Configurar os filtros da lista do Sistema para encontrar correspondência
                const absAmount = Math.abs(Number(bankTx.amount));
                setRecSysValue(absAmount.toString());
                
                // Extrair YYYY-MM da data do banco
                if (bankTx.date && bankTx.date.length >= 7) {
                    setRecSysDate(bankTx.date.substring(0, 7));
                    setRecSysDateMode('month');
                }
            }
        }
    }, [selectedBankIds, isAutoFilterEnabled, bankTransactions]);

    // --- COMPUTED DATA ---
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        years.add(new Date().getFullYear());
        transactions.forEach(t => years.add(new Date(t.date).getFullYear()));
        return Array.from(years).sort((a,b) => b-a);
    }, [transactions]);

    const formatCurrency = (val: number | null) => (val || 0).toLocaleString('pt-CV', { minimumFractionDigits: 2 }) + ' CVE';
    
    // CORREÇÃO DE DATAS: Manipulação direta da string YYYY-MM-DD para evitar timezones
    const formatDateDisplay = (dateStr: string) => {
        if (!dateStr) return '-';
        // Remove a parte da hora se existir (embora na DB seja suposto ser só YYYY-MM-DD)
        const cleanDate = dateStr.split('T')[0];
        const parts = cleanDate.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    // Dashboard Data
    const dashboardData = useMemo(() => {
        const filteredTxs = transactions.filter(t => {
            if (t.isVoided || t._deleted) return false;
            const d = new Date(t.date);
            const matchYear = d.getFullYear() === dashFilters.year;
            const matchMonth = dashFilters.month === 0 || (d.getMonth() + 1) === dashFilters.month;
            return matchYear && matchMonth;
        });

        const operationalRevenue = filteredTxs.filter(t => t.income && categories.find(c => c.name === t.category)?.type === 'Receita Operacional').reduce((acc, t) => acc + (t.income || 0), 0);
        const variableCosts = filteredTxs.filter(t => t.expense && categories.find(c => c.name === t.category)?.type === 'Custo Direto').reduce((acc, t) => acc + (t.expense || 0), 0);
        const grossMargin = operationalRevenue - variableCosts;
        const grossMarginPerc = operationalRevenue > 0 ? (grossMargin / operationalRevenue) * 100 : 0;
        
        const fixedCosts = filteredTxs.filter(t => t.expense && categories.find(c => c.name === t.category)?.type === 'Custo Fixo').reduce((acc, t) => acc + (t.expense || 0), 0);
        const ebitda = grossMargin - fixedCosts;

        const income = filteredTxs.reduce((acc, t) => acc + (t.income || 0), 0);
        const expense = filteredTxs.reduce((acc, t) => acc + (t.expense || 0), 0);
        const cashBalance = income - expense;

        const balanceSheetMoves = filteredTxs.filter(t => categories.find(c => c.name === t.category)?.type === 'Movimento de Balanço').reduce((acc, t) => acc + (t.income || 0) - (t.expense || 0), 0);
        const financialCosts = filteredTxs.filter(t => t.expense && categories.find(c => c.name === t.category)?.type === 'Despesa Financeira').reduce((acc, t) => acc + (t.expense || 0), 0);
        const netResult = ebitda - financialCosts;

        // Chart Data
        const flowData = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const monthTxs = transactions.filter(t => {
                if (t.isVoided || t._deleted) return false;
                const d = new Date(t.date);
                return d.getFullYear() === dashFilters.year && (d.getMonth() + 1) === m;
            });
            return {
                name: new Date(0, i).toLocaleString('pt-PT', { month: 'short' }),
                income: monthTxs.reduce((acc, t) => acc + (t.income || 0), 0),
                expense: monthTxs.reduce((acc, t) => acc + (t.expense || 0), 0)
            };
        });

        return { operationalRevenue, variableCosts, grossMargin, grossMarginPerc, ebitda, cashBalance, balanceSheetMoves, netResult, flowData };
    }, [transactions, dashFilters, categories]);

    const [evolutionCategory, setEvolutionCategory] = useState('Todas');
    const evolutionData = useMemo(() => {
        return dashboardData.flowData; 
    }, [dashboardData]);

    // Registry Filtered Data
    const registryFilteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (regFilters.hideVoided && t.isVoided) return false;
            const d = new Date(t.date);
            const matchYear = d.getFullYear() === regFilters.year;
            const matchMonth = regFilters.month === 0 || (d.getMonth() + 1) === regFilters.month;
            const matchSearch = searchTerm ? (
                t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(t.income || t.expense).includes(searchTerm)
            ) : true;
            return matchYear && matchMonth && matchSearch;
        }).sort((a,b) => {
            if (sortConfig.key === 'income') { // Sort by amount (income or expense)
               const valA = (a.income || 0) + (a.expense || 0);
               const valB = (b.income || 0) + (b.expense || 0);
               return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }
            // Date sort
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        });
    }, [transactions, regFilters, searchTerm, sortConfig]);

    // Reconciliation Filtered Data
    const recBankTransactions = useMemo(() => {
        return bankTransactions.filter(t => {
            if ((t as any)._deleted) return false;
            if (recBankStatus === 'reconciled' && !t.reconciled) return false;
            if (recBankStatus === 'unreconciled' && t.reconciled) return false;
            
            const d = t.date;
            const matchDate = recBankDateMode === 'month' ? d.startsWith(recBankDate) : d === recBankDate;
            const matchSearch = recBankSearch ? t.description.toLowerCase().includes(recBankSearch.toLowerCase()) : true;
            const matchValue = recBankValue ? String(t.amount).includes(recBankValue) : true;
            
            return matchDate && matchSearch && matchValue;
        }).sort((a,b) => b.date.localeCompare(a.date));
    }, [bankTransactions, recBankStatus, recBankDateMode, recBankDate, recBankSearch, recBankValue]);

    const recSystemTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (t.isVoided || t._deleted) return false;
            if (recSysStatus === 'reconciled' && !t.isReconciled) return false;
            if (recSysStatus === 'unreconciled' && t.isReconciled) return false;

            const d = t.date;
            const matchDate = recSysDateMode === 'month' ? d.startsWith(recSysDate) : d === recSysDate;
            const matchSearch = recSysSearch ? t.description.toLowerCase().includes(recSysSearch.toLowerCase()) : true;
            const amount = t.income || t.expense || 0;
            const matchValue = recSysValue ? String(amount).includes(recSysValue) : true;

            return matchDate && matchSearch && matchValue;
        }).sort((a,b) => b.date.localeCompare(a.date));
    }, [transactions, recSysStatus, recSysDateMode, recSysDate, recSysSearch, recSysValue]);

    // ... (rest of the file remains unchanged, handlers, etc)
    // --- HANDLERS ---

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'system' | 'bank') => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportType(type);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws);
            // Simple mapping for preview - in real app use proper service
            const mapped = data.map((row: any, i) => ({
                id: i,
                date: new Date().toISOString().split('T')[0], // Mock date parsing
                description: row['Descrição'] || row['Description'] || 'Importado',
                amount: row['Valor'] || row['Amount'] || 0,
                isValid: true,
                isDuplicate: false,
                errors: []
            }));
            setPreviewData(mapped);
            setIsImportModalOpen(true);
        };
        reader.readAsBinaryString(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseFloat(newTransaction.absValue);
        if (isNaN(val) || val <= 0) return notify('error', 'Valor inválido');

        const tx: Transaction = {
            ...newTransaction,
            id: editingId || Date.now(),
            income: newTxType === 'income' ? val : null,
            expense: newTxType === 'expense' ? val : null,
            updatedAt: new Date().toISOString()
        };

        if (editingId) {
            setTransactions(prev => prev.map(t => t.id === editingId ? tx : t));
            notify('success', 'Registo atualizado');
        } else {
            setTransactions(prev => [tx, ...prev]);
            notify('success', 'Registo criado');
        }
        setIsModalOpen(false);
    };

    const handleEdit = (t: Transaction) => {
        setEditingId(t.id);
        setNewTxType(t.income ? 'income' : 'expense');
        setNewTransaction({
            ...t,
            absValue: t.income || t.expense
        });
        setIsModalOpen(true);
    };

    const handleDeleteOrVoid = (t: Transaction) => {
        requestConfirmation({
            title: settings.enableTreasuryHardDelete ? "Eliminar Registo" : "Anular Registo",
            message: settings.enableTreasuryHardDelete ? "Tem a certeza? Esta ação é irreversível." : "O registo será marcado como anulado.",
            variant: 'danger',
            confirmText: settings.enableTreasuryHardDelete ? "Eliminar" : "Anular",
            onConfirm: () => {
                if (settings.enableTreasuryHardDelete) {
                    setTransactions(prev => prev.filter(x => x.id !== t.id));
                } else {
                    setTransactions(prev => prev.map(x => x.id === t.id ? { ...x, isVoided: true } : x));
                }
                notify('success', 'Operação realizada');
            }
        });
    };

    const handleSystemUnreconcile = (t: Transaction) => {
        setTransactions(prev => prev.map(x => x.id === t.id ? { ...x, isReconciled: false } : x));
        // Also update bank side
        setBankTransactions(prev => prev.map(b => {
            if(b.systemMatchIds?.includes(t.id)) {
                return { ...b, systemMatchIds: b.systemMatchIds.filter(id => id !== t.id), reconciled: false };
            }
            return b;
        }));
        notify('success', 'Registo desconciliado');
    };

    const handleBankSelect = (id: string) => {
        setSelectedBankIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSystemSelect = (id: number) => {
        setSelectedSystemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const executeReconciliation = () => {
        if (selectedBankIds.length === 0 || selectedSystemIds.length === 0) return;

        const bankTxs = bankTransactions.filter(b => selectedBankIds.includes(b.id));
        const sysTxs = transactions.filter(t => selectedSystemIds.includes(t.id));
        
        // Mark Bank as Reconciled
        const newBank = bankTransactions.map(b => selectedBankIds.includes(b.id) ? { ...b, reconciled: true, systemMatchIds: selectedSystemIds } : b);
        setBankTransactions(newBank);

        // Mark System as Reconciled
        const newSys = transactions.map(t => selectedSystemIds.includes(t.id) ? { ...t, isReconciled: true } : t);
        setTransactions(newSys);

        setSelectedBankIds([]);
        setSelectedSystemIds([]);
        notify('success', 'Conciliação realizada com sucesso');
    };

    // --- AUTO MATCH LOGIC ---
    const handleRunAutoMatch = () => {
        const proposals: any[] = [];
        
        // Unreconciled candidates
        const candidateBank = bankTransactions.filter(b => !b.reconciled && !(b as any)._deleted);
        const candidateSys = transactions.filter(t => !t.isReconciled && !t.isVoided && !t._deleted);
        
        // Track used system IDs to prevent double matching
        const usedSystemIds = new Set<number>();

        candidateBank.forEach(bt => {
            const btAmount = Math.abs(Number(bt.amount));
            const btDate = bt.date;

            // Find match: Exact amount (+/- 0.02) AND Exact Date
            const match = candidateSys.find(st => {
                if (usedSystemIds.has(st.id)) return false;
                const stAmount = st.income || st.expense || 0;
                
                const amountMatch = Math.abs(stAmount - btAmount) < 0.02;
                const dateMatch = st.date === btDate;
                
                return amountMatch && dateMatch;
            });

            if (match) {
                proposals.push({
                    bank: bt,
                    system: match,
                    similarityScore: 1.0
                });
                usedSystemIds.add(match.id);
            }
        });

        if (proposals.length === 0) {
            notify('info', 'Não foram encontradas correspondências exatas (Mesma Data e Valor).');
        } else {
            setAutoMatchProposals(proposals);
            setIsAutoMatchModalOpen(true);
        }
    };

    const executeAutoMatch = (matches: any[]) => {
        let updatedBank = [...bankTransactions];
        let updatedSys = [...transactions];
        let matchCount = 0;

        matches.forEach(m => {
            const { bank, system } = m;
            // Link Bank -> System
            updatedBank = updatedBank.map(b => b.id === bank.id ? { ...b, reconciled: true, systemMatchIds: [system.id] } : b);
            // Link System -> Reconciled
            updatedSys = updatedSys.map(t => t.id === system.id ? { ...t, isReconciled: true } : t);
            matchCount++;
        });

        setBankTransactions(updatedBank);
        setTransactions(updatedSys);
        
        setIsAutoMatchModalOpen(false);
        notify('success', `${matchCount} reconciliações automáticas processadas.`);
    };

    const handleCreateFromBank = (bt: BankTransaction, e: React.MouseEvent) => {
        e.stopPropagation();
        setNewTxType(Number(bt.amount) >= 0 ? 'income' : 'expense');
        setNewTransaction({
            date: bt.date,
            description: bt.description,
            absValue: Math.abs(Number(bt.amount)),
            status: 'Pago',
            type: 'Transferência',
            category: 'Geral'
        });
        setEditingId(null);
        setIsModalOpen(true);
    };

    const confirmImport = () => {
        // Placeholder
        setIsImportModalOpen(false);
    };

    const exportToExcel = (data: any[], filename: string) => {
        notify('info', 'Exportação iniciada...');
    };

    const groupedCategories = categories.reduce((acc, cat) => {
        if (!acc[cat.type]) acc[cat.type] = [];
        acc[cat.type].push(cat);
        return acc;
    }, {} as Record<string, Account[]>);

    const SortableHeader = ({ label, column }: { label: string, column: any }) => (
        <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100 select-none" onClick={() => setSortConfig({ key: column, direction: sortConfig.key === column && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
            {label} {sortConfig.key === column && (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="inline ml-1 text-green-600"/> : <ArrowDown size={14} className="inline ml-1 text-green-600"/>)}
        </th>
    );

    return (
    // FIX: h-full flex flex-col gap-4. Sem space-y-4 para evitar overflow de margins.
    <div className="h-full flex flex-col gap-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-2 shrink-0">
        <div><h2 className="text-xl font-bold text-gray-800">Tesouraria & Controlo</h2></div>
        <div className="flex items-center gap-3 self-end md:self-auto">
            {subView === 'dashboard' && (
                <button onClick={() => { setEditingId(null); setNewTransaction({ date: new Date().toISOString().split('T')[0], type: 'Dinheiro', category: '', status: 'Pago', absValue: '' }); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center gap-2">
                    <Plus size={16} /> Novo Registo
                </button>
            )}
            <div className="flex bg-gray-200 p-1 rounded-lg">
                <button onClick={() => setSubView('dashboard')} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'dashboard' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><BarChart4 size={16} /><span className="hidden sm:inline">Indicadores</span></button>
                <button onClick={() => setSubView('records')} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'records' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><Table size={16} /><span className="hidden sm:inline">Registo</span></button>
                <button onClick={() => setSubView('reconciliation')} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'reconciliation' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><RefreshCw size={16} /><span className="hidden sm:inline">Conciliação</span></button>
            </div>
        </div>
      </div>

      {/* DASHBOARD VIEW */}
      {subView === 'dashboard' && (
          <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto pr-2 pb-4">
              <div className="flex justify-end">
                  <div className="flex gap-2">
                      <select name="month" value={dashFilters.month} onChange={(e) => setDashFilters({...dashFilters, month: Number(e.target.value)})} className="border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white"><option value={0}>Todos os Meses</option><option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option><option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option><option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option><option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option></select>
                      <select name="year" value={dashFilters.year} onChange={(e) => setDashFilters({...dashFilters, year: Number(e.target.value)})} className="border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white">
                          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                  </div>
              </div>

              {/* KPI Cards */}
              <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest flex items-center gap-2 border-b pb-2"><TrendingUp size={16}/> Saúde Económica (Operacional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Receita Operacional</p>
                      <h3 className="text-xl font-bold text-green-700 mt-1">{formatCurrency(dashboardData.operationalRevenue)}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-400">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Custos Diretos (CMV)</p>
                      <h3 className="text-xl font-bold text-orange-600 mt-1">{formatCurrency(dashboardData.variableCosts)}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
                      <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Margem Bruta</p>
                            <h3 className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(dashboardData.grossMargin)}</h3>
                          </div>
                          <span className="text-xs font-bold text-blue-400">{dashboardData.grossMarginPerc.toFixed(1)}%</span>
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">EBITDA</p>
                      <h3 className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(dashboardData.ebitda)}</h3>
                      <p className="text-[9px] text-gray-400 mt-1">Lucro antes de Juros/Taxas</p>
                  </div>
              </div>

              <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest flex items-center gap-2 border-b pb-2 mt-4"><Wallet size={16}/> Fluxo de Caixa (Real)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-800 text-white p-6 rounded-lg shadow-md">
                      <div className="flex justify-between">
                          <div>
                              <p className="text-[10px] font-bold uppercase opacity-70">Fluxo Líquido (Período)</p>
                              <h3 className="text-2xl font-bold mt-1">{formatCurrency(dashboardData.cashBalance)}</h3>
                          </div>
                          <Wallet className="text-green-400" size={24}/>
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Movimentos de Balanço</p>
                      <h3 className={`text-xl font-bold mt-1 ${dashboardData.balanceSheetMoves >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(dashboardData.balanceSheetMoves)}</h3>
                      <p className="text-[9px] text-gray-400 mt-1">Empréstimos, Investimentos</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Resultado Líquido</p>
                      <h3 className={`text-xl font-bold mt-1 ${dashboardData.netResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(dashboardData.netResult)}</h3>
                      <p className="text-[9px] text-gray-400 mt-1">Após Custos Fixos e Financeiros</p>
                  </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 h-[300px]">
                      <h3 className="text-sm font-bold text-gray-600 mb-4 ml-2">Fluxo de Caixa Mensal</h3>
                      <ResponsiveContainer width="100%" height="90%"><ComposedChart data={dashboardData.flowData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip formatter={(v:any)=>formatCurrency(v)}/><Legend/><Bar dataKey="income" name="Entrada" fill="#16a34a" barSize={30}/><Bar dataKey="expense" name="Saída" fill="#dc2626" barSize={30}/></ComposedChart></ResponsiveContainer>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 h-[300px]">
                      <div className="flex justify-between items-center mb-4 ml-2 mr-2">
                          <h3 className="text-sm font-bold text-gray-600">Evolução Mensal</h3>
                          <select value={evolutionCategory} onChange={(e) => setEvolutionCategory(e.target.value)} className="text-xs border rounded p-1 outline-none">
                              <option value="Todas">Todas</option>
                              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                      </div>
                      <div className="h-[90%] flex items-center justify-center text-gray-400 text-xs">
                          <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={evolutionData}>
                                  <defs>
                                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#16a34a" stopOpacity={0.1}/>
                                          <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                                      </linearGradient>
                                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#dc2626" stopOpacity={0.1}/>
                                          <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                                      </linearGradient>
                                  </defs>
                                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                                  <YAxis fontSize={10} tickLine={false} axisLine={false} />
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <Tooltip formatter={(v:any)=>formatCurrency(v)}/>
                                  <Area type="monotone" dataKey="income" name="Entrada" stroke="#16a34a" fillOpacity={1} fill="url(#colorIncome)" />
                                  <Area type="monotone" dataKey="expense" name="Saída" stroke="#dc2626" fillOpacity={1} fill="url(#colorExpense)" />
                              </AreaChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* RECORDS VIEW */}
      {subView === 'records' && (
          // FIX: flex-1 overflow-hidden e h-full para forçar scroll interno e evitar que o rodapé sobreponha
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg flex flex-col animate-fade-in-up flex-1 overflow-hidden h-full">
              <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0">
                  <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center">
                      <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="border rounded px-3 py-1.5 text-sm w-full md:w-64 outline-none focus:ring-1 focus:ring-green-500"/>
                      <div className="flex gap-2">
                        <select name="month" value={regFilters.month} onChange={(e) => setRegFilters({...regFilters, month: Number(e.target.value)})} className="border rounded px-2 py-1.5 text-sm outline-none flex-1"><option value={0}>Todos os Meses</option><option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option><option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option><option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option><option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option></select>
                        <select name="year" value={regFilters.year} onChange={(e) => setRegFilters({...regFilters, year: Number(e.target.value)})} className="border rounded px-2 py-1.5 text-sm outline-none flex-1">
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      
                      <label className="flex items-center gap-2 cursor-pointer ml-2 select-none">
                          <div className="relative">
                              <input type="checkbox" className="sr-only peer" checked={regFilters.hideVoided || false} onChange={e => setRegFilters({...regFilters, hideVoided: e.target.checked})}/>
                              <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gray-500"></div>
                          </div>
                          <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><EyeOff size={12}/> Ocultar Anulados</span>
                      </label>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto justify-end">
                      <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={(e) => handleFileSelect(e, 'system')} />
                      
                      <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-xl hover:bg-gray-50 text-xs font-black uppercase tracking-widest transition-all shadow-sm whitespace-nowrap">
                          <Upload size={16} /> <span className="hidden sm:inline">Importar</span>
                      </button>
                      <button onClick={() => { setEditingId(null); setNewTransaction({ date: new Date().toISOString().split('T')[0], type: 'Dinheiro', category: '', status: 'Pago', absValue: '' }); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center gap-2 whitespace-nowrap">
                          <Plus size={16} /> <span className="hidden sm:inline">Novo</span>
                      </button>
                  </div>
              </div>
              
              {/* Scrollable Table Area */}
              <div className="overflow-auto flex-1">
                  <table className="min-w-full text-sm divide-y divide-gray-100">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                              <SortableHeader label="Data" column="date"/>
                              <SortableHeader label="Descrição" column="description"/>
                              <SortableHeader label="Categoria" column="category"/>
                              <SortableHeader label="Valor" column="income"/>
                              <th className="px-3 py-3 text-center font-bold text-gray-700 uppercase">Estado</th>
                              <th className="px-3 py-3 text-right font-bold text-gray-700 uppercase">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                          {registryFilteredTransactions.map(t => (
                              <tr key={t.id} className={`hover:bg-gray-50 group ${t.isVoided ? 'opacity-50 grayscale' : ''}`}>
                                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDateDisplay(t.date)}</td>
                                  <td className="px-3 py-3 font-bold text-gray-800">
                                      {t.description} 
                                      {t.isVoided && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded ml-1">ANULADO</span>}
                                      {t.invoiceId && <span className="ml-2 text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 font-normal"><FileText size={10}/> Doc: {t.invoiceId}</span>}
                                      {t.purchaseId && <span className="ml-2 text-[9px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 font-normal"><ShoppingBag size={10}/> Compra: {t.purchaseId}</span>}
                                  </td>
                                  <td className="px-3 py-3"><span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-medium whitespace-nowrap">{t.category}</span></td>
                                  <td className="px-3 py-3 font-mono font-bold whitespace-nowrap">
                                      {t.income ? <span className="text-green-600">+{formatCurrency(t.income)}</span> : <span className="text-red-600">-{formatCurrency(t.expense || 0)}</span>}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                      <div className="flex justify-center gap-1">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${t.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span>
                                        {t.isReconciled && <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded" title="Conciliado"><CheckSquare size={12}/></span>}
                                      </div>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                      {!t.isVoided && (
                                          <div className="flex justify-end gap-1">
                                              <button onClick={() => handleEdit(t)} className="text-blue-400 hover:text-blue-600 p-1 rounded transition-colors" title="Editar"><Edit2 size={16}/></button>
                                              {t.isReconciled && (
                                                  <button onClick={() => handleSystemUnreconcile(t)} className="text-orange-400 hover:text-orange-600 p-1 rounded transition-colors" title="Desconciliar"><Unlink size={16}/></button>
                                              )}
                                              <button onClick={() => handleDeleteOrVoid(t)} className="text-red-300 hover:text-red-600 p-1 rounded transition-colors" title={settings.enableTreasuryHardDelete ? "Eliminar Permanentemente" : "Anular (Estorno)"}>
                                                  {settings.enableTreasuryHardDelete ? <Trash2 size={16}/> : <Ban size={16}/>}
                                              </button>
                                          </div>
                                      )}
                                  </td>
                              </tr>
                          ))}
                          {registryFilteredTransactions.length === 0 && (
                              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nenhum registo encontrado para o período selecionado. Verifique os filtros de Ano e Mês.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* RECONCILIATION SPLIT VIEW */}
      {subView === 'reconciliation' && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden animate-fade-in-up">
              {/* Toolbar */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm shrink-0 gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setIsAutoFilterEnabled(!isAutoFilterEnabled)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-colors ${isAutoFilterEnabled ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          <Zap size={14} className={isAutoFilterEnabled ? "fill-current" : ""}/> Auto-Filtro
                      </button>
                      <button onClick={handleRunAutoMatch} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-200 text-xs font-bold uppercase transition-colors bg-blue-50 text-blue-700 hover:bg-blue-100">
                          <Wand2 size={14} /> Auto-Conciliar
                      </button>
                      
                      {selectedBankIds.length > 0 && selectedSystemIds.length > 0 && (
                          <div className="flex items-center gap-2 ml-2">
                              {(() => {
                                  const bankTxs = bankTransactions.filter(b => selectedBankIds.includes(b.id));
                                  const sysTxs = transactions.filter(t => selectedSystemIds.includes(t.id));
                                  const bankSum = bankTxs.reduce((sum, b) => currency.add(sum, Number(b.amount)), 0);
                                  const sysSum = sysTxs.reduce((acc, t) => currency.add(acc, currency.sub(Number(t.income || 0), Number(t.expense || 0))), 0);
                                  
                                  const diff = Math.abs(bankSum - sysSum);
                                  const margin = settings.reconciliationValueMargin || 0.1;
                                  const isMatch = diff <= margin;
                                  
                                  return (
                                      <>
                                        <span className={`font-mono font-bold text-sm ${isMatch ? 'text-green-600' : 'text-red-600'}`}>
                                            Dif: {formatCurrency(currency.sub(bankSum, sysSum))}
                                        </span>
                                        <button disabled={!isMatch} onClick={executeReconciliation} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-all shadow ${isMatch ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed opacity-50'}`}>
                                            OK
                                        </button>
                                      </>
                                  );
                              })()}
                          </div>
                      )}
                  </div>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                      <button onClick={() => { if(fileInputRef.current) fileInputRef.current.click(); }} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase hover:bg-gray-50 transition-all flex items-center gap-2 flex-1 justify-center md:flex-none">
                          <Upload size={14} /> Importar Extrato
                      </button>
                      <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={(e) => handleFileSelect(e, 'bank')} />
                  </div>
              </div>

              {/* Split Panels Container */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden min-h-0">
                  
                  {/* LEFT: BANK TRANSACTIONS */}
                  <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden shadow-sm h-full">
                      <div className="p-3 border-b bg-gray-50 flex flex-col gap-2 shrink-0">
                          <div className="flex justify-between items-center">
                              <h3 className="font-bold text-gray-700 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Extrato Bancário</h3>
                              <div className="flex gap-1">
                                  <button onClick={() => exportToExcel(recBankTransactions, 'extrato_filtrado')} title="Exportar Lista" className="p-1 text-gray-500 hover:bg-gray-200 rounded"><Download size={16}/></button>
                                  <select className="text-xs border rounded p-1" value={recBankStatus} onChange={e => setRecBankStatus(e.target.value as any)}>
                                      <option value="unreconciled">Pendentes</option>
                                      <option value="reconciled">Conciliados</option>
                                      <option value="all">Todos</option>
                                  </select>
                              </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                              <div className="relative flex gap-1">
                                  <button onClick={() => setRecBankDateMode(recBankDateMode === 'month' ? 'day' : 'month')} className="px-2 border rounded bg-gray-100 text-[10px] font-bold uppercase">{recBankDateMode === 'month' ? 'Mês' : 'Dia'}</button>
                                  <input type={recBankDateMode === 'month' ? 'month' : 'date'} value={recBankDate} onChange={e=>setRecBankDate(e.target.value)} className="w-full text-xs border rounded p-1.5 outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div className="relative">
                                  <input type="text" placeholder="Descrição..." value={recBankSearch} onChange={e=>setRecBankSearch(e.target.value)} className="w-full text-xs border rounded p-1.5 outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div className="relative">
                                  <input type="text" placeholder="Valor..." value={recBankValue} onChange={e=>setRecBankValue(e.target.value)} className="w-full text-xs border rounded p-1.5 outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                          </div>
                      </div>
                      <div className="flex-1 overflow-auto bg-gray-50/30">
                          <table className="min-w-full text-xs">
                              <thead className="bg-gray-100 sticky top-0 text-gray-500 font-bold uppercase">
                                  <tr>
                                      <th className="px-3 py-2 text-left w-24">Data</th>
                                      <th className="px-3 py-2 text-left">Descrição</th>
                                      <th className="px-3 py-2 text-right w-24">Valor</th>
                                      <th className="px-2 py-2 w-10"></th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 bg-white">
                                  {recBankTransactions.map(bt => {
                                      const isSelected = selectedBankIds.includes(bt.id);
                                      return (
                                          <tr 
                                            key={bt.id} 
                                            onClick={() => handleBankSelect(bt.id)}
                                            className={`cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-100 ring-1 ring-inset ring-blue-500' : ''}`}
                                          >
                                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDateDisplay(bt.date)}</td>
                                              <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[150px]">{bt.description}</td>
                                              <td className={`px-3 py-2 text-right font-mono font-bold ${Number(bt.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                  {formatCurrency(Math.abs(Number(bt.amount)))}
                                              </td>
                                              <td className="px-2 py-2 text-right">
                                                  {!bt.reconciled && !isSelected && (
                                                      <button title="Criar Registo" onClick={(e) => handleCreateFromBank(bt, e)} className="text-gray-400 hover:text-blue-600 hover:bg-blue-100 p-1 rounded transition-colors"><CopyPlus size={14}/></button>
                                                  )}
                                                  {isSelected && <Check size={14} className="text-blue-600 ml-auto"/>}
                                              </td>
                                          </tr>
                                      );
                                  })}
                                  {recBankTransactions.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">Sem dados.</td></tr>}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* RIGHT: SYSTEM TRANSACTIONS */}
                  <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden shadow-sm h-full">
                      <div className="p-3 border-b bg-gray-50 flex flex-col gap-2 shrink-0">
                          <div className="flex justify-between items-center">
                              <h3 className="font-bold text-gray-700 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> Registos Sistema</h3>
                              <div className="flex gap-1">
                                  <button onClick={() => exportToExcel(recSystemTransactions, 'registos_filtrados')} title="Exportar Lista" className="p-1 text-gray-500 hover:bg-gray-200 rounded"><Download size={16}/></button>
                                  <select className="text-xs border rounded p-1" value={recSysStatus} onChange={e => setRecSysStatus(e.target.value as any)}>
                                      <option value="unreconciled">Pendentes</option>
                                      <option value="reconciled">Conciliados</option>
                                      <option value="all">Todos</option>
                                  </select>
                              </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                              <div className="relative flex gap-1">
                                  <button onClick={() => setRecSysDateMode(recSysDateMode === 'month' ? 'day' : 'month')} className="px-2 border rounded bg-gray-100 text-[10px] font-bold uppercase">{recSysDateMode === 'month' ? 'Mês' : 'Dia'}</button>
                                  <input type={recSysDateMode === 'month' ? 'month' : 'date'} value={recSysDate} onChange={e=>setRecSysDate(e.target.value)} className="w-full text-xs border rounded p-1.5 outline-none focus:ring-1 focus:ring-green-500" />
                              </div>
                              <div className="relative">
                                  <input type="text" placeholder="Descrição..." value={recSysSearch} onChange={e=>setRecSysSearch(e.target.value)} className="w-full text-xs border rounded p-1.5 outline-none focus:ring-1 focus:ring-green-500" />
                              </div>
                              <div className="relative">
                                  <input type="text" placeholder="Valor..." value={recSysValue} onChange={e=>setRecSysValue(e.target.value)} className="w-full text-xs border rounded p-1.5 outline-none focus:ring-1 focus:ring-green-500" />
                              </div>
                          </div>
                      </div>
                      <div className="flex-1 overflow-auto bg-gray-50/30">
                          <table className="min-w-full text-xs">
                              <thead className="bg-gray-100 sticky top-0 text-gray-500 font-bold uppercase">
                                  <tr>
                                      <th className="px-2 py-2 w-8"></th>
                                      <th className="px-3 py-2 text-left w-24">Data</th>
                                      <th className="px-3 py-2 text-left">Descrição</th>
                                      <th className="px-3 py-2 text-right w-24">Valor</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 bg-white">
                                  {recSystemTransactions.map(t => {
                                      const amount = currency.sub(Number(t.income ?? 0), Number(t.expense ?? 0));
                                      const isSelected = selectedSystemIds.includes(t.id);
                                      return (
                                          <tr 
                                            key={t.id} 
                                            onClick={() => handleSystemSelect(t.id)}
                                            className={`cursor-pointer hover:bg-green-50 transition-colors ${isSelected ? 'bg-green-100 ring-1 ring-inset ring-green-500' : ''}`}
                                          >
                                              <td className="px-2 py-2 text-center">
                                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                                                      {isSelected && <Check size={10} className="text-white"/>}
                                                  </div>
                                              </td>
                                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDateDisplay(t.date)}</td>
                                              <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[150px]">{t.description}</td>
                                              <td className={`px-3 py-2 text-right font-mono font-bold ${amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                  {formatCurrency(Math.abs(amount))}
                                              </td>
                                          </tr>
                                      );
                                  })}
                                  {recSystemTransactions.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">Sem dados.</td></tr>}
                              </tbody>
                          </table>
                      </div>
                  </div>

              </div>
          </div>
      )}

      {/* MODALS */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Registo Financeiro" : "Novo Registo Financeiro"}>
          <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-gray-100 p-1 rounded-lg">
                  <button type="button" onClick={() => setNewTxType('income')} className={`py-2 rounded-md font-bold text-sm transition-all ${newTxType === 'income' ? 'bg-green-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}>Entrada</button>
                  <button type="button" onClick={() => setNewTxType('expense')} className={`py-2 rounded-md font-bold text-sm transition-all ${newTxType === 'expense' ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}>Saída</button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                  <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-1">Data</label>
                      <input type="date" required name="date" value={newTransaction.date} onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-1">Valor</label>
                      <input type="number" step="0.01" required name="absValue" value={newTransaction.absValue} onChange={(e) => setNewTransaction({...newTransaction, absValue: e.target.value})} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-green-500 font-bold" placeholder="0.00" />
                  </div>
              </div>

              <div>
                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Descrição</label>
                  <input type="text" required name="description" value={newTransaction.description} onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-green-500" placeholder="Ex: Pagamento Cliente X" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-1">Categoria (Conta)</label>
                      <select name="category" required value={newTransaction.category} onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-green-500 bg-white">
                          <option value="">Selecione...</option>
                          {Object.entries(groupedCategories).map(([group, accounts]) => (
                              <optgroup key={group} label={group}>
                                  {(accounts as Account[]).map(acc => (
                                      <option key={acc.id} value={acc.name}>{acc.code} - {acc.name}</option>
                                  ))}
                              </optgroup>
                          ))}
                      </select>
                  </div>
                  <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-1">Meio de Pagamento</label>
                      <select name="type" value={newTransaction.type} onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value as any})} className="w-full border rounded-xl p-3 outline-none bg-white">
                          {(settings.paymentMethods || ['Dinheiro', 'Cheque', 'Transferência', 'Vinti4']).map(pm => (
                              <option key={pm} value={pm}>{pm}</option>
                          ))}
                      </select>
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100">Cancelar</button>
                  <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200">Guardar</button>
              </div>
          </form>
      </Modal>

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title={`Pré-visualizar Importação (${importType === 'system' ? 'Registos' : 'Extrato Bancário'})`}>
          <div className="space-y-4">
              <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="text-sm text-blue-800">
                      <strong>{previewData.filter(t => t.isValid && !t.isDuplicate).length}</strong> novas linhas válidas.
                  </div>
                  <div className="flex gap-4">
                      {previewData.some(t => t.isDuplicate) && <div className="text-sm text-orange-600 font-bold flex items-center gap-1"><CopyPlus size={16}/> {previewData.filter(t => t.isDuplicate).length} duplicados ignorados</div>}
                      {previewData.some(t => !t.isValid) && <div className="text-sm text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={16}/> {previewData.filter(t => !t.isValid).length} erros</div>}
                  </div>
              </div>
              <div className="max-h-[400px] overflow-auto border rounded-xl">
                  <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0"><tr><th className="p-2">Status</th><th className="p-2">Data</th><th className="p-2">Descrição</th><th className="p-2 text-right">Valor</th><th className="p-2">Conta Sugerida</th><th className="p-2">Msg</th></tr></thead>
                      <tbody>
                          {previewData.map(r => (
                              <tr key={r.id} className={!r.isValid ? 'bg-red-50' : r.isDuplicate ? 'bg-orange-50 opacity-60' : 'bg-white'}>
                                  <td className="p-2 text-center">
                                      {!r.isValid ? <X size={14} className="text-red-500"/> : r.isDuplicate ? <CopyPlus size={14} className="text-orange-500"/> : <Check size={14} className="text-green-500"/>}
                                  </td>
                                  <td className="p-2">{r.isValid ? formatDateDisplay(r.date) : String(r.rawDate)}</td>
                                  <td className="p-2 truncate max-w-[200px]">{r.description}</td>
                                  <td className="p-2 font-mono text-right">
                                      {importType === 'system' ? (
                                          r.income ? `+${r.income}` : `-${r.expense}`
                                      ) : (
                                          r.amount
                                      )}
                                  </td>
                                  <td className="p-2 font-bold text-gray-600">{r.category}</td>
                                  <td className="p-2 text-gray-500">
                                      {r.errors.length > 0 ? <span className="text-red-500">{r.errors.join(', ')}</span> : r.isDuplicate ? <span className="text-orange-500">Duplicado</span> : 'OK'}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Cancelar</button>
                  <button onClick={confirmImport} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md">Confirmar Importação</button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isAutoMatchModalOpen} onClose={() => setIsAutoMatchModalOpen(false)} title="Auto-Conciliação Sugerida">
          <div className="space-y-4">
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-4">
                  <p className="text-sm text-purple-900">
                      O sistema encontrou <strong>{autoMatchProposals.length}</strong> correspondências exatas (Data e Valor).
                      Confirme as associações abaixo para conciliar automaticamente.
                  </p>
              </div>
              
              <div className="max-h-[400px] overflow-auto border rounded-xl">
                  <table className="min-w-full text-xs">
                      <thead className="bg-gray-100 sticky top-0 text-gray-500 font-bold uppercase">
                          <tr>
                              <th className="p-2 text-left">Data</th>
                              <th className="p-2 text-left">Banco (Extrato)</th>
                              <th className="p-2 text-left">Sistema (Registo)</th>
                              <th className="p-2 text-right">Valor</th>
                              <th className="p-2 text-center">Score</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y">
                          {autoMatchProposals.map((prop, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                  <td className="p-2 text-gray-600">{formatDateDisplay(prop.bank.date)}</td>
                                  <td className="p-2 font-medium text-gray-800">{prop.bank.description}</td>
                                  <td className="p-2 text-gray-600">{prop.system.description}</td>
                                  <td className="p-2 text-right font-mono font-bold">{formatCurrency(Math.abs(prop.bank.amount))}</td>
                                  <td className="p-2 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${prop.similarityScore > 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                          {(prop.similarityScore * 100).toFixed(0)}%
                                      </span>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                  <button onClick={() => setIsAutoMatchModalOpen(false)} className="px-4 py-2 border rounded-lg font-bold text-gray-500 hover:bg-gray-50">Cancelar</button>
                  <button onClick={() => {
                        let updatedBank = [...bankTransactions];
                        let updatedSys = [...transactions];
                        let matchCount = 0;

                        autoMatchProposals.forEach(m => {
                            const { bank, system } = m;
                            updatedBank = updatedBank.map(b => b.id === bank.id ? { ...b, reconciled: true, systemMatchIds: [system.id] } : b);
                            updatedSys = updatedSys.map(t => t.id === system.id ? { ...t, isReconciled: true } : t);
                            matchCount++;
                        });

                        setBankTransactions(updatedBank);
                        setTransactions(updatedSys);
                        setIsAutoMatchModalOpen(false);
                        notify('success', `${matchCount} reconciliações automáticas concluídas.`);
                  }} className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 shadow-md flex items-center gap-2">
                      <Wand2 size={16}/> Conciliar Tudo
                  </button>
              </div>
          </div>
      </Modal>
    </div>
    );
};
