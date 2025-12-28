
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Transaction, Client, BankTransaction, SystemSettings, Account, AccountType } from '../types';
import { Plus, Upload, AlertTriangle, Check, X, Edit2, Search, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, RefreshCw, Link, CheckSquare, Calendar, Filter, Eye, RotateCcw, Ban, Undo2, LineChart, PieChart as PieChartIcon, Scale, ArrowRight, MousePointerClick, Wand2, CopyPlus, Download, Zap, Wallet, BarChart4, AlertCircle, Loader2, Table, TrendingUp, Trash2 } from 'lucide-react';
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
    categories: Account[]; // Updated Type
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
  
  // Local Loading State to prevent white screen
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
      // Simulate/Check data readiness
      if (transactions) {
          setIsLoading(false);
      }
  }, [transactions]);

  const [subView, setSubView] = useState<'dashboard' | 'records' | 'reconciliation'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // --- FILTERS STATE (DEFENSIVE INITIALIZATION) ---
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
          status: saved.status || 'Todos'
      };
  });

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
  const [recBankDateMode, setRecBankDateMode] = useState<'month' | 'day'>('month');
  const [recBankValue, setRecBankValue] = useState('');
  const [recBankStatus, setRecBankStatus] = useState<'all' | 'reconciled' | 'unreconciled'>('unreconciled');
  
  // System Side Filters
  const [recSysSearch, setRecSysSearch] = useState('');
  const [recSysDate, setRecSysDate] = useState('');
  const [recSysDateMode, setRecSysDateMode] = useState<'month' | 'day'>('month');
  const [recSysValue, setRecSysValue] = useState('');
  const [recSysStatus, setRecSysStatus] = useState<'all' | 'reconciled' | 'unreconciled'>('unreconciled');

  // Smart Auto Filter
  const [isAutoFilterEnabled, setIsAutoFilterEnabled] = useState(false);

  // Selection
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [selectedSystemIds, setSelectedSystemIds] = useState<number[]>([]);

  // Match View State
  const [matchViewModalOpen, setMatchViewModalOpen] = useState(false);
  const [viewMatchPair, setViewMatchPair] = useState<{bank: BankTransaction, system: Transaction[]} | null>(null);

  // Auto Match Logic State
  const [isAutoMatchModalOpen, setIsAutoMatchModalOpen] = useState(false);
  const [autoMatchProposals, setAutoMatchProposals] = useState<AutoMatchProposal[]>([]);

  // New Transaction Form State
  const [newTxType, setNewTxType] = useState<'income' | 'expense'>('income');
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction> & { absValue?: string }>({
    date: new Date().toISOString().split('T')[0],
    type: 'Dinheiro',
    category: '',
    status: 'Pago',
    absValue: '',
    clientId: undefined
  });

  // Calculate Available Years from Data
  const availableYears = useMemo(() => {
      const years = new Set<number>();
      years.add(new Date().getFullYear()); // Always include current year
      transactions.forEach(t => {
          if (t.date) {
              const y = new Date(t.date).getFullYear();
              if (!isNaN(y)) years.add(y);
          }
      });
      return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // --- HELP ---
  useEffect(() => {
      let title = "Módulo de Tesouraria";
      let content = "Gerencie todas as finanças da empresa aqui.";
      if (subView === 'dashboard') {
          title = "Dashboard Financeiro";
          content = `Visualize o fluxo de caixa e KPIs de saúde económica.\n\nSeparamos agora os movimentos operacionais dos movimentos de balanço (empréstimos, transferências) para uma visão real do lucro.`;
      } else if (subView === 'records') {
          title = "Tabela de Registos";
          content = `Aqui estão os registos internos da empresa.\n\nUse os códigos do Plano de Contas para classificar corretamente.`;
      } else if (subView === 'reconciliation') {
          title = "Conciliação Bancária";
          content = `Selecione movimentos bancários à esquerda e encontre os registos correspondentes à direita.`;
      }
      setHelpContent({ title, content });
  }, [subView, setHelpContent]);

  // --- HELPERS ---
  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '0 CVE';
    return val.toLocaleString('pt-CV') + ' CVE';
  };

  const formatDateDisplay = (dateString: string) => {
      if (!dateString) return '-';
      try {
          const parts = dateString.split('-');
          if (parts.length === 3) {
              return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          return dateString;
      } catch (e) {
          return dateString;
      }
  };

  const calculateStringSimilarity = (str1: string, str2: string): number => {
      const s1 = str1.toLowerCase().split(/\s+/);
      const s2 = str2.toLowerCase().split(/\s+/);
      const intersection = s1.filter(word => s2.includes(word));
      return (2 * intersection.length) / (s1.length + s2.length);
  };

  const parseExcelDate = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'number') {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000) + 43200000);
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

  const exportToExcel = (data: any[], filename: string) => {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dados");
      XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  // --- AUTO MATCH LOGIC ---
  const handleRunAutoMatch = () => {
      const proposals: AutoMatchProposal[] = [];
      const usedSystemIds = new Set<number>();

      const bankPendings = bankTransactions.filter(b => !b.reconciled);
      const sysPendings = transactions.filter(t => !t.isReconciled && !t.isVoided);

      bankPendings.forEach(bankTx => {
          const match = sysPendings.find(sysTx => {
              if (usedSystemIds.has(sysTx.id)) return false;
              
              const sysAmount = (Number(sysTx.income || 0)) - (Number(sysTx.expense || 0));
              const amountMatch = Math.abs(Math.abs(sysAmount) - Math.abs(bankTx.amount)) < 0.01;
              const dateMatch = sysTx.date === bankTx.date;

              return amountMatch && dateMatch;
          });

          if (match) {
              usedSystemIds.add(match.id);
              proposals.push({
                  bank: bankTx,
                  system: match,
                  similarityScore: calculateStringSimilarity(bankTx.description, match.description)
              });
          }
      });

      if (proposals.length === 0) {
          notify('info', 'Não foram encontradas correspondências exatas automáticas.');
          return;
      }

      setAutoMatchProposals(proposals);
      setIsAutoMatchModalOpen(true);
  };

  const executeAutoMatch = (matches: AutoMatchProposal[]) => {
      if (matches.length === 0) return;

      const bankIdsToUpdate = matches.map(m => m.bank.id);
      const sysIdsToUpdate = matches.map(m => m.system.id);

      setBankTransactions(prev => prev.map(b => {
          if (bankIdsToUpdate.includes(b.id)) {
              const match = matches.find(m => m.bank.id === b.id);
              return { ...b, reconciled: true, systemMatchIds: match ? [match.system.id] : [] };
          }
          return b;
      }));

      setTransactions(prev => prev.map(t => {
          if (sysIdsToUpdate.includes(t.id)) {
              return { ...t, isReconciled: true };
          }
          return t;
      }));

      notify('success', `${matches.length} transações conciliadas automaticamente.`);
      
      setAutoMatchProposals(prev => prev.filter(p => !bankIdsToUpdate.includes(p.bank.id)));
      
      if (matches.length === autoMatchProposals.length) {
          setIsAutoMatchModalOpen(false);
      }
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

            const rawCat = findValueInRow(row, ['Categoria', 'Category', 'Conta', 'Account', 'Rubrica', 'Classificação']) || '';
            const catStr = String(rawCat).trim();
            
            let finalCategory = 'Geral (Revisar)';
            let matchedAccount: Account | undefined;

            if (catStr && categories.length > 0) {
                matchedAccount = categories.find(c => c.code === catStr);
                
                if (!matchedAccount) {
                    matchedAccount = categories.find(c => c.name.toLowerCase() === catStr.toLowerCase());
                }
                
                if (!matchedAccount) {
                    matchedAccount = categories.find(c => {
                        if (!catStr.startsWith(c.code)) return false;
                        const charAfter = catStr[c.code.length];
                        return !charAfter || [' ', '-', '.', ':', '_'].includes(charAfter);
                    });
                }

                if (matchedAccount) {
                    finalCategory = matchedAccount.name;
                } else {
                    finalCategory = catStr + ' (Novo?)';
                }
            }

            let isDuplicate = false;
            if (type === 'system' && parsedDate) {
                const exists = transactions.some(t => 
                    t.date === parsedDate && 
                    t.description === description && 
                    ((income && t.income === income) || (expense && t.expense === expense))
                );
                if (exists) isDuplicate = true;
            } else if (type === 'bank' && parsedDate) {
                const exists = bankTransactions.some(b => 
                    b.date === parsedDate && 
                    b.description === description && 
                    Math.abs(b.amount - finalAmount) < 0.01
                );
                if (exists) isDuplicate = true;
            }

            return {
                id: Date.now() + idx,
                date: parsedDate || '',
                description,
                amount: finalAmount,
                income,
                expense,
                category: finalCategory,
                isValid: errors.length === 0,
                isDuplicate,
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
      const rowsToImport = previewData.filter(r => r.isValid && !r.isDuplicate);
      
      if (rowsToImport.length === 0) {
          notify('info', 'Nenhum registo novo para importar.');
          setIsImportModalOpen(false);
          return;
      }
      
      if (importType === 'system') {
          const newTxs: Transaction[] = rowsToImport.map((r, i) => ({
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
          notify('success', `${newTxs.length} registos importados.`);
      } else {
          const newBankTxs: BankTransaction[] = rowsToImport.map((r, i) => ({
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

  // --- KPI & DASHBOARD DATA ---
  /**
   * Calculates financial KPIs based on transactions, categories and filters.
   * Splits Operational Revenue vs. Balance Sheet moves for accurate EBITDA.
   */
  const dashboardData = useMemo(() => {
    // If loading, return safe defaults. 
    // REMOVED CATEGORY CHECK TO ALLOW DASHBOARD TO RENDER WITHOUT CATEGORIES
    if (isLoading) {
        return { 
            operationalRevenue: 0, variableCosts: 0, fixedCosts: 0, financialCosts: 0, balanceSheetMoves: 0,
            grossMargin: 0, grossMarginPerc: 0, ebitda: 0, netResult: 0,
            cashBalance: 0, flowData: [], unreconciledCount: 0 
        };
    }

    const filtered = transactions.filter(t => {
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return false;
      const matchesMonth = Number(dashFilters.month) === 0 || (tDate.getMonth() + 1) === Number(dashFilters.month);
      const matchesYear = tDate.getFullYear() === Number(dashFilters.year);
      return matchesMonth && matchesYear && !t.isVoided && t.status === 'Pago';
    });

    let operationalRevenue = 0;
    let variableCosts = 0;
    let fixedCosts = 0;
    let financialCosts = 0;
    let balanceSheetMoves = 0;

    filtered.forEach(t => {
        const account = categories.find(c => c.name === t.category);
        const type = account?.type;
        const val = (Number(t.income) || 0) - (Number(t.expense) || 0);

        if (!type) {
            // Default logic if no category matched
            if(val > 0) operationalRevenue += val;
            else fixedCosts += Math.abs(val);
        } else if (type === 'Movimento de Balanço') {
            balanceSheetMoves += val;
        } else if (type === 'Receita Operacional') {
            operationalRevenue += (Number(t.income) || 0);
        } else if (type === 'Custo Direto') {
            variableCosts += (Number(t.expense) || 0);
        } else if (type === 'Custo Fixo') {
            fixedCosts += (Number(t.expense) || 0);
        } else if (type === 'Despesa Financeira') {
            financialCosts += (Number(t.expense) || 0);
        }
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
            const inc = txs.reduce((acc, t) => acc + (Number(t.income)||0), 0);
            const exp = txs.reduce((acc, t) => acc + (Number(t.expense)||0), 0);
            return { name: m, income: inc, expense: exp };
        });
    } else {
        const days = Array.from(new Set(filtered.map(t => new Date(t.date).getDate()))).sort((a:number, b:number) => a-b);
        flowData = days.map(d => {
            const txs = filtered.filter(t => new Date(t.date).getDate() === d);
            const inc = txs.reduce((acc, t) => acc + (Number(t.income)||0), 0);
            const exp = txs.reduce((acc, t) => acc + (Number(t.expense)||0), 0);
            return { name: d.toString(), income: inc, expense: exp };
        });
    }

    return { 
        operationalRevenue, variableCosts, fixedCosts, financialCosts, balanceSheetMoves,
        grossMargin, grossMarginPerc, ebitda, netResult,
        cashBalance, flowData, unreconciledCount: filtered.filter(t => !t.isReconciled).length 
    };
  }, [transactions, dashFilters, categories, isLoading]); 

  // --- EVOLUTION DATA ---
  const evolutionData = useMemo(() => {
    if (isLoading) return [];
    const year = Number(dashFilters.year);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months.map((m, idx) => {
        const txs = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === year && d.getMonth() === idx && !t.isVoided && t.status === 'Pago' && (evolutionCategory === 'Todas' || t.category === evolutionCategory);
        });
        return {
            name: m,
            income: txs.reduce((acc, t) => acc + (Number(t.income) || 0), 0),
            expense: txs.reduce((acc, t) => acc + (Number(t.expense) || 0), 0)
        };
    });
  }, [transactions, dashFilters.year, evolutionCategory, isLoading]);

  const registryFilteredTransactions = useMemo(() => {
      const baseFiltered = transactions.filter(t => {
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
          if (sortConfig.key === 'income') { 
              const valA = Number(a.income || 0) - Number(a.expense || 0);
              aV = valA;
              const valB = Number(b.income || 0) - Number(b.expense || 0);
              bV = valB;
          }
          if (aV < bV) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aV > bV) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [transactions, regFilters, searchTerm, sortConfig]);

  const recBankTransactions = useMemo(() => {
      return bankTransactions.filter(bt => {
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
          if (t.isVoided) return false;
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
      if (isAutoFilterEnabled && selectedBankIds.length > 0) {
          const selectedBankTxs = bankTransactions.filter(b => selectedBankIds.includes(b.id));
          const totalBankValue = selectedBankTxs.reduce((sum, b) => sum + Number(b.amount), 0);
          const margin = settings.reconciliationValueMargin || 0.1;
          filtered = filtered.filter(t => {
              const amount = (Number(t.income ?? 0)) - (Number(t.expense ?? 0));
              if (selectedSystemIds.includes(t.id)) return true;
              const closeToTotal = Math.abs(Math.abs(amount) - Math.abs(totalBankValue)) <= margin * 100;
              const closeToAny = selectedBankTxs.some(b => Math.abs(Math.abs(amount) - Math.abs(b.amount)) <= margin);
              return closeToTotal || closeToAny;
          });
      }
      return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, recSysSearch, recSysDate, recSysDateMode, recSysValue, recSysStatus, isAutoFilterEnabled, selectedBankIds, bankTransactions, selectedSystemIds, settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(newTransaction.absValue);
    if (!val || val <= 0) return notify('error', 'Valor inválido.');

    const transaction: Transaction = {
      id: editingId || Date.now(), 
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
    
    if (editingId) {
        setTransactions(prev => prev.map(t => t.id === editingId ? { ...t, ...transaction } : t));
        notify('success', 'Registo atualizado.');
    } else {
        setTransactions(prev => [transaction, ...prev]);
        notify('success', 'Lançamento criado.');
    }
    setIsModalOpen(false);
  };

  const groupedCategories = useMemo(() => {
      const groups: Record<AccountType, Account[]> = {
          'Receita Operacional': [],
          'Custo Direto': [],
          'Custo Fixo': [],
          'Despesa Financeira': [],
          'Movimento de Balanço': []
      };
      // Protect against null categories during lazy load
      (categories || []).forEach(c => {
          if (groups[c.type]) groups[c.type].push(c);
      });
      return groups;
  }, [categories]);

  const handleEdit = (t: Transaction) => { setEditingId(t.id); setNewTxType(t.income ? 'income' : 'expense'); setNewTransaction({ date: t.date, description: t.description, reference: t.reference, type: t.type, category: t.category, status: t.status, absValue: t.income ? String(t.income) : String(t.expense), clientId: t.clientId }); setIsModalOpen(true); };
  const handleCreateFromBank = (bt: BankTransaction, e: React.MouseEvent) => { e.stopPropagation(); setEditingId(null); setNewTxType(bt.amount >= 0 ? 'income' : 'expense'); setNewTransaction({ date: bt.date, description: bt.description, type: 'Transferência', category: 'Geral', status: 'Pago', absValue: Math.abs(bt.amount).toString(), reference: `Auto-banco` }); setIsModalOpen(true); };
  
  // Logic updated to support Hard Delete vs Void
  const handleDeleteOrVoid = (t: Transaction) => {
      if (settings.enableTreasuryHardDelete) {
          if(!confirm("ATENÇÃO: Tem a certeza que deseja ELIMINAR permanentemente este registo?\nEsta ação não pode ser desfeita.")) return;
          setTransactions(prev => prev.filter(x => x.id !== t.id));
          notify('success', 'Registo eliminado permanentemente.');
      } else {
          if (!confirm("Anular este registo? Criará estorno automático.")) return; 
          const voidTx: Transaction = { ...t, id: Date.now(), date: new Date().toISOString().split('T')[0], description: `ESTORNO: ${t.description}`, income: t.expense, expense: t.income, relatedTransactionId: t.id }; 
          setTransactions(prev => prev.map(old => old.id === t.id ? { ...old, isVoided: true } : old).concat(voidTx)); 
          notify('info', 'Registo anulado (Estornado).'); 
      }
  };

  const handleBankSelect = (id: string) => { setSelectedBankIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const handleSystemSelect = (id: number) => { setSelectedSystemIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  
  /** 
   * Reconciles selected transactions.
   * Matches bank total with system total within tolerance margin.
   */
  const executeReconciliation = () => { 
      if (selectedBankIds.length === 0 || selectedSystemIds.length === 0) return; 
      
      const bankTxs = bankTransactions.filter(b => selectedBankIds.includes(b.id)); 
      const sysTxs = transactions.filter(t => selectedSystemIds.includes(t.id)); 
      
      const bankSum = bankTxs.reduce((sum, b) => sum + Number(b.amount), 0); 
      const sysSum = sysTxs.reduce((acc, t) => acc + (Number(t.income || 0) - Number(t.expense || 0)), 0); 
      
      const diff = Math.abs(bankSum - sysSum); 
      const margin = settings.reconciliationValueMargin || 0.1; 
      
      if (diff > margin) { 
          notify('error', `Diferença (${formatCurrency(diff)}) excede a margem permitida (${margin}). Impossível conciliar.`); 
          return; 
      } 
      
      setTransactions(prev => prev.map(t => selectedSystemIds.includes(t.id) ? { ...t, isReconciled: true } : t)); 
      setBankTransactions(prev => prev.map(b => selectedBankIds.includes(b.id) ? { ...b, reconciled: true, systemMatchIds: selectedSystemIds } : b)); 
      
      setSelectedBankIds([]); 
      setSelectedSystemIds([]); 
      notify('success', 'Conciliação efetuada com sucesso.'); 
  };

  const handleUnreconcile = (bt: BankTransaction) => { if (!confirm("Cancelar conciliação?")) return; if (bt.systemMatchIds) setTransactions(prev => prev.map(t => bt.systemMatchIds!.includes(t.id) ? { ...t, isReconciled: false } : t)); setBankTransactions(prev => prev.map(b => b.id === bt.id ? { ...b, reconciled: false, systemMatchIds: [] } : b)); setMatchViewModalOpen(false); notify('info', 'Conciliação cancelada.'); };
  const SortableHeader = ({ label, column }: { label: string, column: keyof Transaction }) => ( <th className="px-3 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100 select-none" onClick={() => setSortConfig({ key: column, direction: sortConfig.key === column && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}> {label} {sortConfig.key === column && (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="inline ml-1 text-green-600"/> : <ArrowDown size={14} className="inline ml-1 text-green-600"/>)} </th> );

  if (isLoading) {
      return (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 h-[500px]">
              <Loader2 className="animate-spin mb-4" size={48} />
              <p className="font-medium">A carregar dados financeiros...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div><h2 className="text-2xl font-bold text-gray-800">Tesouraria & Controlo</h2><p className="text-gray-500 text-sm">Gestão de caixa e saúde económica</p></div>
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

      {/* DASHBOARD VIEW - REFORMULADO */}
      {subView === 'dashboard' && (
          <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto pr-2">
              <div className="flex justify-end">
                  <div className="flex gap-2">
                      <select name="month" value={dashFilters.month} onChange={(e) => setDashFilters({...dashFilters, month: Number(e.target.value)})} className="border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white"><option value={0}>Todos os Meses</option><option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option><option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option><option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option><option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option></select>
                      <select name="year" value={dashFilters.year} onChange={(e) => setDashFilters({...dashFilters, year: Number(e.target.value)})} className="border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white">
                          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                  </div>
              </div>

              {/* SECTION 1: SAÚDE ECONÓMICA (DRE) */}
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

              {/* SECTION 2: FLUXO DE CAIXA REAL (TESOURARIA) */}
              <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest flex items-center gap-2 border-b pb-2 mt-4"><Wallet size={16}/> Fluxo de Caixa (Real)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-800 text-white p-6 rounded-lg shadow-md">
                      <div className="flex justify-between">
                          <div>
                              <p className="text-[10px] font-bold uppercase opacity-70">Saldo de Caixa</p>
                              <h3 className="text-2xl font-bold mt-1">{formatCurrency(dashboardData.cashBalance)}</h3>
                          </div>
                          <Wallet className="text-green-400" size={24}/>
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Movimentos de Balanço</p>
                      <h3 className={`text-xl font-bold mt-1 ${dashboardData.balanceSheetMoves >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(dashboardData.balanceSheetMoves)}</h3>
                      <p className="text-[9px] text-gray-400 mt-1">Empréstimos, Investimentos, Transferências</p>
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
                      <h3 className="text-sm font-bold text-gray-600 mb-4 ml-2">Fluxo de Caixa Mensal (Entradas vs Saídas)</h3>
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
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg flex flex-col animate-fade-in-up flex-1 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0">
                  <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                      <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="border rounded px-3 py-1.5 text-sm w-full md:w-64 outline-none focus:ring-1 focus:ring-green-500"/>
                      <div className="flex gap-2">
                        <select name="month" value={regFilters.month} onChange={(e) => setRegFilters({...regFilters, month: Number(e.target.value)})} className="border rounded px-2 py-1.5 text-sm outline-none flex-1"><option value={0}>Todos os Meses</option><option value={1}>Janeiro</option><option value={2}>Fevereiro</option><option value={3}>Março</option><option value={4}>Abril</option><option value={5}>Maio</option><option value={6}>Junho</option><option value={7}>Julho</option><option value={8}>Agosto</option><option value={9}>Setembro</option><option value={10}>Outubro</option><option value={11}>Novembro</option><option value={12}>Dezembro</option></select>
                        <select name="year" value={regFilters.year} onChange={(e) => setRegFilters({...regFilters, year: Number(e.target.value)})} className="border rounded px-2 py-1.5 text-sm outline-none flex-1">
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
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
              <div className="overflow-x-auto flex-1">
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
                                  <td className="px-3 py-3 font-bold text-gray-800">{t.description}</td>
                                  <td className="px-3 py-3"><span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-medium whitespace-nowrap">{t.category}</span></td>
                                  <td className="px-3 py-3 font-mono font-bold whitespace-nowrap">
                                      {t.income ? <span className="text-green-600">+{formatCurrency(t.income)}</span> : <span className="text-red-600">-{formatCurrency(t.expense)}</span>}
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
                                  const bankSum = bankTxs.reduce((sum, b) => sum + Number(b.amount), 0);
                                  const sysSum = sysTxs.reduce((acc, t) => acc + (Number(t.income || 0) - Number(t.expense || 0)), 0);
                                  
                                  const diff = Math.abs(bankSum - sysSum);
                                  const margin = settings.reconciliationValueMargin || 0.1;
                                  const isMatch = diff <= margin;
                                  
                                  return (
                                      <>
                                        <span className={`font-mono font-bold text-sm ${isMatch ? 'text-green-600' : 'text-red-600'}`}>
                                            Dif: {formatCurrency(bankSum - sysSum)}
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

              {/* Split Panels */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
                  
                  {/* LEFT: BANK TRANSACTIONS */}
                  <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden shadow-sm">
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
                          {/* Bank Filter Inputs */}
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
                                              <td className={`px-3 py-2 text-right font-mono font-bold ${bt.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                  {formatCurrency(Math.abs(bt.amount))}
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
                  <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden shadow-sm">
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
                          {/* System Filter Inputs */}
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
                                      const amount = (Number(t.income ?? 0)) - (Number(t.expense ?? 0));
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

      {/* MODAL NOVA TRANSAÇÃO (UPDATED CATEGORIES) */}
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

      {/* MODAL PREVIEW IMPORTAÇÃO */}
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title={`Pré-visualizar Importação (${importType === 'system' ? 'Registos' : 'Extrato Bancário'})`}>
          {/* ... Content same as before ... */}
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
                  <button onClick={confirmImport} disabled={previewData.filter(t=>t.isValid && !t.isDuplicate).length===0} className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 disabled:opacity-50">Confirmar</button>
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
                                  <span className="font-mono font-bold text-sm">{formatCurrency((Number(t.income) || 0) - (Number(t.expense) || 0))}</span>
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

      {/* MODAL AUTO CONCILIAÇÃO */}
      <Modal isOpen={isAutoMatchModalOpen} onClose={() => setIsAutoMatchModalOpen(false)} title="Auto Conciliação - Correspondências Encontradas">
          <div className="space-y-4 flex flex-col h-[70vh]">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center shrink-0">
                  <div className="text-sm text-blue-800">
                      Encontradas <strong>{autoMatchProposals.length}</strong> correspondências exatas (Data e Valor).
                  </div>
                  <button onClick={() => executeAutoMatch(autoMatchProposals)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase shadow-lg shadow-green-100 hover:bg-green-700 transition-all flex items-center gap-2">
                      <Check size={14}/> Conciliar Todos ({autoMatchProposals.length})
                  </button>
              </div>
              
              <div className="flex-1 overflow-auto border rounded-xl">
                  <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0 text-gray-500 font-bold uppercase z-10">
                          <tr>
                              <th className="p-3 text-left w-24">Data</th>
                              <th className="p-3 text-right w-24">Valor</th>
                              <th className="p-3 text-left">Banco</th>
                              <th className="p-3 w-8"></th>
                              <th className="p-3 text-left">Sistema</th>
                              <th className="p-3 text-center w-24">Ação</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                          {autoMatchProposals.map((prop, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 group">
                                  <td className="p-3 text-gray-600 font-mono">{formatDateDisplay(prop.bank.date)}</td>
                                  <td className="p-3 text-right font-black font-mono">{formatCurrency(prop.bank.amount)}</td>
                                  <td className="p-3 text-gray-800">
                                      {prop.bank.description}
                                      {prop.similarityScore < 0.3 && (
                                          <div className="flex items-center gap-1 text-[10px] text-orange-600 font-bold mt-1 bg-orange-50 w-fit px-2 rounded">
                                              <AlertCircle size={10}/> Descrição Diferente
                                          </div>
                                      )}
                                  </td>
                                  <td className="p-3 text-center"><Link size={14} className="text-gray-300"/></td>
                                  <td className="p-3 text-gray-600">{prop.system.description}</td>
                                  <td className="p-3 text-center">
                                      <button onClick={() => executeAutoMatch([prop])} className="text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-lg font-bold transition-colors">
                                          Conciliar
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </Modal>
    </div>
  );
};
