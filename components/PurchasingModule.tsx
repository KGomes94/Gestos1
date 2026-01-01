
import React, { useState, useMemo, useRef } from 'react';
import { Purchase, Client, Material, SystemSettings, RecurringContract, BankTransaction, StockMovement, RecurringPurchase, Account } from '../types';
import { 
    Plus, LayoutDashboard, List, Repeat, FileBarChart, Upload, Wand2, Search, DollarSign, 
    Play, Edit2, Filter, Download, Hash, Ban, Check, Save
} from 'lucide-react';
import { 
    BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, ResponsiveContainer 
} from 'recharts';
import { currency } from '../utils/currency';
import { printService } from '../services/printService';
import { usePurchaseImport } from '../purchasing/hooks/usePurchaseImport';
import { PurchaseImportModal } from '../purchasing/components/PurchaseImportModal';
import { SmartPurchaseMatchModal } from '../purchasing/components/SmartPurchaseMatchModal';
import { PurchasePaymentModal } from '../purchasing/components/PurchasePaymentModal';
import { ClientFormModal } from '../clients/components/ClientFormModal';
import { SearchableSelect } from './SearchableSelect';
import { useNotification } from '../contexts/NotificationContext';
import { stockService } from '../services/stockService';
import { db } from '../services/db';
import Modal from './Modal';

interface PurchasingModuleProps {
    suppliers: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    materials: Material[];
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
    settings: SystemSettings;
    purchases: Purchase[];
    setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
    setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
    setStockMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>;
    recurringPurchases: RecurringPurchase[];
    setRecurringPurchases: React.Dispatch<React.SetStateAction<RecurringPurchase[]>>;
    categories: Account[];
    bankTransactions: BankTransaction[];
    setBankTransactions: React.Dispatch<React.SetStateAction<BankTransaction[]>>;
}

