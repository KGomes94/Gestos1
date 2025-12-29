
import React, { useState, useMemo } from 'react';
import { Purchase, Client, Material, SystemSettings, Transaction, StockMovement } from '../types';
import { Plus, Search, Filter, ShoppingCart, DollarSign, Calendar, Upload } from 'lucide-react';
import Modal from './Modal';
import { invoicingCalculations } from '../invoicing/services/invoicingCalculations';
import { stockService } from '../services/stockService';
import { useNotification } from '../contexts/NotificationContext';
import { SearchableSelect } from './SearchableSelect';
import { currency } from '../utils/currency';
import { db } from '../services/db';

interface PurchasingModuleProps {
    suppliers: Client[];
    materials: Material[];
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
    settings: SystemSettings;
    purchases: Purchase[];
    setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    setStockMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>;
}

export const PurchasingModule: React.FC<PurchasingModuleProps> = ({
    suppliers, materials, setMaterials, settings, purchases, setPurchases, setTransactions, setStockMovements
}) => {
    const { notify } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Purchase Form State
    const [currentPurchase, setCurrentPurchase] = useState<Partial<Purchase>>({
        status: 'Rascunho',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        items: []
    });
    
    // Item Addition State
    const [selectedMatId, setSelectedMatId] = useState('');
    const [qty, setQty] = useState(1);
    const [unitPrice, setUnitPrice] = useState(0);

    // Filter Logic
    const filteredPurchases = useMemo(() => {
        return purchases.filter(p => {
            const matchSearch = p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                p.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = statusFilter === 'Todos' || p.status === statusFilter;
            return matchSearch && matchStatus;
        }).sort((a,b) => b.date.localeCompare(a.date));
    }, [purchases, searchTerm, statusFilter]);

    // Helpers
    const supplierOptions = useMemo(() => suppliers.map(s => ({ value: s.id, label: s.company, subLabel: s.nif })), [suppliers]);
    const materialOptions = useMemo(() => materials.map(m => ({ value: m.id, label: m.name })), [materials]);

    // Actions
    const handleNewPurchase = () => {
        const year = new Date().getFullYear();
        setCurrentPurchase({
            id: db.purchases.getNextId(year),
            status: 'Rascunho',
            date: new Date().toISOString().split('T')[0],
            dueDate: new Date().toISOString().split('T')[0],
            items: [],
            subtotal: 0, 
            taxTotal: 0, 
            total: 0
        });
        setIsModalOpen(true);
    };

    const handleAddItem = () => {
        const m = materials.find(x => x.id === Number(selectedMatId));
        if (m) {
            const newItem = invoicingCalculations.createItem(
                { name: m.name, price: unitPrice, internalCode: m.internalCode },
                qty,
                settings.defaultTaxRate,
                false
            );
            
            const newItems = [...(currentPurchase.items || []), newItem];
            const totals = invoicingCalculations.calculateTotals(newItems, false);
            
            setCurrentPurchase(prev => ({
                ...prev,
                items: newItems,
                ...totals
            }));
            
            setSelectedMatId('');
            setQty(1);
            setUnitPrice(0);
        }
    };

    const handleRemoveItem = (id: string | number) => {
        const newItems = currentPurchase.items?.filter(i => i.id !== id) || [];
        const totals = invoicingCalculations.calculateTotals(newItems, false);
        setCurrentPurchase(prev => ({ ...prev, items: newItems, ...totals }));
    };

    const handleSave = () => {
        if (!currentPurchase.supplierId) return notify('error', 'Fornecedor obrigatório');
        if ((currentPurchase.items?.length || 0) === 0) return notify('error', 'Adicione itens.');

        const purchase = currentPurchase as Purchase;
        
        // Se já existe, atualiza. Se não, cria.
        setPurchases(prev => {
            const idx = prev.findIndex(p => p.id === purchase.id);
            if (idx >= 0) {
                const newArr = [...prev];
                newArr[idx] = purchase;
                return newArr;
            }
            return [purchase, ...prev];
        });
        
        setIsModalOpen(false);
        notify('success', 'Compra guardada.');
    };

    const handleFinalize = () => {
        if (!currentPurchase.supplierId) return;
        
        // 1. Atualizar Stock (ENTRADA)
        const purchase = { ...currentPurchase, status: 'Aberta' } as Purchase;
        let updatedMaterials = [...materials];
        const newMovements: StockMovement[] = [];

        purchase.items.forEach(item => {
            const materialIndex = updatedMaterials.findIndex(m => m.name === item.description);
            if (materialIndex !== -1) {
                const m = updatedMaterials[materialIndex];
                if (m.type === 'Material') {
                    const res = stockService.processMovement(
                        m, item.quantity, 'ENTRADA', `Compra ${purchase.id}`, 'Sistema', purchase.id, item.unitPrice
                    );
                    if (res.updatedMaterial && res.movement) {
                        updatedMaterials[materialIndex] = res.updatedMaterial;
                        newMovements.push(res.movement);
                    }
                }
            }
        });

        // 2. Gravar alterações
        setMaterials(updatedMaterials);
        setStockMovements(prev => [...newMovements, ...prev]);
        
        setPurchases(prev => {
            const idx = prev.findIndex(p => p.id === purchase.id);
            if (idx >= 0) {
                const newArr = [...prev];
                newArr[idx] = purchase;
                return newArr;
            }
            return [purchase, ...prev];
        });

        setIsModalOpen(false);
        notify('success', 'Compra lançada. Stock atualizado.');
    };

    const handlePay = (p: Purchase) => {
        // Criar transação de despesa
        const tx: Transaction = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            description: `Pagamento Compra ${p.id} - ${p.supplierName}`,
            reference: p.id,
            type: 'Transferência',
            category: 'Custo das Mercadorias (CMV)', // Default
            income: null,
            expense: p.total,
            status: 'Pago',
            clientId: p.supplierId,
            clientName: p.supplierName,
            purchaseId: p.id
        };

        setTransactions(prev => [tx, ...prev]);
        setPurchases(prev => prev.map(x => x.id === p.id ? { ...x, status: 'Paga' } : x));
        notify('success', 'Pagamento registado.');
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
            {/* Toolbar */}
            <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row gap-4 justify-between items-center shrink-0">
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <input type="text" placeholder="Fornecedor, Nº Doc..." className="pl-9 pr-3 py-2 border rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-red-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    </div>
                    <select className="border rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-red-500" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="Todos">Todos</option>
                        <option value="Aberta">Em Dívida</option>
                        <option value="Paga">Paga</option>
                        <option value="Rascunho">Rascunho</option>
                    </select>
                </div>
                <button onClick={handleNewPurchase} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-700 shadow-lg shadow-red-100">
                    <Plus size={16}/> Lançar Compra
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-[10px] sticky top-0">
                        <tr>
                            <th className="p-4 text-left">Documento</th>
                            <th className="p-4 text-left">Data</th>
                            <th className="p-4 text-left">Fornecedor</th>
                            <th className="p-4 text-right">Valor</th>
                            <th className="p-4 text-center">Estado</th>
                            <th className="p-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredPurchases.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="p-4 font-mono font-bold text-gray-600">{p.id}</td>
                                <td className="p-4 text-gray-600">{new Date(p.date).toLocaleDateString()}</td>
                                <td className="p-4 font-bold text-gray-800">{p.supplierName}</td>
                                <td className="p-4 text-right font-black text-red-600">{p.total.toLocaleString()} CVE</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                        p.status === 'Paga' ? 'bg-green-100 text-green-700' :
                                        p.status === 'Aberta' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                                    }`}>{p.status === 'Aberta' ? 'Em Dívida' : p.status}</span>
                                </td>
                                <td className="p-4 text-right">
                                    {p.status === 'Aberta' && (
                                        <button onClick={() => handlePay(p)} className="text-green-600 bg-green-50 px-3 py-1 rounded font-bold text-xs hover:bg-green-100">Pagar</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lançar Compra / Despesa">
                <div className="flex flex-col h-[80vh]">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fornecedor</label>
                            <SearchableSelect 
                                options={supplierOptions} 
                                value={currentPurchase.supplierId || ''} 
                                onChange={(val) => { const s = suppliers.find(x => x.id === Number(val)); setCurrentPurchase({...currentPurchase, supplierId: Number(val), supplierName: s?.company, supplierNif: s?.nif}); }} 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Doc.</label>
                            <input type="date" className="w-full border rounded-lg p-2" value={currentPurchase.date} onChange={e => setCurrentPurchase({...currentPurchase, date: e.target.value})}/>
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
                            <button onClick={handleAddItem} className="bg-blue-600 text-white p-2 rounded-lg"><Plus size={20}/></button>
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
                                    <button onClick={handleSave} className="px-4 py-2 border rounded-lg font-bold text-gray-600">Guardar Rascunho</button>
                                    <button onClick={handleFinalize} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold">Lançar & Stock</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
