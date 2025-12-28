
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Transaction, Client, BankTransaction, SystemSettings, Account, AccountType } from '../types';
import { Plus, Upload, AlertTriangle, Check, X, Edit2, Search, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, RefreshCw, Link, CheckSquare, Calendar, Filter, Eye, RotateCcw, Ban, Undo2, LineChart, PieChart as PieChartIcon, Scale, ArrowRight, MousePointerClick, Wand2, CopyPlus, Download, Zap, Wallet, BarChart4, AlertCircle, Loader2, Table, TrendingUp, Trash2, EyeOff } from 'lucide-react';
import Modal from './Modal';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, Area, PieChart, Pie, Cell, AreaChart } from 'recharts';
import { db } from '../services/db';
import { useHelp } from '../contexts/HelpContext';
import { useNotification } from '../contexts/NotificationContext';
import { useConfirmation } from '../contexts/ConfirmationContext';

// Interface unificada para preview de importação
interface ImportPreviewRow {
  id: number | string;
  date: string;
  description: string;
  amount?: number; // Para banco
  income?: number | null; // Para sistema
  expense?: number | null; // Para sistema
  category?: string;
  isValid: boolean;
  isDuplicate: boolean; 
  errors: string[];
  rawDate?: any;
  rawVal?: any;
}

// Interface para propostas de auto conciliação
interface AutoMatchProposal {
    bank: BankTransaction;
    system: Transaction;
    similarityScore: number;
}

interface FinancialModuleProps {
    target: number;
    settings: SystemSettings;
    categories: Account[];
    onAddCategories: (newCats: string[]) => void;
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    bankTransactions: BankTransaction[];
    setBankTransactions: React.Dispatch<React.SetStateAction<BankTransaction[]>>;
    clients?: Client[]; 
}

