
import React, { useState, useMemo, useEffect } from 'react';
import { Purchase, Client, Material, SystemSettings, RecurringPurchase, BankTransaction, StockMovement, Account, PurchaseStatus } from '../types';
import { usePurchaseImport } from '../purchasing/hooks/usePurchaseImport';
import { 
    Plus, LayoutDashboard, FileText, Repeat, Upload, Wand2, Search, DollarSign, 
    ArrowUp, ArrowDown, BarChart4, Filter, Edit2, Trash2, Calendar, ShoppingBag, Truck,
    AlertTriangle, CheckCircle2, Play
} from 'lucide-react';
import { 
    BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, ResponsiveContainer 
} from 'recharts';
import { currency } from '../utils/currency';
import { printService } from '../services/printService';
import { PurchaseImportModal } from '../purchasing/components/PurchaseImportModal';
import { SmartPurchaseMatchModal } from '../purchasing/components/SmartPurchaseMatchModal';
import { PurchasePaymentModal } from '../purchasing/components/PurchasePaymentModal';
import Modal from './Modal';
import { db } from '../services/db';
import { stockService } from '../services/stockService';
import { SearchableSelect } from './SearchableSelect';
import { useNotification } from '../contexts/NotificationContext';
import { useConfirmation } from '../contexts/ConfirmationContext';

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
    suppliers, setClients, materials, setMaterials, settings, purchases, setPurchases,
    setTransactions, setStockMovements, recurringPurchases, setRecurringPurchases,
    categories, bankTransactions, setBankTransactions
}) => {
    const { notify } = useNotification();
    const { requestConfirmation } = useConfirmation();

    // View State
    const [subView, setSubView] = useState<'dashboard' | 'list' | 'recurring'>('dashboard');
    
    // Filters
    const [filters, setFilters] = useState(() => db.filters.getPurchasing());
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        db.filters.savePurchasing({ ...filters, status: statusFilter });
    }, [filters, statusFilter]);

    // Modals
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isSmartMatchOpen, setIsSmartMatchOpen] = useState(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    
    // Editing States
    const [currentPurchase, setCurrentPurchase] = useState<Partial<Purchase>>({});
    const [currentRecurring, setCurrentRecurring] = useState<Partial<RecurringPurchase>>({});
    const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<Purchase | null>(null);

    // Form Aux State
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [selectedMaterialId, setSelectedMaterialId] = useState('');
    const [qty, setQty] = useState(1);
    const [costPrice, setCostPrice] = useState(0);

    // Import Hook
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
        
        const totalPurchased = yearPurchases.filter(p => p.status !== 'Anulada' && p.status !== 'Rascunho').reduce((acc, p) => currency.add(acc, p.total), 0);
        const pendingValue = yearPurchases.filter(p => p.status === 'Aberta').reduce((acc, p) => currency.add(acc, p.total), 0);
        const paidValue = yearPurchases.filter(p => p.status === 'Paga').reduce((acc, p) => currency.add(acc, p.total), 0);

        const chartData = Array.from({length: 12}, (_, i) => {
            const m = i + 1;
            const monthPurs = yearPurchases.filter(p => new Date(p.date).getMonth() + 1 === m);
            return {
                name: new Date(0, i).toLocaleString('pt-PT', {month: 'short'}),
                comprado: monthPurs.filter(p => p.status !== 'Anulada' && p.status !== 'Rascunho').reduce((acc, p) => currency.add(acc, p.total), 0),
                pago: monthPurs.filter(p => p.status === 'Paga').reduce((acc, p) => currency.add(acc, p.total), 0)
            };
        });

        return { totalPurchased, pendingValue, paidValue, chartData };
    }, [purchases, filters.year]);

    const filteredPurchases = useMemo(() => {
        return purchases.filter(p => {
            const d = new Date(p.date);
            const matchYear = d.getFullYear() === filters.year;
            const matchMonth = filters.month === 0 || (d.getMonth() + 1) === filters.month;
            const matchStatus = statusFilter === 'Todos' || p.status === statusFilter;
            const matchSearch = searchTerm ? (
                p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.referenceDocument && p.referenceDocument.toLowerCase().includes(searchTerm.toLowerCase()))
            ) : true;

            return matchYear && matchMonth && matchStatus && matchSearch;
        }).sort((a,b) => b.date.localeCompare(a.date));
    }, [purchases, filters, statusFilter, searchTerm]);

    // --- HANDLERS ---

    const handleNewPurchase = () => {
        const year = new Date().getFullYear();
        const nextId = db.purchases.getNextId(year);
        setCurrentPurchase({
            id: nextId,
            date: new Date().toISOString().split('T')[0],
            dueDate: new Date().toISOString().split('T')[0],
            status: 'Rascunho',
            items: [],
            total: 0,
            subtotal: 0,
            taxTotal: 0
        });
        setIsPurchaseModalOpen(true);
    };

    const handleEditPurchase = (p: Purchase) => {
        setCurrentPurchase({ ...p });
        setSelectedSupplierId(p.supplierId.toString());
        setIsPurchaseModalOpen(true);
    };

    const handleDeletePurchase = (p: Purchase) => {
        requestConfirmation({
            title: "Anular Compra",
            message: "Tem a certeza? Se a compra já afetou stock, será necessário um ajuste manual.",
            variant: 'danger',
            confirmText: 'Anular',
            onConfirm: () => {
                setPurchases(prev => prev.map(x => x.id === p.id ? { ...x, status: 'Anulada' } : x));
                notify('success', 'Compra anulada.');
            }
        });
    };

    const handleAddItem = () => {
        if (!selectedMaterialId) return;
        const mat = materials.find(m => m.id === Number(selectedMaterialId));
        if (!mat) return;

        const itemTotal = currency.mul(costPrice, qty);
        const newItem = {
            id: Date.now(),
            description: mat.name,
            quantity: qty,
            unitPrice: costPrice,
            total: itemTotal,
            taxRate: 0,
            itemCode: mat.internalCode
        };

        const currentItems = currentPurchase.items || [];
        const newItems = [...currentItems, newItem];
        const newTotal = newItems.reduce((acc, i) => acc + i.total, 0);

        setCurrentPurchase(prev => ({
            ...prev,
            items: newItems,
            total: newTotal,
            subtotal: newTotal
        }));

        setQty(1);
        setCostPrice(0);
        setSelectedMaterialId('');
    };

    const handleRemoveItem = (id: number) => {
        const newItems = (currentPurchase.items || []).filter(i => i.id !== id);
        const newTotal = newItems.reduce((acc, i) => acc + i.total, 0);
        setCurrentPurchase(prev => ({ ...prev, items: newItems, total: newTotal, subtotal: newTotal }));
    };

    const handleSavePurchase = () => {
        if (!currentPurchase.supplierName || (currentPurchase.items || []).length === 0) {
            return notify('error', 'Fornecedor e Itens obrigatórios.');
        }

        const purchase = currentPurchase as Purchase;
        
        // Se estiver em modo edição
        if (purchases.some(p => p.id === purchase.id)) {
            setPurchases(prev => prev.map(p => p.id === purchase.id ? purchase : p));
            notify('success', 'Compra atualizada.');
        } else {
            setPurchases(prev => [purchase, ...prev]);
            notify('success', 'Compra registada.');
        }
        setIsPurchaseModalOpen(false);
    };

    const handleFinalize = () => {
        if (!currentPurchase.supplierName) return notify('error', 'Fornecedor obrigatório');
        
        const purchase = { ...currentPurchase, status: 'Aberta' as PurchaseStatus } as Purchase;
        
        // 1. Save Purchase
        if (purchases.some(p => p.id === purchase.id)) {
            setPurchases(prev => prev.map(p => p.id === purchase.id ? purchase : p));
        } else {
            setPurchases(prev => [purchase, ...prev]);
        }

        // 2. Process Stock Entry
        if (purchase.items && materials && setMaterials && setStockMovements) {
            let updatedMaterialsList = [...materials];
            let movements: StockMovement[] = [];

            purchase.items.forEach(item => {
                const matIndex = updatedMaterialsList.findIndex(m => 
                    (item.itemCode && m.internalCode === item.itemCode) || m.name === item.description
                );

                if (matIndex !== -1) {
                    const material = updatedMaterialsList[matIndex];
                    if (material.type === 'Material') {
                        const result = stockService.processMovement(
                            material,
                            item.quantity,
                            'ENTRADA',
                            `Compra ${purchase.id}`,
                            'Sistema (Compras)',
                            purchase.id,
                            item.unitPrice // Pass entry price for weighted average cost calculation
                        );

                        if (result.success && result.updatedMaterial && result.movement) {
                            updatedMaterialsList[matIndex] = result.updatedMaterial;
                            movements.push(result.movement);
                        }
                    }
                }
            });

            if (movements.length > 0) {
                setMaterials(updatedMaterialsList);
                setStockMovements(prev => [...movements, ...prev]);
                notify('info', `${movements.length} artigos entraram em stock.`);
            }
        }

        notify('success', 'Compra finalizada e lançada em conta corrente.');
        setIsPurchaseModalOpen(false);
    };

    // Payment Logic
    const handlePaymentConfirm = (purchase: Purchase, method: string, date: string, desc: string, categoryId: string) => {
        // Update Purchase Status
        setPurchases(prev => prev.map(p => p.id === purchase.id ? { ...p, status: 'Paga' } : p));

        // Create Transaction
        const tx: any = {
            id: Date.now(),
            date: date,
            description: desc,
            reference: purchase.referenceDocument || purchase.id,
            type: method,
            category: categoryId, // Should be Category Name technically, but passed ID for consistency with select
            income: null,
            expense: purchase.total,
            status: 'Pago',
            purchaseId: purchase.id
        };
        setTransactions(prev => [tx, ...prev]);
        setIsPaymentModalOpen(false);
        notify('success', 'Pagamento registado.');
    };

    const handleSmartMatchConfirm = (purchase: Purchase, bankTx: BankTransaction) => {
        setPurchases(prev => prev.map(p => p.id === purchase.id ? { ...p, status: 'Paga' } : p));
        setBankTransactions(prev => prev.map(b => b.id === bankTx.id ? { ...b, reconciled: true } : b));
        
        const tx: any = {
            id: Date.now(),
            date: bankTx.date,
            description: `Pagamento Compra ${purchase.id}`,
            reference: bankTx.id,
            type: 'Transferência',
            category: 'Pagamento Fornecedores',
            income: null,
            expense: Math.abs(Number(bankTx.amount)),
            status: 'Pago',
            isReconciled: true,
            purchaseId: purchase.id
        };
        setTransactions(prev => [tx, ...prev]);
        notify('success', 'Conciliação efetuada.');
    };

    // Recurring Logic
    const handleSaveRecurring = () => {
        if (!currentRecurring.supplierId || !currentRecurring.description) return notify('error', 'Preencha os dados.');
        
        const rec: RecurringPurchase = {
            ...currentRecurring as RecurringPurchase,
            id: currentRecurring.id || `REC-${Date.now()}`,
            active: currentRecurring.active ?? true
        };

        if (currentRecurring.id) {
            setRecurringPurchases(prev => prev.map(r => r.id === rec.id ? rec : r));
        } else {
            setRecurringPurchases(prev => [...prev, rec]);
        }
        setIsRecurringModalOpen(false);
        notify('success', 'Despesa recorrente guardada.');
    };

    const processRecurringNow = () => {
        const today = new Date().toISOString().split('T')[0];
        let count = 0;
        
        const newPurchases: Purchase[] = [];
        const updatedRecurring: RecurringPurchase[] = [];

        recurringPurchases.forEach(rec => {
            if (rec.active && rec.nextRun <= today) {
                // Generate Purchase
                const year = new Date().getFullYear();
                const nextId = db.purchases.getNextId(year);
                // Note: In rapid loop, IDs might conflict if not handled carefully. 
                // Simple workaround for demo: append loop index or random
                const uniqueId = `${nextId}-${Math.random().toString(36).substr(2, 4)}`;

                newPurchases.push({
                    id: uniqueId,
                    supplierId: rec.supplierId,
                    supplierName: rec.supplierName,
                    date: today,
                    dueDate: today,
                    status: 'Aberta',
                    categoryId: rec.categoryId,
                    referenceDocument: 'Avença Auto',
                    total: rec.amount,
                    subtotal: rec.amount,
                    taxTotal: 0,
                    items: rec.items || [{ id: Date.now(), description: rec.description, quantity: 1, unitPrice: rec.amount, total: rec.amount, taxRate: 0 }]
                });

                // Update Next Run
                const nextDate = new Date(rec.nextRun);
                if (rec.frequency === 'Mensal') nextDate.setMonth(nextDate.getMonth() + 1);
                else if (rec.frequency === 'Anual') nextDate.setFullYear(nextDate.getFullYear() + 1);
                else if (rec.frequency === 'Trimestral') nextDate.setMonth(nextDate.getMonth() + 3);
                else if (rec.frequency === 'Semestral') nextDate.setMonth(nextDate.getMonth() + 6);

                updatedRecurring.push({ ...rec, nextRun: nextDate.toISOString().split('T')[0] });
                count++;
            } else {
                updatedRecurring.push(rec);
            }
        });

        if (count > 0) {
            setPurchases(prev => [...newPurchases, ...prev]);
            setRecurringPurchases(updatedRecurring);
            notify('success', `${count} despesas geradas.`);
        } else {
            notify('info', 'Nenhuma despesa para processar hoje.');
        }
    };

    // Helper Options
    const supplierOptions = useMemo(() => suppliers.map(s => ({ label: s.company, value: s.id, subLabel: s.nif })), [suppliers]);
    const materialOptions = useMemo(() => materials.map(m => ({ label: m.name, value: m.id, subLabel: `${m.price} CVE` })), [materials]);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3 self-end md:self-auto">
                    <button onClick={handleNewPurchase} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center gap-2"><Plus size={16} /> Nova Compra</button>
                    <div className="flex bg-gray-100 p-1 rounded-lg border">
                        <button onClick={() => setSubView('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'dashboard' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><LayoutDashboard size={16} /> Dash</button>
                        <button onClick={() => setSubView('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'list' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><ShoppingBag size={16} /> Compras</button>
                        <button onClick={() => setSubView('recurring')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'recurring' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><Repeat size={16} /> Recorrentes</button>
                    </div>
                </div>
            </div>

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
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200"><div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Compras</div><div className="text-2xl font-black text-gray-900">{dashboardStats.totalPurchased.toLocaleString()} CVE</div></div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200"><div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Pendente Pagamento</div><div className="text-2xl font-black text-red-600">{dashboardStats.pendingValue.toLocaleString()} CVE</div></div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200"><div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Pago</div><div className="text-2xl font-black text-green-700">{dashboardStats.paidValue.toLocaleString()} CVE</div></div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[350px]">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><BarChart4 size={18}/> Evolução de Despesas ({filters.year})</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={dashboardStats.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                                <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
                                <Bar dataKey="comprado" fill="#ef4444" name="Comprado" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="pago" fill="#22c55e" name="Pago" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {subView === 'list' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up flex flex-col flex-1">
                    <div className="p-4 border-b flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between shrink-0 bg-gray-50/50">
                        <div className="flex flex-wrap gap-2 items-center flex-1 w-full xl:w-auto">
                            <div className="relative flex-1 min-w-[200px]"><input type="text" placeholder="Fornecedor, Ref..." className="pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none w-full bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /><Search size={16} className="absolute left-3 top-2.5 text-gray-400" /></div>
                            <select className="border rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-red-500" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="Todos">Todos</option><option value="Aberta">Em Dívida</option><option value="Paga">Paga</option><option value="Rascunho">Rascunho</option></select>
                        </div>
                        <div className="flex gap-2 w-full xl:w-auto justify-end">
                            <button onClick={importHook.openModal} className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all text-xs uppercase tracking-widest shadow-sm"><Upload size={16} /> Importar</button>
                            <button onClick={() => setIsSmartMatchOpen(true)} className="bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-100 transition-all text-xs uppercase tracking-widest shadow-sm"><Wand2 size={16} /> Conciliar</button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black sticky top-0 z-10 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left">Documento</th>
                                    <th className="px-6 py-4 text-left">Fornecedor</th>
                                    <th className="px-6 py-4 text-left">Data Emissão</th>
                                    <th className="px-6 py-4 text-left">Vencimento</th>
                                    <th className="px-6 py-4 text-right">Total</th>
                                    <th className="px-6 py-4 text-center">Estado</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPurchases.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800">{p.id}</div>
                                            <div className="text-xs text-gray-500">Ref: {p.referenceDocument || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-700">{p.supplierName}</td>
                                        <td className="px-6 py-4 text-gray-600">{new Date(p.date).toLocaleDateString()}</td>
                                        <td className={`px-6 py-4 font-medium ${p.status === 'Aberta' && new Date(p.dueDate) < new Date() ? 'text-red-600' : 'text-gray-600'}`}>
                                            {new Date(p.dueDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-gray-900">{p.total.toLocaleString()} CVE</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${p.status === 'Paga' ? 'bg-green-100 text-green-700' : p.status === 'Aberta' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{p.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEditPurchase(p)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg"><Edit2 size={16}/></button>
                                                {p.status === 'Aberta' && (
                                                    <button onClick={() => { setSelectedPurchaseForPayment(p); setIsPaymentModalOpen(true); }} className="text-green-600 hover:bg-green-50 p-2 rounded-lg" title="Pagar"><DollarSign size={16}/></button>
                                                )}
                                                <button onClick={() => handleDeletePurchase(p)} className="text-red-400 hover:bg-red-50 p-2 rounded-lg"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {subView === 'recurring' && (
                <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto">
                    <div className="flex justify-between items-center bg-red-50 p-4 rounded-xl border border-red-100">
                        <div>
                            <h3 className="text-red-900 font-bold">Despesas Recorrentes</h3>
                            <p className="text-xs text-red-700">Automatize rendas, serviços e avenças a pagar.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={processRecurringNow} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-red-700 transition-colors shadow-lg">
                                <Play size={14}/> Processar Vencimentos
                            </button>
                            <button onClick={() => { setCurrentRecurring({ active: true, frequency: 'Mensal', nextRun: new Date().toISOString().split('T')[0] }); setIsRecurringModalOpen(true); }} className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-red-50 transition-colors">
                                <Plus size={14}/> Nova Despesa
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recurringPurchases.map(r => (
                            <div key={r.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between hover:shadow-md transition-shadow">
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${r.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.active ? 'Ativo' : 'Inativo'}</span>
                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{r.frequency}</span>
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">{r.supplierName}</h3>
                                    <p className="text-xs text-gray-500 mb-4">{r.description}</p>
                                    <div className="text-right font-black text-xl text-red-600">{r.amount.toLocaleString()} CVE</div>
                                    <div className="mt-2 text-xs text-gray-400">Próxima: {new Date(r.nextRun).toLocaleDateString()}</div>
                                </div>
                                <div className="mt-4 pt-4 border-t flex justify-end">
                                    <button onClick={() => { setCurrentRecurring(r); setIsRecurringModalOpen(true); }} className="text-blue-600 text-xs font-bold uppercase hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">Editar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MODALS */}
            <Modal isOpen={isPurchaseModalOpen} onClose={() => setIsPurchaseModalOpen(false)} title={currentPurchase.id ? "Editar Compra" : "Nova Compra"}>
                <div className="flex flex-col max-h-[85vh]">
                    <div className="overflow-y-auto flex-1 pr-2 space-y-6">
                        {/* Header */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Fornecedor</label>
                                <SearchableSelect 
                                    options={supplierOptions}
                                    value={selectedSupplierId}
                                    onChange={(val) => {
                                        setSelectedSupplierId(val);
                                        const s = suppliers.find(su => su.id === Number(val));
                                        setCurrentPurchase(prev => ({ ...prev, supplierId: Number(val), supplierName: s?.company }));
                                    }}
                                    placeholder="Procurar Fornecedor..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Data Emissão</label>
                                    <input type="date" className="w-full border rounded-lg p-2.5 text-sm" value={currentPurchase.date} onChange={e => setCurrentPurchase({...currentPurchase, date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Vencimento</label>
                                    <input type="date" className="w-full border rounded-lg p-2.5 text-sm" value={currentPurchase.dueDate} onChange={e => setCurrentPurchase({...currentPurchase, dueDate: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Referência Externa (Fatura)</label>
                                <input type="text" className="w-full border rounded-lg p-2.5 text-sm" placeholder="Ex: FT 2024/999" value={currentPurchase.referenceDocument || ''} onChange={e => setCurrentPurchase({...currentPurchase, referenceDocument: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Categoria de Custo</label>
                                <select className="w-full border rounded-lg p-2.5 text-sm bg-white" value={currentPurchase.categoryId || ''} onChange={e => setCurrentPurchase({...currentPurchase, categoryId: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {categories.filter(c => c.type.includes('Custo')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black text-gray-500 uppercase flex items-center gap-2"><ShoppingBag size={14}/> Itens da Compra</h4>
                            
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Item (Material/Serviço)</label>
                                    <SearchableSelect options={materialOptions} value={selectedMaterialId} onChange={setSelectedMaterialId} placeholder="Selecionar do catálogo..." />
                                </div>
                                <div className="w-24">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Custo Unit.</label>
                                    <input type="number" className="w-full border rounded-lg p-2.5 text-sm" value={costPrice} onChange={e => setCostPrice(Number(e.target.value))} />
                                </div>
                                <div className="w-16">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Qtd</label>
                                    <input type="number" className="w-full border rounded-lg p-2.5 text-sm text-center" value={qty} onChange={e => setQty(Number(e.target.value))} />
                                </div>
                                <button onClick={handleAddItem} className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700"><Plus size={18}/></button>
                            </div>

                            <div className="border rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase"><tr><th className="p-3 text-left">Item</th><th className="p-3 text-center">Qtd</th><th className="p-3 text-right">Custo</th><th className="p-3 text-right">Total</th><th className="p-3"></th></tr></thead>
                                    <tbody className="divide-y">
                                        {currentPurchase.items?.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="p-3">{item.description}</td>
                                                <td className="p-3 text-center">{item.quantity}</td>
                                                <td className="p-3 text-right">{item.unitPrice.toLocaleString()}</td>
                                                <td className="p-3 text-right font-bold">{item.total.toLocaleString()}</td>
                                                <td className="p-3 text-center"><button onClick={() => handleRemoveItem(item.id)} className="text-red-400"><Trash2 size={16}/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t mt-4 shrink-0">
                        <div className="text-xl font-black text-gray-800">Total: {currentPurchase.total?.toLocaleString()} CVE</div>
                        <div className="flex gap-2">
                            {currentPurchase.status === 'Rascunho' && (
                                <>
                                    <button onClick={handleSavePurchase} className="px-4 py-2 border rounded-lg font-bold text-gray-600 hover:bg-gray-50">Guardar Rascunho</button>
                                    <button onClick={handleFinalize} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-lg flex items-center gap-2">
                                        <CheckCircle2 size={18}/> Finalizar (Lançar)
                                    </button>
                                </>
                            )}
                            {(currentPurchase.status === 'Aberta' || currentPurchase.status === 'Paga') && (
                                <button onClick={handleSavePurchase} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md flex items-center gap-2">
                                    <Edit2 size={16}/> Atualizar Dados
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Modal de Despesa Recorrente */}
            <Modal isOpen={isRecurringModalOpen} onClose={() => setIsRecurringModalOpen(false)} title={currentRecurring.id ? "Editar Despesa Recorrente" : "Nova Despesa Recorrente"}>
                <form onSubmit={(e) => { e.preventDefault(); handleSaveRecurring(); }} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Fornecedor</label>
                        <SearchableSelect 
                            options={supplierOptions}
                            value={currentRecurring.supplierId?.toString() || ''}
                            onChange={(val) => {
                                const s = suppliers.find(su => su.id === Number(val));
                                setCurrentRecurring(prev => ({ ...prev, supplierId: Number(val), supplierName: s?.company }));
                            }}
                            placeholder="Procurar Fornecedor..."
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Descrição</label>
                        <input required type="text" className="w-full border rounded-lg p-3 text-sm" value={currentRecurring.description || ''} onChange={e => setCurrentRecurring({...currentRecurring, description: e.target.value})} placeholder="Ex: Renda Escritório" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Valor</label>
                            <input required type="number" className="w-full border rounded-lg p-3 text-sm font-bold" value={currentRecurring.amount || ''} onChange={e => setCurrentRecurring({...currentRecurring, amount: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Frequência</label>
                            <select className="w-full border rounded-lg p-3 text-sm bg-white" value={currentRecurring.frequency} onChange={e => setCurrentRecurring({...currentRecurring, frequency: e.target.value as any})}>
                                <option value="Mensal">Mensal</option>
                                <option value="Trimestral">Trimestral</option>
                                <option value="Semestral">Semestral</option>
                                <option value="Anual">Anual</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Próxima Execução</label>
                            <input required type="date" className="w-full border rounded-lg p-3 text-sm" value={currentRecurring.nextRun || ''} onChange={e => setCurrentRecurring({...currentRecurring, nextRun: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Categoria</label>
                            <select className="w-full border rounded-lg p-3 text-sm bg-white" value={currentRecurring.categoryId || ''} onChange={e => setCurrentRecurring({...currentRecurring, categoryId: e.target.value})}>
                                <option value="">Selecione...</option>
                                {categories.filter(c => c.type.includes('Custo')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="submit" className="px-8 py-2 bg-red-600 text-white rounded-lg font-bold shadow-lg hover:bg-red-700">Guardar</button>
                    </div>
                </form>
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
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                purchase={selectedPurchaseForPayment}
                settings={settings}
                categories={categories}
                onConfirm={handlePaymentConfirm}
            />
        </div>
    );
};
