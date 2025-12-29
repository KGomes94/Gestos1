
import React, { useState, useMemo } from 'react';
import { Material, StockMovement, StockMovementType } from '../../types';
import { Package, ArrowUp, ArrowDown, History, AlertTriangle, Plus, Minus, Search, Calendar, FileText, DollarSign } from 'lucide-react';
import Modal from '../Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { stockService } from '../../services/stockService';

interface StockManagementProps {
    materials: Material[];
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
    stockMovements: StockMovement[];
    setStockMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>;
}

export const StockManagement: React.FC<StockManagementProps> = ({ 
    materials, setMaterials, stockMovements, setStockMovements 
}) => {
    const { user } = useAuth();
    const { notify } = useNotification();
    
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    
    const [movementType, setMovementType] = useState<StockMovementType>('ENTRADA');
    const [movementData, setMovementData] = useState({
        quantity: 1,
        costPrice: 0, // Novo campo para PMP
        reason: '',
        documentRef: '',
        date: new Date().toISOString().split('T')[0]
    });

    // Filter Logic
    const filteredMaterials = useMemo(() => {
        return materials.filter(m => 
            m.type === 'Material' && 
            (m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             m.internalCode.toLowerCase().includes(searchTerm.toLowerCase()))
        ).sort((a, b) => (a.stock || 0) - (b.stock || 0));
    }, [materials, searchTerm]);

    const totalInventoryValue = useMemo(() => {
        return materials.reduce((acc, m) => {
            if (m.type !== 'Material') return acc;
            // Usa avgCost se existir, senão usa o preço de venda como fallback (não ideal, mas seguro)
            const cost = m.avgCost || (m.price * 0.7); 
            return acc + ((m.stock || 0) * cost);
        }, 0);
    }, [materials]);

    const lowStockCount = useMemo(() => {
        return materials.filter(m => m.type === 'Material' && (m.stock || 0) <= (m.minStock || 0)).length;
    }, [materials]);

    // Handlers
    const openMovementModal = (material: Material, type: StockMovementType) => {
        setSelectedMaterial(material);
        setMovementType(type);
        setMovementData({
            quantity: 1,
            costPrice: type === 'ENTRADA' ? (material.avgCost || 0) : 0,
            reason: '',
            documentRef: '',
            date: new Date().toISOString().split('T')[0]
        });
        setIsMovementModalOpen(true);
    };

    const handleSaveMovement = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMaterial) return;
        if (movementData.quantity <= 0) return notify('error', 'Quantidade deve ser maior que zero.');

        // Use Stock Service
        const result = stockService.processMovement(
            selectedMaterial,
            movementData.quantity,
            movementType,
            movementData.reason || (movementType === 'ENTRADA' ? 'Compra Manual' : 'Ajuste Manual'),
            user?.name || 'Utilizador',
            movementData.documentRef,
            movementType === 'ENTRADA' ? movementData.costPrice : undefined
        );

        if (!result.success || !result.updatedMaterial || !result.movement) {
            return notify('error', result.message || 'Erro ao processar movimento.');
        }

        // Update State
        setStockMovements(prev => [result.movement!, ...prev]);
        setMaterials(prev => prev.map(m => m.id === selectedMaterial.id ? result.updatedMaterial! : m));

        // Enhanced Notification using result type
        notify(result.alertType || 'success', result.message, movementType === 'ENTRADA' ? 'Entrada Registada' : 'Saída Registada');
        
        setIsMovementModalOpen(false);
    };

    const getMaterialHistory = (materialId: number) => {
        return stockMovements
            .filter(m => m.materialId === materialId)
            .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
    };

    return (
        <div className="flex flex-col h-full gap-6 animate-fade-in-up">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-400">Valor Estimado (Custo)</p>
                        <h3 className="text-xl font-bold text-gray-900">{totalInventoryValue.toLocaleString()} CVE</h3>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={20}/></div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-400">Itens Controlados</p>
                        <h3 className="text-xl font-bold text-gray-900">{filteredMaterials.length}</h3>
                    </div>
                    <div className="p-3 bg-gray-50 text-gray-600 rounded-lg"><FileText size={20}/></div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-400">Alertas de Stock</p>
                        <h3 className={`text-xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{lowStockCount}</h3>
                    </div>
                    <div className={`p-3 rounded-lg ${lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}><AlertTriangle size={20}/></div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white border rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2"><Package size={18}/> Inventário Atual</h3>
                    <div className="relative w-64">
                        <input 
                            type="text" 
                            placeholder="Pesquisar item..." 
                            className="pl-8 pr-3 py-2 border rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-green-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search size={14} className="absolute left-2.5 top-3 text-gray-400" />
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 text-[10px] font-black uppercase text-gray-500 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 text-left">Item</th>
                                <th className="px-6 py-3 text-center">Nível de Stock</th>
                                <th className="px-6 py-3 text-right">Custo Médio</th>
                                <th className="px-6 py-3 text-right">Preço Venda</th>
                                <th className="px-6 py-3 text-right w-48">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredMaterials.map(m => {
                                const stock = m.stock || 0;
                                const min = m.minStock || 0;
                                const statusColor = stock <= min ? 'bg-red-500' : stock <= min * 1.5 ? 'bg-yellow-500' : 'bg-green-500';
                                const percentage = min > 0 ? Math.min((stock / (min * 3)) * 100, 100) : 100;

                                return (
                                    <tr key={m.id} className="hover:bg-gray-50 group">
                                        <td className="px-6 py-3">
                                            <div className="font-bold text-gray-800">{m.name}</div>
                                            <div className="text-xs text-gray-400 font-mono">{m.internalCode} • {m.unit}</div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                                                    <div className={`h-full ${statusColor}`} style={{ width: `${percentage}%` }}></div>
                                                </div>
                                                <span className={`text-xs font-bold w-12 text-right ${stock <= min ? 'text-red-600' : 'text-gray-700'}`}>{stock}</span>
                                            </div>
                                            <div className="text-[9px] text-gray-400 text-right mt-1">Mínimo: {min}</div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-gray-600">
                                            {m.avgCost ? m.avgCost.toLocaleString() : '-'} CVE
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-gray-800">
                                            {m.price.toLocaleString()} CVE
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openMovementModal(m, 'ENTRADA')} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Entrada"><Plus size={16}/></button>
                                                <button onClick={() => openMovementModal(m, 'SAIDA')} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Saída"><Minus size={16}/></button>
                                                <button onClick={() => { setSelectedMaterial(m); setIsHistoryModalOpen(true); }} className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200" title="Histórico"><History size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL MOVIMENTO */}
            <Modal isOpen={isMovementModalOpen} onClose={() => setIsMovementModalOpen(false)} title={`Registar ${movementType === 'ENTRADA' ? 'Entrada' : 'Saída'} de Stock`}>
                <form onSubmit={handleSaveMovement} className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-800">{selectedMaterial?.name}</h4>
                        <div className="flex gap-4 text-xs mt-1">
                            <p className="text-gray-500">Stock Atual: <span className="font-bold">{selectedMaterial?.stock} {selectedMaterial?.unit}</span></p>
                            <p className="text-gray-500">PMP Atual: <span className="font-bold">{selectedMaterial?.avgCost?.toLocaleString() || '0'} CVE</span></p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                            <input type="date" required className="w-full border rounded-lg p-2 text-sm" value={movementData.date} onChange={e => setMovementData({...movementData, date: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantidade</label>
                            <input type="number" min="1" required className="w-full border rounded-lg p-2 text-sm font-bold" value={movementData.quantity} onChange={e => setMovementData({...movementData, quantity: Number(e.target.value)})} />
                        </div>
                    </div>

                    {movementType === 'ENTRADA' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço de Custo Unitário (Para PMP)</label>
                            <input 
                                type="number" 
                                min="0" 
                                className="w-full border rounded-lg p-2 text-sm border-blue-200 bg-blue-50 text-blue-800 font-bold" 
                                value={movementData.costPrice} 
                                onChange={e => setMovementData({...movementData, costPrice: Number(e.target.value)})} 
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Deixe 0 se não quiser alterar o custo médio.</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo / Origem</label>
                        <input 
                            type="text" 
                            className="w-full border rounded-lg p-2 text-sm" 
                            placeholder={movementType === 'ENTRADA' ? "Ex: Compra Fatura 123" : "Ex: Obra Cliente X"}
                            value={movementData.reason} 
                            onChange={e => setMovementData({...movementData, reason: e.target.value})} 
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t">
                        <button type="button" onClick={() => setIsMovementModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-bold text-gray-500">Cancelar</button>
                        <button type="submit" className={`px-6 py-2 text-white rounded-lg text-sm font-bold ${movementType === 'ENTRADA' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>Confirmar {movementType}</button>
                    </div>
                </form>
            </Modal>

            {/* MODAL HISTÓRICO - Mantido igual */}
            <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title={`Histórico: ${selectedMaterial?.name}`}>
                <div className="max-h-[60vh] overflow-y-auto">
                    <table className="min-w-full text-xs">
                        <thead className="bg-gray-100 text-gray-500 sticky top-0">
                            <tr>
                                <th className="p-3 text-left">Data</th>
                                <th className="p-3 text-center">Tipo</th>
                                <th className="p-3 text-right">Qtd</th>
                                <th className="p-3 text-left pl-6">Motivo</th>
                                <th className="p-3 text-right">Stock Final</th>
                                <th className="p-3 text-right">User</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {selectedMaterial && getMaterialHistory(selectedMaterial.id).map(mov => (
                                <tr key={mov.id}>
                                    <td className="p-3 text-gray-600">{new Date(mov.date).toLocaleDateString()}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-0.5 rounded font-bold ${mov.type === 'ENTRADA' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{mov.type}</span>
                                    </td>
                                    <td className="p-3 text-right font-bold">{mov.quantity}</td>
                                    <td className="p-3 text-gray-700 pl-6">{mov.reason}</td>
                                    <td className="p-3 text-right text-gray-500">{mov.stockAfter}</td>
                                    <td className="p-3 text-right text-gray-400 italic">{mov.user}</td>
                                </tr>
                            ))}
                            {selectedMaterial && getMaterialHistory(selectedMaterial.id).length === 0 && (
                                <tr><td colSpan={6} className="p-6 text-center text-gray-400 italic">Sem movimentos registados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Modal>
        </div>
    );
};