export const PurchasingModule: React.FC<PurchasingModuleProps> = ({
    suppliers, setClients, materials, setMaterials, settings, purchases, setPurchases, setTransactions, setStockMovements, recurringPurchases = [], setRecurringPurchases = (_: any) => {}, categories = [],
    bankTransactions = [], setBankTransactions
}) => {
    const { notify } = useNotification();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // View State
    const [subView, setSubView] = useState<'dashboard' | 'list' | 'recurring' | 'reports'>('dashboard');
    
    // Filters
    const [filters, setFilters] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), search: '', status: 'Todos' });
    const [valueSearch, setValueSearch] = useState('');
    
    // Reports State
    const [reportFilters, setReportFilters] = useState<{ supplierId: string, year: number, month: number, status: 'Todos' | 'Pendente' | 'Pago' }>({
        supplierId: '',
        year: new Date().getFullYear(),
        month: 0,
        status: 'Todos'
    });

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isSmartMatchOpen, setIsSmartMatchOpen] = useState(false);
    const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);

    // Form State
    const [currentPurchase, setCurrentPurchase] = useState<Partial<Purchase>>({});
    const [currentRecurring, setCurrentRecurring] = useState<Partial<RecurringPurchase>>({});
    const [pendingBatch, setPendingBatch] = useState<any[]>([]);
    const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<Purchase | null>(null);

    // Item Adding State
    const [selectedMatId, setSelectedMatId] = useState('');
    const [qty, setQty] = useState(1);
    const [unitPrice, setUnitPrice] = useState(0);

    // Hooks
    const importHook = usePurchaseImport(purchases, setPurchases, suppliers);

    // --- COMPUTED ---
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        years.add(new Date().getFullYear());
        purchases.forEach(p => years.add(new Date(p.date).getFullYear()));
        return Array.from(years).sort((a,b) => b-a);
    }, [purchases]);

    const dashboardStats = useMemo(() => {
        const yearPurchases = purchases.filter(p => new Date(p.date).getFullYear() === filters.year);
        
        const totalPayable = yearPurchases.filter(p => p.status !== 'Anulada').reduce((acc, p) => currency.add(acc, p.total), 0);
        const totalDebt = yearPurchases.filter(p => p.status === 'Aberta').reduce((acc, p) => currency.add(acc, p.total), 0);
        
        const topSuppliers = Object.entries(yearPurchases.reduce((acc, p) => {
            acc[p.supplierName] = (acc[p.supplierName] || 0) + p.total;
            return acc;
        }, {} as Record<string, number>))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, val]) => ({ name, val }));

        const chartData = Array.from({length: 12}, (_, i) => {
            const m = i + 1;
            const monthPurs = yearPurchases.filter(p => new Date(p.date).getMonth() + 1 === m);
            return {
                name: new Date(0, i).toLocaleString('pt-PT', {month: 'short'}),
                total: monthPurs.filter(p => p.status !== 'Anulada').reduce((acc, p) => currency.add(acc, p.total), 0),
                divida: monthPurs.filter(p => p.status === 'Aberta').reduce((acc, p) => currency.add(acc, p.total), 0)
            };
        });

        return { totalPayable, totalDebt, topSuppliers, chartData };
    }, [purchases, filters.year]);

    const filteredPurchases = useMemo(() => {
        return purchases.filter(p => {
            if (p._deleted) return false;
            const d = new Date(p.date);
            const matchYear = d.getFullYear() === filters.year;
            const matchMonth = filters.month === 0 || (d.getMonth() + 1) === filters.month;
            const matchStatus = filters.status === 'Todos' || p.status === filters.status;
            const matchSearch = filters.search ? (
                p.supplierName.toLowerCase().includes(filters.search.toLowerCase()) || 
                p.referenceDocument?.toLowerCase().includes(filters.search.toLowerCase()) ||
                p.id.toLowerCase().includes(filters.search.toLowerCase())
            ) : true;
            const matchValue = valueSearch ? String(p.total).includes(valueSearch) : true;

            return matchYear && matchMonth && matchStatus && matchSearch && matchValue;
        }).sort((a, b) => b.date.localeCompare(a.date));
    }, [purchases, filters, valueSearch]);

    const reportData = useMemo(() => {
        return purchases.filter(p => {
            if (p._deleted) return false;
            const d = new Date(p.date);
            const matchYear = d.getFullYear() === reportFilters.year;
            const matchMonth = reportFilters.month === 0 || (d.getMonth() + 1) === reportFilters.month;
            const matchSupplier = reportFilters.supplierId ? String(p.supplierId) === String(reportFilters.supplierId) : true;
            
            let matchStatus = true;
            if (reportFilters.status === 'Pendente') matchStatus = p.status === 'Aberta';
            if (reportFilters.status === 'Pago') matchStatus = p.status === 'Paga';

            return matchYear && matchMonth && matchSupplier && matchStatus;
        }).sort((a,b) => b.date.localeCompare(a.date));
    }, [purchases, reportFilters]);

    // --- HANDLERS ---
    const handleNewPurchase = () => {
        setCurrentPurchase({
            date: new Date().toISOString().split('T')[0],
            status: 'Rascunho',
            items: [],
            total: 0
        });
        setIsModalOpen(true);
    };

    const handleEditPurchase = (p: Purchase) => {
        setCurrentPurchase(p);
        setIsModalOpen(true);
    };

    const handleQuickAddSupplier = (client: Partial<Client>) => {
        const newSupplier = { ...client, id: Date.now(), entityType: 'Fornecedor', active: true, history: [] } as Client;
        setClients(prev => [...prev, newSupplier]);
        if (isModalOpen) {
            setCurrentPurchase(prev => ({ ...prev, supplierId: newSupplier.id, supplierName: newSupplier.company }));
        } else if (isRecurringModalOpen) {
            setCurrentRecurring(prev => ({ ...prev, supplierId: newSupplier.id, supplierName: newSupplier.company }));
        }
        setIsEntityModalOpen(false);
        notify('success', 'Fornecedor criado.');
    };

    const handleAddPurchaseItem = () => {
        const m = materials.find(x => x.id === Number(selectedMatId));
        if (!m) return;
        const total = unitPrice * qty;
        
        setCurrentPurchase(prev => {
            const items = [...(prev.items || []), {
                id: Date.now(),
                description: m.name,
                itemCode: m.internalCode,
                quantity: qty,
                unitPrice: unitPrice,
                total: total,
                taxRate: 0
            }];
            return { ...prev, items, total: items.reduce((acc, i) => acc + i.total, 0) };
        });
        setSelectedMatId(''); setQty(1); setUnitPrice(0);
    };

    const handleRemoveItem = (id: number | string) => {
        setCurrentPurchase(prev => {
            const items = prev.items?.filter(i => i.id !== id) || [];
            return { ...prev, items, total: items.reduce((acc, i) => acc + i.total, 0) };
        });
    };

    const handleSavePurchase = () => {
        if (!currentPurchase.supplierId || !currentPurchase.date) return notify('error', 'Fornecedor e Data obrigatórios.');
        
        const purchase = {
            ...currentPurchase,
            id: currentPurchase.id || db.purchases.getNextId(new Date().getFullYear()),
            status: 'Aberta', // Default to debt
            updatedAt: new Date().toISOString()
        } as Purchase;

        if (currentPurchase.id) {
            setPurchases(prev => prev.map(p => p.id === purchase.id ? purchase : p));
            notify('success', 'Compra atualizada.');
        } else {
            setPurchases(prev => [purchase, ...prev]);
            notify('success', 'Compra registada.');
        }
        setIsModalOpen(false);
    };

    const handleFinalize = () => {
        // Same as save but maybe trigger stock entry?
        if (!currentPurchase.items?.length) return notify('error', 'Adicione itens.');
        
        // Stock Entry Logic
        const newMovements: StockMovement[] = [];
        let updatedMaterials = [...materials];

        currentPurchase.items.forEach(item => {
            const matIndex = updatedMaterials.findIndex(m => m.internalCode === item.itemCode || m.name === item.description);
            if (matIndex >= 0) {
                const mat = updatedMaterials[matIndex];
                if (mat.type === 'Material') {
                    const res = stockService.processMovement(
                        mat, 
                        item.quantity, 
                        'ENTRADA', 
                        `Compra ${currentPurchase.referenceDocument || 'N/A'}`, 
                        'Sistema', 
                        currentPurchase.id || 'NOVA', 
                        item.unitPrice
                    );
                    if (res.updatedMaterial) updatedMaterials[matIndex] = res.updatedMaterial;
                    if (res.movement) newMovements.push(res.movement);
                }
            }
        });

        setMaterials(updatedMaterials);
        setStockMovements(prev => [...newMovements, ...prev]);
        handleSavePurchase(); // Save the purchase record
        notify('success', 'Stock atualizado com entradas.');
    };

    const openPaymentModal = (p: Purchase) => {
        setSelectedPurchaseForPayment(p);
        setIsPayModalOpen(true);
    };

    const handleConfirmPayment = (p: Purchase, method: string, date: string, desc: string, cat: string) => {
        // Mark as paid
        setPurchases(prev => prev.map(x => x.id === p.id ? { ...x, status: 'Paga' } : x));
        
        // Create Transaction
        const tx: any = {
            id: Date.now(),
            date: date,
            description: desc,
            reference: p.referenceDocument || p.id,
            type: method,
            category: cat,
            income: null,
            expense: p.total,
            status: 'Pago',
            purchaseId: p.id
        };
        setTransactions(prev => [tx, ...prev]);
        
        setIsPayModalOpen(false);
        notify('success', 'Pagamento registado na tesouraria.');
    };

    const handleVoid = (p: Purchase) => {
        setPurchases(prev => prev.map(x => x.id === p.id ? { ...x, status: 'Anulada' } : x));
        notify('info', 'Compra anulada.');
    };

    const handleAddRecurringItem = () => {
        const m = materials.find(x => x.id === Number(selectedMatId));
        if (!m) return;
        const total = unitPrice * qty;
        
        setCurrentRecurring(prev => {
            const items = [...(prev.items || []), {
                id: Date.now(),
                description: m.name,
                itemCode: m.internalCode,
                quantity: qty,
                unitPrice: unitPrice,
                total: total,
                taxRate: 0
            }];
            return { ...prev, items, amount: items.reduce((acc, i) => acc + i.total, 0) };
        });
        setSelectedMatId(''); setQty(1); setUnitPrice(0);
    };

    const handleSaveRecurring = () => {
        if (!currentRecurring.supplierId) return notify('error', 'Fornecedor obrigatório.');
        
        const rec = {
            ...currentRecurring,
            id: currentRecurring.id || `REC-${Date.now()}`,
            updatedAt: new Date().toISOString()
        } as RecurringPurchase;

        if (currentRecurring.id) {
            setRecurringPurchases(prev => prev.map(r => r.id === rec.id ? rec : r));
        } else {
            setRecurringPurchases(prev => [...prev, rec]);
        }
        setIsRecurringModalOpen(false);
        notify('success', 'Avença guardada.');
    };

    const prepareRecurringProcessing = () => {
        const today = new Date().toISOString().split('T')[0];
        const due = recurringPurchases.filter(r => r.active && r.nextRun <= today);
        if (due.length === 0) return notify('info', 'Nenhuma avença a vencer.');

        const batch = due.map(r => ({
            id: r.id,
            supplierName: r.supplierName,
            description: r.description,
            originalAmount: r.amount,
            processAmount: r.amount,
            referenceDoc: '',
            originalRec: r
        }));
        setPendingBatch(batch);
        setIsBatchModalOpen(true);
    };

    const executeRecurringProcessing = () => {
        const newPurchases: Purchase[] = [];
        const updatedRecurring: RecurringPurchase[] = [];

        pendingBatch.forEach(item => {
            // Create Purchase
            newPurchases.push({
                id: db.purchases.getNextId(new Date().getFullYear()), // In loop, unsafe for async real DB, ok for memory
                supplierId: item.originalRec.supplierId,
                supplierName: item.originalRec.supplierName,
                date: new Date().toISOString().split('T')[0],
                dueDate: new Date().toISOString().split('T')[0],
                referenceDocument: item.referenceDoc,
                status: 'Aberta',
                total: item.processAmount,
                subtotal: item.processAmount,
                taxTotal: 0,
                items: item.originalRec.items,
                categoryId: item.originalRec.categoryId,
                notes: `Gerado de Avença ${item.originalRec.description}`
            });

            // Update Next Run
            const nextDate = new Date(item.originalRec.nextRun);
            if (item.originalRec.frequency === 'Mensal') nextDate.setMonth(nextDate.getMonth() + 1);
            else if (item.originalRec.frequency === 'Trimestral') nextDate.setMonth(nextDate.getMonth() + 3);
            else if (item.originalRec.frequency === 'Semestral') nextDate.setMonth(nextDate.getMonth() + 6);
            else nextDate.setFullYear(nextDate.getFullYear() + 1);

            updatedRecurring.push({
                ...item.originalRec,
                nextRun: nextDate.toISOString().split('T')[0]
            });
        });

        setPurchases(prev => [...newPurchases, ...prev]);
        setRecurringPurchases(prev => prev.map(r => {
            const updated = updatedRecurring.find(u => u.id === r.id);
            return updated || r;
        }));
        
        setIsBatchModalOpen(false);
        notify('success', `${newPurchases.length} compras geradas.`);
    };

    const handleSmartMatchConfirm = (purchase: Purchase, bankTx: BankTransaction) => {
        // Mark Purchase as Paid
        setPurchases(prev => prev.map(p => p.id === purchase.id ? { ...p, status: 'Paga' } : p));
        
        // Mark Bank as Reconciled
        setBankTransactions(prev => prev.map(b => b.id === bankTx.id ? { ...b, reconciled: true } : b));

        // Create Transaction
        const tx: any = {
            id: Date.now(),
            date: bankTx.date,
            description: `Pagamento Automático ${purchase.supplierName}`,
            reference: bankTx.id,
            type: 'Transferência',
            category: 'Custo Direto',
            income: null,
            expense: Math.abs(Number(bankTx.amount)),
            status: 'Pago',
            isReconciled: true,
            purchaseId: purchase.id
        };
        setTransactions(prev => [tx, ...prev]);
        notify('success', 'Conciliação automática realizada.');
    };

    // Options
    const supplierOptions = suppliers.filter(s => s.entityType !== 'Cliente').map(s => ({ label: s.company, value: s.id, subLabel: s.nif }));
    const materialOptions = materials.map(m => ({ label: m.name, value: m.id, subLabel: `${m.price} CVE` }));
    const categoryOptions = categories.filter(c => c.type !== 'Receita Operacional').map(c => ({ label: c.name, value: c.id, subLabel: c.code }));

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header / Submenu */}
            <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={handleNewPurchase} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-700 shadow-lg shadow-red-100">
                        <Plus size={16}/> Lançar Compra
                    </button>
                    <div className="flex bg-gray-100 p-1 rounded-lg border">
                        <button onClick={() => setSubView('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'dashboard' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><LayoutDashboard size={16} /> Dash</button>
                        <button onClick={() => setSubView('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'list' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><List size={16} /> Documentos</button>
                        <button onClick={() => setSubView('recurring')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'recurring' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><Repeat size={16} /> Recorrentes</button>
                        <button onClick={() => setSubView('reports')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'reports' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><FileBarChart size={16} /> Relatórios</button>
                    </div>
                </div>
            </div>

            {/* DASHBOARD */}
            {subView === 'dashboard' && (
                <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto pr-2">
                    {/* ... Dashboard Content ... */}
                    <div className="flex justify-end gap-2">
                        <select className="border rounded px-2 py-1 text-sm bg-white" value={filters.month} onChange={e => setFilters({...filters, month: Number(e.target.value)})}>
                            <option value={0}>Todos os Meses</option>
                            {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('pt-PT', {month: 'long'})}</option>)}
                        </select>
                        <select className="border rounded px-2 py-1 text-sm bg-white" value={filters.year} onChange={e => setFilters({...filters, year: Number(e.target.value)})}>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Compras</div>
                            <div className="text-2xl font-black text-gray-900">{dashboardStats.totalPayable.toLocaleString()} CVE</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 border-l-4 border-l-red-500">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Dívida Corrente</div>
                            <div className="text-2xl font-black text-red-600">{dashboardStats.totalDebt.toLocaleString()} CVE</div>
                        </div>
                        {/* Top Suppliers */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 md:col-span-2">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Top Fornecedores</div>
                            <div className="space-y-2">
                                {dashboardStats.topSuppliers.map((s, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="font-bold text-gray-700">{s.name}</span>
                                        <span className="font-mono">{s.val.toLocaleString()} CVE</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[300px]">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><FileBarChart size={18}/> Evolução de Despesas</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={dashboardStats.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                                <Tooltip cursor={{fill: '#f9fafb'}} />
                                <Bar dataKey="total" fill="#ef4444" name="Total Compras" radius={[4, 4, 0, 0]} barSize={30} />
                                <Bar dataKey="divida" fill="#f87171" name="Em Dívida" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* DOCUMENT LIST */}
            {subView === 'list' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up flex flex-col flex-1">
                    {/* ... Toolbar e Tabela com flex-1 overflow-auto mantidos ... */}
                    <div className="p-4 border-b flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between shrink-0 bg-gray-50/50">
                        <div className="flex flex-wrap gap-2 items-center flex-1 w-full xl:w-auto">
                            <div className="relative flex-1 min-w-[200px]">
                                <input type="text" placeholder="Ref. Fornecedor, Nome, Código..." className="pl-9 pr-3 py-2 border rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-red-500 bg-white" value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})}/>
                                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                            </div>
                            <div className="relative w-32">
                                <input type="text" placeholder="Valor..." className="pl-8 pr-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none w-full bg-white" value={valueSearch} onChange={e => setValueSearch(e.target.value)} />
                                <DollarSign size={14} className="absolute left-3 top-3 text-gray-400" />
                            </div>
                            <select className="border rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-red-500" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                                <option value="Todos">Todos os Estados</option><option value="Aberta">Em Dívida</option><option value="Paga">Paga</option><option value="Rascunho">Rascunho</option>
                            </select>
                            <div className="flex items-center gap-1 border-l pl-2 ml-1">
                                <select className="border rounded-xl px-2 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-red-500" value={filters.month} onChange={e => setFilters({...filters, month: Number(e.target.value)})}>
                                    <option value={0}>Todos</option>
                                    {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('pt-PT', {month: 'short'})}</option>)}
                                </select>
                                <select className="border rounded-xl px-2 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-red-500" value={filters.year} onChange={e => setFilters({...filters, year: Number(e.target.value)})}>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full xl:w-auto justify-end">
                            <button onClick={importHook.openModal} className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all text-xs uppercase tracking-widest shadow-sm"><Upload size={16} /> Importar</button>
                            <button onClick={() => setIsSmartMatchOpen(true)} className="bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-100 transition-all text-xs uppercase tracking-widest shadow-sm"><Wand2 size={16} /> Conciliar</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto pb-10">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] sticky top-0 z-10 border-b">
                                <tr>
                                    <th className="px-3 py-2 text-left">Ref. Fornecedor</th>
                                    <th className="px-3 py-2 text-left">Interno</th>
                                    <th className="px-3 py-2 text-left">Data</th>
                                    <th className="px-3 py-2 text-left">Fornecedor</th>
                                    <th className="px-3 py-2 text-left">Categoria</th>
                                    <th className="px-3 py-2 text-right">Valor</th>
                                    <th className="px-3 py-2 text-center">Estado</th>
                                    <th className="px-3 py-2 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPurchases.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 group transition-colors cursor-pointer" onClick={() => handleEditPurchase(p)}>
                                        <td className="px-3 py-2 font-bold text-gray-800 text-sm">
                                            {p.referenceDocument || <span className="text-gray-400 italic font-normal">S/ Ref</span>}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-[10px] text-gray-400">{p.id}</td>
                                        <td className="px-3 py-2 text-gray-600 text-xs">{new Date(p.date).toLocaleDateString()}</td>
                                        <td className="px-3 py-2 font-medium text-gray-700 text-xs truncate max-w-[150px]">{p.supplierName}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-[150px]">{categories.find(c => c.id === p.categoryId)?.name || '-'}</td>
                                        <td className="px-3 py-2 text-right font-black text-sm text-red-600">{p.total.toLocaleString()} CVE</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${
                                                p.status === 'Paga' ? 'bg-green-100 text-green-700' :
                                                p.status === 'Aberta' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                                            }`}>{p.status === 'Aberta' ? 'Em Dívida' : p.status}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {p.status === 'Aberta' && (
                                                    <button onClick={(e) => { e.stopPropagation(); openPaymentModal(p); }} className="text-green-600 bg-green-50 px-3 py-1 rounded font-bold text-[10px] uppercase hover:bg-green-100">Pagar</button>
                                                )}
                                                {(p.status === 'Aberta' || p.status === 'Paga') && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleVoid(p); }} className="text-red-400 hover:text-red-600 p-1 rounded" title="Anular"><Ban size={16}/></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* RECURRING TABLE VIEW */}
            {subView === 'recurring' && (
                <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto flex flex-col">
                    {/* ... Recurring Content ... */}
                    <div className="flex justify-between items-center bg-red-50 p-4 rounded-xl border border-red-100 shrink-0">
                        <div><h3 className="text-red-900 font-bold">Pagamentos Recorrentes</h3><p className="text-xs text-red-700">Rendas, Subscrições, Avenças de Serviços.</p></div>
                        <div className="flex gap-2">
                            <button onClick={prepareRecurringProcessing} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-red-700 transition-colors shadow-lg"><Play size={14}/> Processar Agora</button>
                            <button onClick={() => { setCurrentRecurring({frequency: 'Mensal', active: true, items: [], nextRun: new Date().toISOString().split('T')[0]}); setIsRecurringModalOpen(true); }} className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-red-50 transition-colors"><Plus size={14}/> Nova Avença</button>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                        <div className="flex-1 overflow-auto pb-10">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] sticky top-0 z-10 border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Fornecedor</th>
                                        <th className="px-3 py-2 text-left">Descrição</th>
                                        <th className="px-3 py-2 text-center">Frequência</th>
                                        <th className="px-3 py-2 text-center">Próxima Execução</th>
                                        <th className="px-3 py-2 text-right">Valor Previsto</th>
                                        <th className="px-3 py-2 text-center">Estado</th>
                                        <th className="px-3 py-2 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {recurringPurchases.map(rec => (
                                        <tr key={rec.id} className="hover:bg-gray-50 group transition-colors">
                                            <td className="px-3 py-2 font-bold text-gray-800 text-sm">{rec.supplierName}</td>
                                            <td className="px-3 py-2 text-gray-600 text-xs">{rec.description || '-'}</td>
                                            <td className="px-3 py-2 text-center">
                                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase">{rec.frequency}</span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`font-bold flex items-center justify-center gap-1 text-xs ${new Date(rec.nextRun) <= new Date() ? 'text-red-600' : 'text-gray-700'}`}>
                                                    <Hash size={10}/> {new Date(rec.nextRun).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-gray-700 text-sm">
                                                {rec.amount.toLocaleString()} CVE
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${rec.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {rec.active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <button onClick={() => { setCurrentRecurring(rec); setIsRecurringModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Editar">
                                                    <Edit2 size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {recurringPurchases.length === 0 && (
                                        <tr><td colSpan={7} className="p-8 text-center text-gray-400 italic text-sm">Nenhuma avença configurada.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* REPORTS */}
            {subView === 'reports' && (
                <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto flex flex-col">
                    {/* ... Reports Content ... */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm shrink-0">
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Filter size={16}/> Filtros do Relatório</h3>
                        <div className="flex flex-wrap gap-3 items-end">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Fornecedor</label>
                                <select 
                                    className="w-full border rounded-xl p-2.5 text-sm bg-white font-medium outline-none focus:ring-2 focus:ring-green-500" 
                                    value={reportFilters.supplierId} 
                                    onChange={(e) => setReportFilters({...reportFilters, supplierId: e.target.value})}
                                >
                                    <option value="">Todos os Fornecedores</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
                                </select>
                            </div>
                            <div className="w-32">
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Ano</label>
                                <select 
                                    className="w-full border rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500" 
                                    value={reportFilters.year} 
                                    onChange={e => setReportFilters({...reportFilters, year: Number(e.target.value)})}
                                >
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
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
                                    onClick={() => {
                                        if(!reportFilters.supplierId) return notify('error', 'Selecione um fornecedor para o extrato.');
                                        const supplier = suppliers.find(s => s.id === Number(reportFilters.supplierId));
                                        if(supplier) {
                                            printService.printSupplierStatement(reportData, supplier, `${reportFilters.year}`, settings);
                                        }
                                    }}
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
                                Total: <span className="text-gray-900 font-bold">{reportData.reduce((acc, p) => acc + p.total, 0).toLocaleString()} CVE</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="min-w-full text-xs">
                                <thead className="bg-gray-100 text-gray-500 font-bold uppercase sticky top-0">
                                    <tr>
                                        <th className="p-3 text-left w-24">Data</th>
                                        <th className="p-3 text-left">Documento</th>
                                        <th className="p-3 text-left">Fornecedor</th>
                                        <th className="p-3 text-right">Valor</th>
                                        <th className="p-3 text-center w-24">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reportData.map(doc => (
                                        <tr key={doc.id} className="hover:bg-gray-50">
                                            <td className="p-3 text-gray-600">{new Date(doc.date).toLocaleDateString('pt-PT')}</td>
                                            <td className="p-3 font-medium text-gray-800">{doc.id}</td>
                                            <td className="p-3 text-gray-600">{doc.supplierName}</td>
                                            <td className="p-3 text-right font-mono font-bold text-red-600">
                                                {doc.total.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                    doc.status === 'Paga' ? 'bg-green-100 text-green-700' : 
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    {doc.status === 'Aberta' ? 'Dívida' : doc.status}
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

            {/* Modals mantidas */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lançar Compra / Despesa">
                {/* ... Form Content Purchase ... */}
                <div className="flex flex-col h-[80vh]">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fornecedor</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <SearchableSelect 
                                        options={supplierOptions} 
                                        value={currentPurchase.supplierId || ''} 
                                        onChange={(val) => { const s = suppliers.find(x => x.id === Number(val)); setCurrentPurchase({...currentPurchase, supplierId: Number(val), supplierName: s?.company, supplierNif: s?.nif}); }} 
                                    />
                                </div>
                                <button onClick={() => setIsEntityModalOpen(true)} className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:text-green-600 hover:bg-green-50 transition-colors" title="Novo Fornecedor">
                                    <Plus size={20}/>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Hash size={12}/> Nº Fatura / Ref. Fornecedor</label>
                            <input 
                                type="text" 
                                className="w-full border rounded-lg p-2 font-bold text-gray-800" 
                                value={currentPurchase.referenceDocument || ''} 
                                onChange={e => setCurrentPurchase({...currentPurchase, referenceDocument: e.target.value})}
                                placeholder="Ex: FT 2024/123"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Doc.</label>
                            <input type="date" className="w-full border rounded-lg p-2" value={currentPurchase.date} onChange={e => setCurrentPurchase({...currentPurchase, date: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria Financeira</label>
                            <SearchableSelect 
                                options={categoryOptions} 
                                value={currentPurchase.categoryId || ''} 
                                onChange={(val) => setCurrentPurchase({...currentPurchase, categoryId: val})}
                                placeholder="Selecione a conta de custo..."
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded-xl border mb-4">
                        <div className="flex gap-2 items-end mb-4">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase">Item</label>
                                <SearchableSelect options={materialOptions} value={selectedMatId} onChange={setSelectedMatId} />
                            </div>
                            <div className="w-24">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase">Qtd</label>
                                <input type="number" className="w-full border rounded-lg p-2" value={qty} onChange={e => setQty(Number(e.target.value))}/>
                            </div>
                            <div className="w-28">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase">Custo Unit.</label>
                                <input type="number" className="w-full border rounded-lg p-2 text-right" value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))}/>
                            </div>
                            <button onClick={handleAddPurchaseItem} className="bg-blue-600 text-white p-2 rounded-lg"><Plus size={20}/></button>
                        </div>
                        <table className="w-full text-xs">
                            <thead><tr><th className="text-left">Item</th><th className="text-right">Qtd</th><th className="text-right">Total</th><th></th></tr></thead>
                            <tbody>
                                {currentPurchase.items?.map(item => (
                                    <tr key={item.id} className="border-b last:border-0">
                                        <td className="py-2">{item.description}</td>
                                        <td className="text-right">{item.quantity}</td>
                                        <td className="text-right font-bold">{item.total.toLocaleString()}</td>
                                        <td className="text-right"><button onClick={() => handleRemoveItem(item.id)} className="text-red-500">X</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-xl font-black text-gray-800">Total: {currentPurchase.total?.toLocaleString()} CVE</div>
                        <div className="flex gap-2">
                            {currentPurchase.status === 'Rascunho' && (
                                <>
                                    <button onClick={handleSavePurchase} className="px-4 py-2 border rounded-lg font-bold text-gray-600">Guardar Rascunho</button>
                                    <button onClick={handleFinalize} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold">Lançar & Stock</button>
                                </>
                            )}
                            {currentPurchase.status === 'Aberta' && (
                                <button onClick={handleSavePurchase} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md flex items-center gap-2">
                                    <Edit2 size={16}/> Atualizar Dados
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Outras modais mantidas (Recurring, Batch, Import, SmartMatch) */}
            <Modal isOpen={isRecurringModalOpen} onClose={() => setIsRecurringModalOpen(false)} title="Configurar Pagamento Recorrente">
                <div className="flex flex-col h-[80vh]">
                    {/* ... Form Content Recurring ... */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fornecedor</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <SearchableSelect 
                                        options={supplierOptions} 
                                        value={currentRecurring.supplierId || ''} 
                                        onChange={(val) => { const s = suppliers.find(x => x.id === Number(val)); setCurrentRecurring({...currentRecurring, supplierId: Number(val), supplierName: s?.company}); }} 
                                    />
                                </div>
                                <button onClick={() => setIsEntityModalOpen(true)} className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:text-green-600 hover:bg-green-50 transition-colors" title="Novo Fornecedor">
                                    <Plus size={20}/>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Frequência</label>
                            <select className="w-full border rounded-lg p-2" value={currentRecurring.frequency} onChange={e => setCurrentRecurring({...currentRecurring, frequency: e.target.value as any})}>
                                <option>Mensal</option><option>Trimestral</option><option>Semestral</option><option>Anual</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Próxima Execução</label>
                            <input type="date" className="w-full border rounded-lg p-2" value={currentRecurring.nextRun} onChange={e => setCurrentRecurring({...currentRecurring, nextRun: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                            <input type="text" className="w-full border rounded-lg p-2" placeholder="Ex: Renda Escritório" value={currentRecurring.description || ''} onChange={e => setCurrentRecurring({...currentRecurring, description: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria Financeira</label>
                            <SearchableSelect 
                                options={categoryOptions} 
                                value={currentRecurring.categoryId || ''} 
                                onChange={(val) => setCurrentRecurring({...currentRecurring, categoryId: val})}
                            />
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-sm"><input type="checkbox" checked={currentRecurring.active} onChange={e => setCurrentRecurring({...currentRecurring, active: e.target.checked})} className="w-5 h-5 text-red-600"/> Avença Ativa</label>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded-xl border mb-4">
                        <div className="flex gap-2 items-end mb-4">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase">Item (Gera valor base)</label>
                                <SearchableSelect options={materialOptions} value={selectedMatId} onChange={setSelectedMatId} />
                            </div>
                            <div className="w-24">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase">Qtd</label>
                                <input type="number" className="w-full border rounded-lg p-2" value={qty} onChange={e => setQty(Number(e.target.value))}/>
                            </div>
                            <div className="w-28">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase">Valor</label>
                                <input type="number" className="w-full border rounded-lg p-2 text-right" value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))}/>
                            </div>
                            <button onClick={handleAddRecurringItem} className="bg-purple-600 text-white p-2 rounded-lg"><Plus size={20}/></button>
                        </div>
                        <table className="w-full text-xs">
                            <thead><tr><th className="text-left">Item</th><th className="text-right">Total</th></tr></thead>
                            <tbody>
                                {currentRecurring.items?.map(item => (
                                    <tr key={item.id} className="border-b last:border-0">
                                        <td className="py-2">{item.description}</td>
                                        <td className="text-right font-bold">{item.total.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="pt-4 border-t flex justify-end gap-3">
                        <button onClick={() => setIsRecurringModalOpen(false)} className="px-4 py-2 border rounded-lg font-bold text-gray-500">Cancelar</button>
                        <button onClick={handleSaveRecurring} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold">Guardar Avença</button>
                    </div>
                </div>
            </Modal>

            {/* MODAL BATCH, IMPORT, SMART MATCH */}
            <Modal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} title="Processar Avenças a Vencer">
                <div className="flex flex-col h-[70vh]">
                    <div className="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-100 flex items-start gap-3">
                        <Wand2 className="text-blue-600 mt-1" size={20}/>
                        <div className="text-sm text-blue-900">
                            <p className="font-bold">Confirme os valores e faturas</p>
                            <p>Pode ajustar o valor a pagar e inserir o nº da fatura para cada fornecedor.</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-xl">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100 sticky top-0 text-gray-500 font-bold uppercase text-xs">
                                <tr>
                                    <th className="p-3 text-left">Fornecedor</th>
                                    <th className="p-3 text-left">Descrição</th>
                                    <th className="p-3 text-right">Valor Original</th>
                                    <th className="p-3 text-left w-32">Nº Fatura</th>
                                    <th className="p-3 text-right w-32">Valor a Pagar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pendingBatch.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="p-3 font-bold text-gray-700">{item.supplierName}</td>
                                        <td className="p-3 text-gray-500">{item.description}</td>
                                        <td className="p-3 text-right font-mono text-gray-400">{item.originalAmount.toLocaleString()}</td>
                                        <td className="p-3">
                                            <input 
                                                type="text" 
                                                className="w-full border rounded-lg p-1.5 text-xs"
                                                placeholder="FT..."
                                                value={item.referenceDoc}
                                                onChange={(e) => {
                                                    setPendingBatch(prev => prev.map((x, i) => i === idx ? { ...x, referenceDoc: e.target.value } : x));
                                                }}
                                            />
                                        </td>
                                        <td className="p-3 text-right">
                                            <input 
                                                type="number" 
                                                className="w-full border rounded-lg p-1.5 text-right font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none"
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
                        <button onClick={() => setIsBatchModalOpen(false)} className="px-4 py-2 border rounded-lg font-bold text-gray-500">Cancelar</button>
                        <button onClick={executeRecurringProcessing} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold flex items-center gap-2">
                            <Check size={18}/> Confirmar e Gerar
                        </button>
                    </div>
                </div>
            </Modal>

            <PurchaseImportModal 
                isOpen={importHook.isModalOpen}
                onClose={() => importHook.setIsModalOpen(false)}
                isLoading={importHook.isLoading}
                result={importHook.result}
                onConfirm={importHook.confirmImport}
                onFileSelect={importHook.handleFileSelect}
                fileInputRef={importHook.fileInputRef}
            />

            <SmartPurchaseMatchModal
                isOpen={isSmartMatchOpen}
                onClose={() => setIsSmartMatchOpen(false)}
                purchases={purchases}
                bankTransactions={bankTransactions}
                settings={settings}
                onMatch={handleSmartMatchConfirm}
            />

            <PurchasePaymentModal
                isOpen={isPayModalOpen}
                onClose={() => setIsPayModalOpen(false)}
                purchase={selectedPurchaseForPayment}
                settings={settings}
                categories={categories}
                onConfirm={handleConfirmPayment}
            />

            <ClientFormModal
                isOpen={isEntityModalOpen}
                onClose={() => setIsEntityModalOpen(false)}
                client={{ entityType: 'Fornecedor', type: 'Empresarial' } as any}
                onSave={handleQuickAddSupplier}
            />
        </div>
    );
};