type SortDirection = 'asc' | 'desc';
interface SortConfig {
  key: keyof Transaction;
  direction: SortDirection;
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9'];

export const FinancialModule: React.FC<FinancialModuleProps> = ({ target, settings, categories = [], onAddCategories, transactions = [], setTransactions, bankTransactions = [], setBankTransactions, clients = [] }) => {
  const { setHelpContent } = useHelp();
  const { notify } = useNotification();
  const { requestConfirmation } = useConfirmation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
      if (transactions !== undefined && bankTransactions !== undefined) {
          setIsLoading(false);
      }
  }, [transactions, bankTransactions]);

  const [subView, setSubView] = useState<'dashboard' | 'records' | 'reconciliation'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [dashFilters, setDashFilters] = useState(() => {
      const saved = db.filters.getDashboard();
      return { 
          month: typeof saved.month === 'number' ? saved.month : 0, 
          year: typeof saved.year === 'number' ? saved.year : new Date().getFullYear() 
      };
  });
  
  const [regFilters, setRegFilters] = useState(() => {
      const saved = db.filters.getRegistry();
      return { 
          month: typeof saved.month === 'number' ? saved.month : 0, 
          year: typeof saved.year === 'number' ? saved.year : new Date().getFullYear(),
          category: saved.category || 'Todas',
          status: saved.status || 'Todos',
          hideVoided: true
      };
  });

  const [evolutionCategory, setEvolutionCategory] = useState('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });

  // RECONCILIATION STATES
  const [recBankSearch, setRecBankSearch] = useState('');
  const [recBankDate, setRecBankDate] = useState('');
  const [recBankDateMode, setRecBankDateMode] = useState<'month' | 'day'>('month');
  const [recBankValue, setRecBankValue] = useState('');
  const [recBankStatus, setRecBankStatus] = useState<'all' | 'reconciled' | 'unreconciled'>('unreconciled');
  const [recSysSearch, setRecSysSearch] = useState('');
  const [recSysDate, setRecSysDate] = useState('');
  const [recSysDateMode, setRecSysDateMode] = useState<'month' | 'day'>('month');
  const [recSysValue, setRecSysValue] = useState('');
  const [recSysStatus, setRecSysStatus] = useState<'all' | 'reconciled' | 'unreconciled'>('unreconciled');
  const [isAutoFilterEnabled, setIsAutoFilterEnabled] = useState(false);
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [selectedSystemIds, setSelectedSystemIds] = useState<number[]>([]);
  const [isAutoMatchModalOpen, setIsAutoMatchModalOpen] = useState(false);
  const [autoMatchProposals, setAutoMatchProposals] = useState<AutoMatchProposal[]>([]);
  const [newTxType, setNewTxType] = useState<'income' | 'expense'>('income');
  const [editingId, setEditingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'system' | 'bank'>('system');
  const [previewData, setPreviewData] = useState<ImportPreviewRow[]>([]);

  const [newTransaction, setNewTransaction] = useState<Partial<Transaction> & { absValue?: string }>({
    date: new Date().toISOString().split('T')[0],
    type: 'Dinheiro',
    category: '',
    status: 'Pago',
    absValue: '',
    clientId: undefined
  });

  const availableYears = useMemo(() => {
      const years = new Set<number>();
      years.add(new Date().getFullYear());
      transactions.forEach(t => {
          if (t.date && !t._deleted) {
              const y = new Date(t.date).getFullYear();
              if (!isNaN(y)) years.add(y);
          }
      });
      return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '0 CVE';
    return val.toLocaleString('pt-CV') + ' CVE';
  };

  const formatDateDisplay = (dateString: string) => {
      if (!dateString) return '-';
      try {
          const parts = dateString.split('-');
          if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
          return dateString;
      } catch (e) { return dateString; }
  };

  // --- KPI CALCULATIONS WITH FILTER ---
  const dashboardData = useMemo(() => {
    if (!transactions) return { operationalRevenue: 0, variableCosts: 0, fixedCosts: 0, financialCosts: 0, balanceSheetMoves: 0, grossMargin: 0, grossMarginPerc: 0, ebitda: 0, netResult: 0, cashBalance: 0, flowData: [], unreconciledCount: 0 };

    const filtered = transactions.filter(t => {
      if (t._deleted) return false; // SOFT DELETE FILTER
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return false;
      const matchesMonth = Number(dashFilters.month) === 0 || (tDate.getMonth() + 1) === Number(dashFilters.month);
      const matchesYear = tDate.getFullYear() === Number(dashFilters.year);
      return matchesMonth && matchesYear && !t.isVoided && t.status === 'Pago';
    });

    let operationalRevenue = 0, variableCosts = 0, fixedCosts = 0, financialCosts = 0, balanceSheetMoves = 0;

    filtered.forEach(t => {
        const account = categories.find(c => c.name === t.category);
        const type = account?.type;
        const val = (Number(t.income) || 0) - (Number(t.expense) || 0);
        if (!type) { if(val > 0) operationalRevenue += val; else fixedCosts += Math.abs(val); } 
        else if (type === 'Movimento de Balanço') balanceSheetMoves += val;
        else if (type === 'Receita Operacional') operationalRevenue += (Number(t.income) || 0);
        else if (type === 'Custo Direto') variableCosts += (Number(t.expense) || 0);
        else if (type === 'Custo Fixo') fixedCosts += (Number(t.expense) || 0);
        else if (type === 'Despesa Financeira') financialCosts += (Number(t.expense) || 0);
    });

    const grossMargin = operationalRevenue - variableCosts;
    const grossMarginPerc = operationalRevenue > 0 ? (grossMargin / operationalRevenue) * 100 : 0;
    const ebitda = grossMargin - fixedCosts;
    const netResult = ebitda - financialCosts;
    const totalCashIn = filtered.reduce((acc, t) => acc + (Number(t.income) || 0), 0);
    const totalCashOut = filtered.reduce((acc, t) => acc + (Number(t.expense) || 0), 0);
    const cashBalance = totalCashIn - totalCashOut;

    let flowData = [];
    if (Number(dashFilters.month) === 0) {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        flowData = months.map((m, idx) => {
            const txs = filtered.filter(t => new Date(t.date).getMonth() === idx);
            return { name: m, income: txs.reduce((acc, t) => acc + (Number(t.income)||0), 0), expense: txs.reduce((acc, t) => acc + (Number(t.expense)||0), 0) };
        });
    } else {
        const days = Array.from(new Set(filtered.map(t => new Date(t.date).getDate()))).sort((a:number, b:number) => a-b);
        flowData = days.map(d => {
            const txs = filtered.filter(t => new Date(t.date).getDate() === d);
            return { name: d.toString(), income: txs.reduce((acc, t) => acc + (Number(t.income)||0), 0), expense: txs.reduce((acc, t) => acc + (Number(t.expense)||0), 0) };
        });
    }

    return { operationalRevenue, variableCosts, fixedCosts, financialCosts, balanceSheetMoves, grossMargin, grossMarginPerc, ebitda, netResult, cashBalance, flowData, unreconciledCount: filtered.filter(t => !t.isReconciled).length };
  }, [transactions, dashFilters, categories]);

  const registryFilteredTransactions = useMemo(() => {
      const baseFiltered = transactions.filter(t => {
          if (t._deleted) return false; // SOFT DELETE FILTER
          if (regFilters.hideVoided && t.isVoided) return false;
          const tDate = new Date(t.date);
          if (isNaN(tDate.getTime())) return false;
          const matchesMonth = Number(regFilters.month) === 0 || (tDate.getMonth() + 1) === Number(regFilters.month);
          const matchesYear = tDate.getFullYear() === Number(regFilters.year);
          const matchesCategory = regFilters.category === 'Todas' || t.category === regFilters.category;
          const matchesStatus = regFilters.status === 'Todos' || t.status === regFilters.status;
          return matchesMonth && matchesYear && matchesCategory && matchesStatus;
      });
      const searched = baseFiltered.filter(t => {
          const s = searchTerm.toLowerCase();
          return !s || t.description.toLowerCase().includes(s) || (t.reference && t.reference.toLowerCase().includes(s));
      });
      return [...searched].sort((a, b) => {
          let aV: any = a[sortConfig.key];
          let bV: any = b[sortConfig.key];
          if (sortConfig.key === 'income') { aV = Number(a.income || 0) - Number(a.expense || 0); bV = Number(b.income || 0) - Number(b.expense || 0); }
          if (aV < bV) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aV > bV) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [transactions, regFilters, searchTerm, sortConfig]);

  const recBankTransactions = useMemo(() => {
      return bankTransactions.filter(bt => {
          if (bt._deleted) return false; // SOFT DELETE FILTER
          if (recBankStatus === 'unreconciled' && bt.reconciled) return false;
          if (recBankStatus === 'reconciled' && !bt.reconciled) return false;
          if (recBankSearch && !bt.description.toLowerCase().includes(recBankSearch.toLowerCase())) return false;
          if (recBankDate) {
              if (recBankDateMode === 'day' && bt.date !== recBankDate) return false;
              if (recBankDateMode === 'month' && !bt.date.startsWith(recBankDate)) return false;
          }
          if (recBankValue && !Math.abs(bt.amount).toString().includes(recBankValue)) return false;
          return true;
      }).sort((a, b) => b.date.localeCompare(a.date));
  }, [bankTransactions, recBankSearch, recBankDate, recBankDateMode, recBankValue, recBankStatus]);

  const recSystemTransactions = useMemo(() => {
      let filtered = transactions.filter(t => {
          if (t.isVoided || t._deleted) return false; // SOFT DELETE FILTER
          if (recSysStatus === 'unreconciled' && t.isReconciled) return false;
          if (recSysStatus === 'reconciled' && !t.isReconciled) return false;
          const amount = (Number(t.income ?? 0)) - (Number(t.expense ?? 0));
          if (recSysSearch && !t.description.toLowerCase().includes(recSysSearch.toLowerCase())) return false;
          if (recSysDate) {
              if (recSysDateMode === 'day' && t.date !== recSysDate) return false;
              if (recSysDateMode === 'month' && !t.date.startsWith(recSysDate)) return false;
          }
          if (recSysValue && !Math.abs(amount).toString().includes(recSysValue)) return false;
          return true;
      });
      return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, recSysSearch, recSysDate, recSysDateMode, recSysValue, recSysStatus]);

  // Handlers
  const handleBankSelect = (id: string) => { setSelectedBankIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const handleSystemSelect = (id: number) => { setSelectedSystemIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };

  const executeReconciliation = () => { 
      if (selectedBankIds.length === 0 || selectedSystemIds.length === 0) return; 
      const bankTxs = bankTransactions.filter(b => selectedBankIds.includes(b.id)); 
      const sysTxs = transactions.filter(t => selectedSystemIds.includes(t.id)); 
      const bankSum = bankTxs.reduce((sum, b) => sum + Number(b.amount), 0); 
      const sysSum = sysTxs.reduce((acc, t) => acc + (Number(t.income || 0) - Number(t.expense || 0)), 0); 
      const diff = Math.abs(bankSum - sysSum); 
      const margin = settings.reconciliationValueMargin || 0.1; 
      if (diff > margin) { notify('error', `Diferença (${formatCurrency(diff)}) excede a margem permitida. Impossível conciliar.`); return; } 
      setTransactions(prev => prev.map(t => selectedSystemIds.includes(t.id) ? { ...t, isReconciled: true } : t)); 
      setBankTransactions(prev => prev.map(b => selectedBankIds.includes(b.id) ? { ...b, reconciled: true, systemMatchIds: selectedSystemIds } : b)); 
      setSelectedBankIds([]); setSelectedSystemIds([]); notify('success', 'Conciliação efetuada com sucesso.'); 
  };

  if (isLoading) return <div className="flex-1 flex flex-col items-center justify-center text-gray-400 h-[500px]"><Loader2 className="animate-spin mb-4" size={48} /><p className="font-medium">A carregar dados financeiros...</p></div>;

  const SortableHeader = ({ label, column }: { label: string, column: keyof Transaction }) => ( <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100 select-none" onClick={() => setSortConfig({ key: column, direction: sortConfig.key === column && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}> {label} {sortConfig.key === column && (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="inline ml-1 text-green-600"/> : <ArrowDown size={14} className="inline ml-1 text-green-600"/>)} </th> );

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div><h2 className="text-2xl font-bold text-gray-800">Tesouraria & Controlo</h2><p className="text-gray-500 text-sm">Gestão de caixa e saúde económica</p></div>
        <div className="flex bg-gray-200 p-1 rounded-lg">
            <button onClick={() => setSubView('dashboard')} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'dashboard' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><BarChart4 size={16} /><span className="hidden sm:inline">Indicadores</span></button>
            <button onClick={() => setSubView('records')} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'records' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><Table size={16} /><span className="hidden sm:inline">Registo</span></button>
            <button onClick={() => setSubView('reconciliation')} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'reconciliation' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><RefreshCw size={16} /><span className="hidden sm:inline">Conciliação</span></button>
        </div>
      </div>

      {subView === 'dashboard' && (
          <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto pr-2">
              <div className="flex justify-end gap-2">
                  <select value={dashFilters.month} onChange={(e) => setDashFilters({...dashFilters, month: Number(e.target.value)})} className="border rounded-lg px-2 py-1.5 text-sm bg-white"><option value={0}>Todos os Meses</option>{[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{new Date(0, m-1).toLocaleString('pt-PT', {month:'long'})}</option>)}</select>
                  <select value={dashFilters.year} onChange={(e) => setDashFilters({...dashFilters, year: Number(e.target.value)})} className="border rounded-lg px-2 py-1.5 text-sm bg-white">{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500"><p className="text-[10px] font-bold text-gray-400 uppercase">Receita Operacional</p><h3 className="text-xl font-bold text-green-700 mt-1">{formatCurrency(dashboardData.operationalRevenue)}</h3></div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-400"><p className="text-[10px] font-bold text-gray-400 uppercase">Custos Diretos</p><h3 className="text-xl font-bold text-orange-600 mt-1">{formatCurrency(dashboardData.variableCosts)}</h3></div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500"><p className="text-[10px] font-bold text-gray-400 uppercase">Margem Bruta</p><h3 className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(dashboardData.grossMargin)}</h3></div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500"><p className="text-[10px] font-bold text-gray-400 uppercase">EBITDA</p><h3 className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(dashboardData.ebitda)}</h3></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-800 text-white p-6 rounded-lg shadow-md"><p className="text-[10px] font-bold uppercase opacity-70">Saldo de Caixa</p><h3 className="text-2xl font-bold mt-1">{formatCurrency(dashboardData.cashBalance)}</h3></div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase">Movimentos de Balanço</p><h3 className={`text-xl font-bold mt-1 ${dashboardData.balanceSheetMoves >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(dashboardData.balanceSheetMoves)}</h3></div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase">Resultado Líquido</p><h3 className={`text-xl font-bold mt-1 ${dashboardData.netResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(dashboardData.netResult)}</h3></div>
              </div>
          </div>
      )}

      {subView === 'records' && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg flex flex-col animate-fade-in-up flex-1 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                  <div className="flex gap-2 items-center">
                    <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="border rounded px-3 py-1.5 text-sm w-64 outline-none focus:ring-1 focus:ring-green-500"/>
                    <label className="flex items-center gap-2 cursor-pointer ml-2 select-none"><input type="checkbox" checked={regFilters.hideVoided} onChange={e => setRegFilters({...regFilters, hideVoided: e.target.checked})}/><span className="text-xs font-bold text-gray-500">Ocultar Anulados</span></label>
                  </div>
              </div>
              <div className="overflow-x-auto flex-1">
                  <table className="min-w-full text-sm divide-y divide-gray-100">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr><SortableHeader label="Data" column="date"/><SortableHeader label="Descrição" column="description"/><SortableHeader label="Categoria" column="category"/><SortableHeader label="Valor" column="income"/><th className="px-3 py-3 text-center font-bold text-gray-700 uppercase">Estado</th></tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                          {registryFilteredTransactions.map(t => (
                              <tr key={t.id} className={`hover:bg-gray-50 ${t.isVoided ? 'opacity-50 grayscale' : ''}`}>
                                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDateDisplay(t.date)}</td>
                                  <td className="px-3 py-3 font-bold text-gray-800">{t.description}</td>
                                  <td className="px-3 py-3"><span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">{t.category}</span></td>
                                  <td className="px-3 py-3 font-mono font-bold whitespace-nowrap">{t.income ? <span className="text-green-600">+{formatCurrency(t.income)}</span> : <span className="text-red-600">-{formatCurrency(t.expense)}</span>}</td>
                                  <td className="px-3 py-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${t.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {subView === 'reconciliation' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden animate-fade-in-up">
              {/* Bancário */}
              <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
                  <div className="p-3 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">Extrato Bancário</h3></div>
                  <div className="flex-1 overflow-auto">
                      <table className="min-w-full text-xs">
                          <thead className="bg-gray-100 sticky top-0 text-gray-500 font-bold uppercase"><tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-right">Valor</th></tr></thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                              {recBankTransactions.map(bt => {
                                  const isSelected = selectedBankIds.includes(bt.id);
                                  return (
                                      <tr key={bt.id} onClick={() => handleBankSelect(bt.id)} className={`cursor-pointer hover:bg-blue-50 ${isSelected ? 'bg-blue-100' : ''}`}>
                                          <td className="px-3 py-2">{formatDateDisplay(bt.date)}</td>
                                          <td className="px-3 py-2 font-medium">{bt.description}</td>
                                          <td className={`px-3 py-2 text-right font-bold ${bt.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Math.abs(bt.amount))}</td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>
              {/* Sistema */}
              <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
                  <div className="p-3 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">Registos Sistema</h3></div>
                  <div className="flex-1 overflow-auto">
                      <table className="min-w-full text-xs">
                          <thead className="bg-gray-100 sticky top-0 text-gray-500 font-bold uppercase"><tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-right">Valor</th></tr></thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                              {recSystemTransactions.map(t => {
                                  const isSelected = selectedSystemIds.includes(t.id);
                                  const amount = (Number(t.income ?? 0)) - (Number(t.expense ?? 0));
                                  return (
                                      <tr key={t.id} onClick={() => handleSystemSelect(t.id)} className={`cursor-pointer hover:bg-green-50 ${isSelected ? 'bg-green-100' : ''}`}>
                                          <td className="px-3 py-2">{formatDateDisplay(t.date)}</td>
                                          <td className="px-3 py-2 font-medium">{t.description}</td>
                                          <td className={`px-3 py-2 text-right font-bold ${amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Math.abs(amount))}</td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>
              {selectedBankIds.length > 0 && selectedSystemIds.length > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100]"><button onClick={executeReconciliation} className="bg-green-600 text-white px-8 py-3 rounded-full font-black shadow-2xl hover:scale-105 transition-all uppercase tracking-widest text-sm">Conciliar Selecionados</button></div>
              )}
          </div>
      )}
    </div>
  );
};
