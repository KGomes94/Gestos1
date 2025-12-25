
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Transaction, Client, BankTransaction } from '../types';
import { Plus, Upload, AlertTriangle, Check, XCircle, LayoutDashboard, Table, TrendingUp, DollarSign, X, Edit2, Search, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, RefreshCw, Link, CheckSquare, Calendar, Filter, Eye, RotateCcw, Ban, Undo2, LineChart, PieChart as PieChartIcon, Scale, ArrowRight, MousePointerClick, Wand2, CopyPlus } from 'lucide-react';
import Modal from './Modal';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, Area, PieChart, Pie, Cell, AreaChart } from 'recharts';
import { db } from '../services/db';
import { useHelp } from '../contexts/HelpContext';
import { useNotification } from '../contexts/NotificationContext';

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
  errors: string[];
  rawDate?: any;
  rawVal?: any;
}

interface FinancialModuleProps {
    target: number;
    categories: string[];
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

export const FinancialModule: React.FC<FinancialModuleProps> = ({ target, categories, onAddCategories, transactions, setTransactions, bankTransactions, setBankTransactions, clients = [] }) => {
  const { setHelpContent } = useHelp();
  const { notify } = useNotification();
  
  const [subView, setSubView] = useState<'dashboard' | 'records' | 'reconciliation'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // --- FILTERS STATE ---
  const [dashFilters, setDashFilters] = useState(() => db.filters.getDashboard());
  const [regFilters, setRegFilters] = useState(() => db.filters.getRegistry());
  const [evolutionCategory, setEvolutionCategory] = useState('Todas');

  useEffect(() => { db.filters.saveDashboard(dashFilters); }, [dashFilters]);
  useEffect(() => { db.filters.saveRegistry(regFilters); }, [regFilters]);

  // Search & Sort Global
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });

  // --- IMPORT STATE ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'system' | 'bank'>('system');
  const [previewData, setPreviewData] = useState<ImportPreviewRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- RECONCILIATION SPLIT VIEW STATE ---
  // Bank Side Filters
  const [recBankSearch, setRecBankSearch] = useState('');
  const [recBankDate, setRecBankDate] = useState('');
  const [recBankValue, setRecBankValue] = useState('');
  const [recBankStatus, setRecBankStatus] = useState<'all' | 'reconciled' | 'unreconciled'>('unreconciled');
  
  // System Side Filters
  const [recSysSearch, setRecSysSearch] = useState('');
  const [recSysDate, setRecSysDate] = useState('');
  const [recSysValue, setRecSysValue] = useState('');
  const [recSysStatus, setRecSysStatus] = useState<'all' | 'reconciled' | 'unreconciled'>('unreconciled');

  // Selection
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedSystemIds, setSelectedSystemIds] = useState<number[]>([]);

  // Match View State
  const [matchViewModalOpen, setMatchViewModalOpen] = useState(false);
  const [viewMatchPair, setViewMatchPair] = useState<{bank: BankTransaction, system: Transaction[]} | null>(null);

  // New Transaction Form State
  const [newTxType, setNewTxType] = useState<'income' | 'expense'>('income');
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction> & { absValue?: string }>({
    date: new Date().toISOString().split('T')[0],
    type: 'Dinheiro',
    category: '',
    status: 'Pago',
    absValue: '',
    clientId: undefined
  });

  // --- HELP ---
  useEffect(() => {
      let title = "Módulo de Tesouraria";
      let content = "Gerencie todas as finanças da empresa aqui.";
      if (subView === 'dashboard') {
          title = "Dashboard Financeiro";
          content = `Visualize o fluxo de caixa e KPIs.\n\nUse os gráficos abaixo para analisar categorias de despesa e evolução mensal.`;
      } else if (subView === 'records') {
          title = "Tabela de Registos";
          content = `Aqui estão os registos internos da empresa.\n\nVocê pode importar um Excel com colunas: Data, Descrição, Valor (ou Débito/Crédito).`;
      } else if (subView === 'reconciliation') {
          title = "Conciliação Bancária";
          content = `Selecione um movimento bancário à esquerda e encontre os registos correspondentes à direita.\n\nUse os filtros independentes para localizar movimentos por data ou valor.`;
      }
      setHelpContent({ title, content });
  }, [subView, setHelpContent]);

  // --- HELPERS ---
  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '0 CVE';
    return val.toLocaleString('pt-CV') + ' CVE';
  };

  const parseExcelDate = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'number') {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    }
    const strVal = String(value).trim();
    const ptDateMatch = strVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ptDateMatch) {
        const day = ptDateMatch[1].padStart(2, '0');
        const month = ptDateMatch[2].padStart(2, '0');
        const year = ptDateMatch[3];
        return `${year}-${month}-${day}`;
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  };

  const findValueInRow = (row: any, possibleKeys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const key of possibleKeys) {
        if (row[key] !== undefined) return row[key];
        const foundKey = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
        if (foundKey) return row[foundKey];
    }
    return undefined;
  };

  // --- IMPORT LOGIC ---
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

        const mapped: ImportPreviewRow[] = data.map((row: any, idx) => {
            const errors: string[] = [];
            const rawDate = findValueInRow(row, ['Data', 'Date', 'Dia']);
            const parsedDate = parseExcelDate(rawDate);
            if (!parsedDate) errors.push('Data inválida');

            const description = findValueInRow(row, ['Descrição', 'Description', 'Historico', 'Movimento']) || 'Importado via Excel';
            
            let finalAmount = 0;
            let income: number | null = null;
            let expense: number | null = null;

            const rawVal = findValueInRow(row, ['Valor', 'Amount', 'Montante']);
            const rawDebit = findValueInRow(row, ['Débito', 'Debit', 'Saída', 'Expense']);
            const rawCredit = findValueInRow(row, ['Crédito', 'Credit', 'Entrada', 'Income']);

            if (rawDebit || rawCredit) {
                const debit = rawDebit ? Math.abs(Number(String(rawDebit).replace(',', '.'))) : 0;
                const credit = rawCredit ? Math.abs(Number(String(rawCredit).replace(',', '.'))) : 0;
                
                if (type === 'system') {
                    if (debit > 0) expense = debit;
                    if (credit > 0) income = credit;
                } else {
                    finalAmount = credit - debit; 
                }
            } else if (rawVal) {
                const valStr = String(rawVal).replace(',', '.'); 
                const num = Number(valStr);
                if (isNaN(num)) {
                    errors.push('Valor inválido');
                } else {
                    if (type === 'system') {
                        if (num < 0) expense = Math.abs(num);
                        else income = num;
                    } else {
                        finalAmount = num;
                    }
                }
            } else {
                errors.push('Valor não encontrado');
            }

            const category = findValueInRow(row, ['Categoria', 'Category']) || 'Geral';

            return {
                id: Date.now() + idx,
                date: parsedDate || '',
                description,
                amount: finalAmount,
                income,
                expense,
                category,
                isValid: errors.length === 0,
                errors,
                rawDate,
                rawVal: rawVal || `${rawCredit}/${rawDebit}`
            };
        });

        setPreviewData(mapped);
        setIsImportModalOpen(true);
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImport = () => {
      const validRows = previewData.filter(r => r.isValid);
      
      if (importType === 'system') {
          const newTxs: Transaction[] = validRows.map((r, i) => ({
              id: Date.now() + i,
              date: r.date,
              description: r.description,
              reference: `IMP-${new Date().getFullYear()}-${i}`,
              type: 'Transferência',
              category: r.category || 'Geral',
              income: r.income || null,
              expense: r.expense || null,
              status: 'Pago',
              isReconciled: false
          }));
          setTransactions(prev => [...newTxs, ...prev]);
          const newCats = new Set<string>();
          newTxs.forEach(t => { if(t.category && !categories.includes(t.category)) newCats.add(t.category); });
          if(newCats.size > 0) onAddCategories(Array.from(newCats));
          
          notify('success', `${newTxs.length} registos importados.`);
      } else {
          const newBankTxs: BankTransaction[] = validRows.map((r, i) => ({
              id: `BK-${Date.now()}-${i}`,
              date: r.date,
              description: r.description,
              amount: r.amount || 0,
              reconciled: false,
              systemMatchIds: []
          }));
          setBankTransactions(prev => [...newBankTxs, ...prev]);
          notify('success', `${newBankTxs.length} movimentos bancários importados.`);
      }

      setIsImportModalOpen(false);
      setPreviewData([]);
  };

  // --- FILTERING & DASHBOARD DATA ---
  
  // 1. KPI & Main Chart Data (Respeita Mês e Ano Selecionados)
  const dashboardData = useMemo(() => {
    const filtered = transactions.filter(t => {
      const tDate = new Date(t.date);
      const matchesMonth = Number(dashFilters.month) === 0 || (tDate.getMonth() + 1) === Number(dashFilters.month);
      const matchesYear = tDate.getFullYear() === Number(dashFilters.year);
      return matchesMonth && matchesYear && !t.isVoided;
    });
    
    const paidTransactions = filtered.filter(t => t.status === 'Pago');
    const totalIncome = paidTransactions.reduce((acc, t) => acc + (t.income || 0), 0);
    const totalExpense = paidTransactions.reduce((acc, t) => acc + (t.expense || 0), 0);
    
    let flowData = [];
    if (Number(dashFilters.month) === 0) {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        flowData = months.map((m, idx) => {
            const inM = paidTransactions.filter(t => new Date(t.date).getMonth() === idx).reduce((acc: number, t) => acc + (t.income || 0), 0);
            const outM = paidTransactions.filter(t => new Date(t.date).getMonth() === idx).reduce((acc: number, t) => acc + (t.expense || 0), 0);
            return { name: m, income: inM, expense: outM };
        });
    } else {
        const days = Array.from(new Set(paidTransactions.map(t => new Date(t.date).getDate()))).sort((a: number, b: number) => a - b);
        flowData = days.map(d => {
            const inD = paidTransactions.filter(t => new Date(t.date).getDate() === d).reduce((acc: number, t) => acc + (t.income || 0), 0);
            const outD = paidTransactions.filter(t => new Date(t.date).getDate() === d).reduce((acc: number, t) => acc + (t.expense || 0), 0);
            return { name: d.toString(), income: inD, expense: outD };
        });
    }

    return { totalIncome, totalExpense, balance: totalIncome - totalExpense, flowData, unreconciledCount: paidTransactions.filter(t => !t.isReconciled).length };
  }, [transactions, dashFilters]); 

  // 2. Top 10 Expenses (Respeita filtros de KPI para mostrar o top do período)
  const topExpenses = useMemo(() => {
        const expenses = transactions.filter(t => {
            const tDate = new Date(t.date);
            const matchesMonth = Number(dashFilters.month) === 0 || (tDate.getMonth() + 1) === Number(dashFilters.month);
            const matchesYear = tDate.getFullYear() === Number(dashFilters.year);
            return matchesMonth && matchesYear && !t.isVoided && t.status === 'Pago' && (t.expense || 0) > 0;
        });

        const grouped = expenses.reduce((acc, curr) => {
            const cat = curr.category || 'Outros';
            acc[cat] = (acc[cat] || 0) + (curr.expense || 0);
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
  }, [transactions, dashFilters]);

  // 3. Category Evolution (Sempre mostra o Ano inteiro do ano selecionado, ignora filtro de mês do KPI)
  const evolutionData = useMemo(() => {
        const yearTxs = transactions.filter(t => {
            const tDate = new Date(t.date);
            const matchesYear = tDate.getFullYear() === Number(dashFilters.year);
            const matchesCat = evolutionCategory === 'Todas' || t.category === evolutionCategory;
            return matchesYear && matchesCat && !t.isVoided && t.status === 'Pago';
        });

        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return months.map((m, idx) => {
            const monthly = yearTxs.filter(t => new Date(t.date).getMonth() === idx);
            return {
                name: m,
                income: monthly.reduce((acc: number, t) => acc + (t.income || 0), 0),
                expense: monthly.reduce((acc: number, t) => acc + (t.expense || 0), 0)
            };
        });
  }, [transactions, dashFilters.year, evolutionCategory]);

  const registryFilteredTransactions = useMemo(() => {
      const baseFiltered = transactions.filter(t => {
          const tDate = new Date(t.date);
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
          if (sortConfig.key === 'income') { aV = (Number(a.income) || 0) - (Number(a.expense) || 0); bV = (Number(b.income) || 0) - (Number(b.expense) || 0); }
          if (aV < bV) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aV > bV) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [transactions, regFilters, searchTerm, sortConfig]);

  // --- RECONCILIATION FILTERING ---
  const recBankTransactions = useMemo(() => {
      return bankTransactions.filter(bt => {
          if (recBankStatus === 'unreconciled' && bt.reconciled) return false;
          if (recBankStatus === 'reconciled' && !bt.reconciled) return false;
          
          if (recBankSearch && !bt.description.toLowerCase().includes(recBankSearch.toLowerCase())) return false;
          if (recBankDate && bt.date !== recBankDate) return false;
          if (recBankValue && !Math.abs(bt.amount).toString().includes(recBankValue)) return false;
          return true;
      }).sort((a, b) => b.date.localeCompare(a.date));
  }, [bankTransactions, recBankSearch, recBankDate, recBankValue, recBankStatus]);

  const recSystemTransactions = useMemo(() => {
      return transactions.filter(t => {
          if (t.isVoided) return false;
          if (recSysStatus === 'unreconciled' && t.isReconciled) return false;
          if (recSysStatus === 'reconciled' && !t.isReconciled) return false;

          const amount = (t.income || 0) - (t.expense || 0);
          if (recSysSearch && !t.description.toLowerCase().includes(recSysSearch.toLowerCase())) return false;
          if (recSysDate && t.date !== recSysDate) return false;
          if (recSysValue && !Math.abs(amount).toString().includes(recSysValue)) return false;
          return true;
      }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, recSysSearch, recSysDate, recSysValue, recSysStatus]);

  // --- HANDLERS (CRUD & RECONCILIATION) ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(newTransaction.absValue);
    if (!val || val <= 0) return notify('error', 'Valor inválido.');

    const transaction: Transaction = {
      id: Date.now(),
      date: newTransaction.date || '',
      description: newTransaction.description || '',
      reference: newTransaction.reference || '',
      type: newTransaction.type as any,
      category: newTransaction.category || 'Geral',
      income: newTxType === 'income' ? val : null,
      expense: newTxType === 'expense' ? val : null,
      status: newTransaction.status as any,
      clientId: newTransaction.clientId,
      clientName: clients.find(c => c.id === newTransaction.clientId)?.company
    };
    
    setTransactions(prev => [transaction, ...prev]);
    setIsModalOpen(false);
    notify('success', 'Lançamento guardado.');
  };

  const handleCreateFromBank = (bt: BankTransaction, e: React.MouseEvent) => {
      e.stopPropagation();
      setNewTxType(bt.amount >= 0 ? 'income' : 'expense');
      setNewTransaction({
          date: bt.date,
          description: bt.description,
          type: 'Transferência',
          category: 'Geral',
          status: 'Pago',
          absValue: Math.abs(bt.amount).toString(),
          reference: `Auto-banco`
      });
      setIsModalOpen(true);
  };

  const handleVoid = (t: Transaction) => {
      if (!confirm("Anular este registo? Criará estorno automático.")) return;
      const voidTx: Transaction = { ...t, id: Date.now(), date: new Date().toISOString().split('T')[0], description: `ESTORNO: ${t.description}`, income: t.expense, expense: t.income, relatedTransactionId: t.id };
      setTransactions(prev => prev.map(old => old.id === t.id ? { ...old, isVoided: true } : old).concat(voidTx));
      notify('info', 'Registo anulado.');
  };

  // Split View Selection Handlers
  const handleBankSelect = (id: string) => {
      setSelectedBankId(prev => prev === id ? null : id);
  };

  const handleSystemSelect = (id: number) => {
      setSelectedSystemIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const executeReconciliation = () => {
      if (!selectedBankId || selectedSystemIds.length === 0) return;
      
      const bankTx = bankTransactions.find(b => b.id === selectedBankId);
      if(!bankTx) return;

      const sysSum = transactions.filter(t => selectedSystemIds.includes(t.id)).reduce((acc, t) => acc + ((t.income||0)-(t.expense||0)), 0);
      
      if (Math.abs(sysSum - bankTx.amount) > 0.05) {
          if (!confirm(`Diferença de valor detectada (${formatCurrency(sysSum - bankTx.amount)}). Continuar mesmo assim?`)) return;
      }

      setTransactions(prev => prev.map(t => selectedSystemIds.includes(t.id) ? { ...t, isReconciled: true } : t));
      setBankTransactions(prev => prev.map(b => b.id === selectedBankId ? { ...b, reconciled: true, systemMatchIds: selectedSystemIds } : b));
      
      setSelectedBankId(null);
      setSelectedSystemIds([]);
      notify('success', 'Conciliação efetuada com sucesso.');
  };

  const handleUnreconcile = (bt: BankTransaction) => {
      if (!confirm("Cancelar conciliação?")) return;
      if (bt.systemMatchIds) setTransactions(prev => prev.map(t => bt.systemMatchIds!.includes(t.id) ? { ...t, isReconciled: false } : t));
      setBankTransactions(prev => prev.map(b => b.id === bt.id ? { ...b, reconciled: false, systemMatchIds: [] } : b));
      setMatchViewModalOpen(false);
      notify('info', 'Conciliação cancelada.');
  };

  const SortableHeader = ({ label, column }: { label: string, column: keyof Transaction }) => (
    <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100 select-none" onClick={() => setSortConfig({ key: column, direction: sortConfig.key === column && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
        {label} {sortConfig.key === column && (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="inline ml-1 text-green-600"/> : <ArrowDown size={14} className="inline ml-1 text-green-600"/>)}
    </th>
  );

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <div><h2 className="text-2xl font-bold text-gray-800">Tesouraria</h2><p className="text-gray-500 text-sm">Gestão de caixa e banco</p></div>
        <div className="flex bg-gray-200 p-1 rounded-lg">
            <button onClick={() => setSubView('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'dashboard' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><LayoutDashboard size={16} /> Gráfico</button>
            <button onClick={() => setSubView('records')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'records' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><Table size={16} /> Registo</button>
            <button onClick={() => setSubView('reconciliation')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'reconciliation' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><RefreshCw size={16} /> Conciliação</button>
        </div>
      </div>

      {/* DASHBOARD VIEW */}
      {subView === 'dashboard' && (
          <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto pr-2">
              <div className="flex justify-end">
                  <div className="flex gap-2">
                      <select name="month" value={dashFilters.month} onChange={(e) => setDashFilters({...dashFilters, month: Number(e.target.value)})} className="border rounded px-2 py-1.5 text-sm outline-none"><option value={0}>Todos os Meses</option><option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option><option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option><option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option><option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option></select>
                      <select name="year" value={dashFilters.year} onChange={(e) => setDashFilters({...dashFilters, year: Number(e.target.value)})} className="border rounded px-2 py-1.5 text-sm outline-none"><option value={2024}>2024</option><option value={2025}>2025</option><option value={2026}>2026</option></select>
                  </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500"><p className="text-sm font-medium text-gray-500">Receitas</p><h3 className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(dashboardData.totalIncome)}</h3></div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-red-500"><p className="text-sm font-medium text-gray-500">Despesas</p><h3 className="text-2xl font-bold text-red-700 mt-1">{formatCurrency(dashboardData.totalExpense)}</h3></div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500"><p className="text-sm font-medium text-gray-500">Saldo Líquido</p><h3 className={`text-2xl font-bold mt-1 ${dashboardData.balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(dashboardData.balance)}</h3></div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500"><p className="text-sm font-medium text-gray-500">A Conciliar</p><h3 className="text-2xl font-bold text-orange-700 mt-1">{dashboardData.unreconciledCount}</h3></div>
              </div>

              {/* Main Chart (Income vs Expense) */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 h-[300px]">
                  <h3 className="text-sm font-bold text-gray-600 mb-4 ml-2">Fluxo de Caixa (Entradas vs Saídas)</h3>
                  <ResponsiveContainer width="100%" height="90%"><ComposedChart data={dashboardData.flowData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip formatter={(v:any)=>formatCurrency(v)}/><Legend/><Bar dataKey="income" name="Entrada" fill="#16a34a" barSize={30}/><Bar dataKey="expense" name="Saída" fill="#dc2626" barSize={30}/></ComposedChart></ResponsiveContainer>
              </div>

              {/* New Analytics Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                  {/* Top 10 Expenses Pie Chart */}
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 h-[350px] flex flex-col">
                      <h3 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2"><PieChartIcon size={16}/> Top 10 Categorias de Despesa</h3>
                      {topExpenses.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie
                                      data={topExpenses}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={60}
                                      outerRadius={100}
                                      paddingAngle={2}
                                      dataKey="value"
                                  >
                                      {topExpenses.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{fontSize: '11px'}} />
                              </PieChart>
                          </ResponsiveContainer>
                      ) : (
                          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Sem despesas no período.</div>
                      )}
                  </div>

                  {/* Monthly Evolution by Category */}
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 h-[350px] flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-sm font-bold text-gray-600 flex items-center gap-2"><TrendingUp size={16}/> Evolução Mensal (Ano {dashFilters.year})</h3>
                          <select className="text-xs border rounded p-1 max-w-[120px]" value={evolutionCategory} onChange={(e) => setEvolutionCategory(e.target.value)}>
                              <option value="Todas">Todas</option>
                              {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>
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
      )}

      {/* RECORDS VIEW (SYSTEM TRANSACTIONS) */}
      {subView === 'records' && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg flex flex-col animate-fade-in-up flex-1 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                  <div className="flex gap-2">
                      <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="border rounded px-3 py-1.5 text-sm w-64 outline-none focus:ring-1 focus:ring-green-500"/>
                      <select name="month" value={regFilters.month} onChange={(e) => setRegFilters({...regFilters, month: Number(e.target.value)})} className="border rounded px-2 py-1.5 text-sm outline-none"><option value={0}>Todos os Meses</option><option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option><option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option><option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option><option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option></select>
                  </div>
                  <div className="flex gap-2">
                      <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={(e) => handleFileSelect(e, 'system')} />
                      
                      <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-xl hover:bg-gray-50 text-xs font-black uppercase tracking-widest transition-all shadow-sm">
                          <Upload size={16} /> Importar Excel
                      </button>
                      <button onClick={() => { setNewTransaction({ date: new Date().toISOString().split('T')[0], type: 'Dinheiro', category: 'Geral', status: 'Pago', absValue: '' }); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center gap-2">
                          <Plus size={16} /> Novo Registo
                      </button>
                  </div>
              </div>
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
                                  <td className="px-3 py-3 text-gray-600">{new Date(t.date).toLocaleDateString()}</td>
                                  <td className="px-3 py-3 font-bold text-gray-800">{t.description}</td>
                                  <td className="px-3 py-3"><span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-medium">{t.category}</span></td>
                                  <td className="px-3 py-3 font-mono font-bold">
                                      {t.income ? <span className="text-green-600">+{formatCurrency(t.income)}</span> : <span className="text-red-600">-{formatCurrency(t.expense)}</span>}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                      <div className="flex justify-center gap-1">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${t.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span>
                                        {t.isReconciled && <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded" title="Conciliado"><CheckSquare size={12}/></span>}
                                      </div>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                      {!t.isVoided && <button onClick={() => handleVoid(t)} className="text-red-300 hover:text-red-600 p-1 rounded transition-colors" title="Anular"><Ban size={16}/></button>}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* RECONCILIATION SPLIT VIEW */}
      {subView === 'reconciliation' && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden animate-fade-in-up">
              {/* Toolbar */}
              <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm shrink-0">
                  <div className="flex items-center gap-2">
                      {selectedBankId && selectedSystemIds.length > 0 ? (
                          <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase bg-blue-100 text-blue-700 px-2 py-1 rounded">1 Banco</span>
                              <ArrowRight size={14} className="text-gray-400"/>
                              <span className="text-xs font-black uppercase bg-blue-100 text-blue-700 px-2 py-1 rounded">{selectedSystemIds.length} Sistema</span>
                              
                              {(() => {
                                  const bankTx = bankTransactions.find(b => b.id === selectedBankId);
                                  const sysSum = transactions.filter(t => selectedSystemIds.includes(t.id)).reduce((acc, t) => acc + ((t.income||0)-(t.expense||0)), 0);
                                  const diff = (bankTx?.amount || 0) - sysSum;
                                  const isMatch = Math.abs(diff) < 0.05;
                                  
                                  return (
                                      <>
                                        <span className={`ml-4 font-mono font-bold text-lg ${isMatch ? 'text-green-600' : 'text-red-600'}`}>
                                            Diferença: {formatCurrency(diff)}
                                        </span>
                                        <button onClick={executeReconciliation} className={`ml-4 px-6 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-all shadow ${isMatch ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
                                            Conciliar
                                        </button>
                                      </>
                                  );
                              })()}
                          </div>
                      ) : (
                          <span className="text-sm text-gray-500 flex items-center gap-2"><MousePointerClick size={16}/> Selecione transações de ambos os lados para conciliar.</span>
                      )}
                  </div>
                  
                  <div className="flex gap-2">
                      <button onClick={() => { if(fileInputRef.current) fileInputRef.current.click(); }} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase hover:bg-gray-50 transition-all flex items-center gap-2">
                          <Upload size={14} /> Importar Extrato
                      </button>
                      <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={(e) => handleFileSelect(e, 'bank')} />
                  </div>
              </div>

              {/* Split Panels */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
                  
                  {/* LEFT: BANK TRANSACTIONS */}
                  <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden shadow-sm">
                      <div className="p-3 border-b bg-gray-50 flex flex-col gap-2 shrink-0">
                          <div className="flex justify-between items-center">
                              <h3 className="font-bold text-gray-700 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Extrato Bancário</h3>
                              <select className="text-xs border rounded p-1" value={recBankStatus} onChange={e => setRecBankStatus(e.target.value as any)}>
                                  <option value="unreconciled">Pendentes</option>
                                  <option value="reconciled">Conciliados</option>
                                  <option value="all">Todos</option>
                              </select>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                              <div className="relative">
                                  <input type="date" value={recBankDate} onChange={e=>setRecBankDate(e.target.value)} className="w-full text-xs border rounded p-1.5 outline-none focus:ring-1 focus:ring-blue-500" />
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
                                  {recBankTransactions.map(bt => (
                                      <tr 
                                        key={bt.id} 
                                        onClick={() => handleBankSelect(bt.id)}
                                        className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedBankId === bt.id ? 'bg-blue-100 ring-1 ring-inset ring-blue-500' : ''}`}
                                      >
                                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(bt.date).toLocaleDateString()}</td>
                                          <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[150px]">{bt.description}</td>
                                          <td className={`px-3 py-2 text-right font-mono font-bold ${bt.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {formatCurrency(Math.abs(bt.amount))}
                                          </td>
                                          <td className="px-2 py-2 text-right">
                                              {!bt.reconciled && (
                                                  <button title="Criar Registo" onClick={(e) => handleCreateFromBank(bt, e)} className="text-gray-400 hover:text-blue-600 hover:bg-blue-100 p-1 rounded transition-colors"><CopyPlus size={14}/></button>
                                              )}
                                          </td>
                                      </tr>
                                  ))}
                                  {recBankTransactions.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">Sem dados.</td></tr>}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* RIGHT: SYSTEM TRANSACTIONS */}
                  <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden shadow-sm">
                      <div className="p-3 border-b bg-gray-50 flex flex-col gap-2 shrink-0">
                          <div className="flex justify-between items-center">
                              <h3 className="font-bold text-gray-700 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> Registos Sistema</h3>
                              <select className="text-xs border rounded p-1" value={recSysStatus} onChange={e => setRecSysStatus(e.target.value as any)}>
                                  <option value="unreconciled">Pendentes</option>
                                  <option value="reconciled">Conciliados</option>
                                  <option value="all">Todos</option>
                              </select>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                              <div className="relative">
                                  <input type="date" value={recSysDate} onChange={e=>setRecSysDate(e.target.value)} className="w-full text-xs border rounded p-1.5 outline-none focus:ring-1 focus:ring-green-500" />
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
                                      const amount = (t.income || 0) - (t.expense || 0);
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
                                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</td>
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

      {/* MODAL NOVA TRANSAÇÃO */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Registo Financeiro">
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

              <div className="grid grid-cols-2 gap-6">
                  <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-1">Categoria</label>
                      <input list="cats" name="category" value={newTransaction.category} onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-green-500" />
                      <datalist id="cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-1">Meio de Pagamento</label>
                      <select name="type" value={newTransaction.type} onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value as any})} className="w-full border rounded-xl p-3 outline-none bg-white">
                          <option>Dinheiro</option><option>Cheque</option><option>Transferência</option><option>Vinti4</option>
                      </select>
                  </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100">Cancelar</button>
                  <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200">Guardar</button>
              </div>
          </form>
      </Modal>

      {/* MODAL PREVIEW IMPORTAÇÃO (UNIFICADO) */}
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title={`Pré-visualizar Importação (${importType === 'system' ? 'Registos' : 'Extrato Bancário'})`}>
          <div className="space-y-4">
              <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="text-sm text-blue-800">
                      <strong>{previewData.filter(t => t.isValid).length}</strong> linhas válidas encontradas.
                  </div>
                  {previewData.some(t => !t.isValid) && <div className="text-sm text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={16}/> {previewData.filter(t => !t.isValid).length} erros</div>}
              </div>
              <div className="max-h-[400px] overflow-auto border rounded-xl">
                  <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0"><tr><th className="p-2">Status</th><th className="p-2">Data</th><th className="p-2">Descrição</th><th className="p-2 text-right">Valor</th><th className="p-2">Msg</th></tr></thead>
                      <tbody>
                          {previewData.map(r => (
                              <tr key={r.id} className={r.isValid ? 'bg-white' : 'bg-red-50'}>
                                  <td className="p-2 text-center">{r.isValid ? <Check size={14} className="text-green-500"/> : <X size={14} className="text-red-500"/>}</td>
                                  <td className="p-2">{r.isValid ? new Date(r.date).toLocaleDateString() : String(r.rawDate)}</td>
                                  <td className="p-2 truncate max-w-[200px]">{r.description}</td>
                                  <td className="p-2 font-mono text-right">
                                      {importType === 'system' ? (
                                          r.income ? `+${r.income}` : `-${r.expense}`
                                      ) : (
                                          r.amount
                                      )}
                                  </td>
                                  <td className="p-2 text-red-500">{r.errors.join(', ')}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Cancelar</button>
                  <button onClick={confirmImport} disabled={previewData.filter(t=>t.isValid).length===0} className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 disabled:opacity-50">Confirmar</button>
              </div>
          </div>
      </Modal>

      {/* MODAL VER CONCILIAÇÃO */}
      <Modal isOpen={matchViewModalOpen} onClose={() => setMatchViewModalOpen(false)} title="Detalhe da Conciliação">
          <div className="space-y-6">
              {viewMatchPair && (
                  <>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase mb-2">Movimento Bancário</h4>
                          <div className="flex justify-between">
                              <span className="font-bold text-gray-800">{viewMatchPair.bank.description}</span>
                              <span className="font-mono font-black">{formatCurrency(viewMatchPair.bank.amount)}</span>
                          </div>
                      </div>
                      
                      <div className="flex justify-center"><Link size={24} className="text-gray-300 rotate-90"/></div>

                      <div className="border rounded-xl overflow-hidden">
                          <div className="bg-gray-100 p-2 text-xs font-bold text-gray-500 border-b">Registos no Sistema ({viewMatchPair.system.length})</div>
                          {viewMatchPair.system.map(t => (
                              <div key={t.id} className="p-3 border-b last:border-0 bg-white flex justify-between">
                                  <span className="text-sm text-gray-700">{t.description}</span>
                                  <span className="font-mono font-bold text-sm">{formatCurrency((t.income || 0) - (t.expense || 0))}</span>
                              </div>
                          ))}
                      </div>

                      <div className="flex justify-end pt-4">
                          <button onClick={() => handleUnreconcile(viewMatchPair.bank)} className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                              <Ban size={16}/> Desfazer Conciliação
                          </button>
                      </div>
                  </>
              )}
          </div>
      </Modal>
    </div>
  );
};
