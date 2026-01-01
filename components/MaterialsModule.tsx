
import React, { useState, useMemo, useRef } from 'react';
import { Material, Invoice, StockMovement } from '../types';
import { Package, Plus, List, Layers, BarChart2, Box, Wrench, Search, Upload, Edit2, Trash2, Hash } from 'lucide-react';
import Modal from './Modal';
import { useNotification } from '../contexts/NotificationContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import { CatalogStats } from './materials/CatalogStats';
import { StockManagement } from './materials/StockManagement';
import { useMaterialImport } from '../materials/hooks/useMaterialImport';
import { MaterialImportModal } from './materials/MaterialImportModal';
import { db } from '../services/db';

interface MaterialsModuleProps {
    materials: Material[];
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
    invoices: Invoice[];
    stockMovements: StockMovement[];
    setStockMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>;
}

export const MaterialsModule: React.FC<MaterialsModuleProps> = ({ 
    materials, setMaterials, invoices, stockMovements = [], setStockMovements = () => {} 
}) => {
    const { notify } = useNotification();
    const { requestConfirmation } = useConfirmation();
    
    // View State
    const [view, setView] = useState<'list' | 'stock' | 'stats'>('list');
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'Material' | 'Serviço'>('all');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [newMaterial, setNewMaterial] = useState<Partial<Material>>({
        unit: 'Un', 
        type: 'Material', 
        internalCode: '', 
        observations: '', 
        stock: 0, 
        minStock: 0
    });

    // Import Hook
    const importHook = useMaterialImport(materials, setMaterials);

    // Logic
    const filteredMaterials = useMemo(() => {
        return materials.filter(m => {
            const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  m.internalCode.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = typeFilter === 'all' || m.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [materials, searchTerm, typeFilter]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newMaterial.name || !newMaterial.price) {
            return notify('error', 'Nome e Preço são obrigatórios.');
        }

        if (editingId) {
            // Update
            const updated = { ...newMaterial, id: editingId } as Material;
            setMaterials(prev => prev.map(m => m.id === editingId ? updated : m));
            notify('success', 'Item atualizado.');
        } else {
            // Create
            const code = newMaterial.internalCode || db.materials.getNextCode(newMaterial.type || 'Material');
            const newItem = { 
                ...newMaterial, 
                id: Date.now(),
                internalCode: code,
                stock: newMaterial.type === 'Material' ? (newMaterial.stock || 0) : 0
            } as Material;
            setMaterials(prev => [...prev, newItem]);
            notify('success', 'Item criado.');
        }
        setIsModalOpen(false);
    };

    const handleEdit = (m: Material) => {
        setEditingId(m.id);
        setNewMaterial(m);
        setIsModalOpen(true);
    };

    const handleDelete = (id: number) => {
        requestConfirmation({
            title: "Eliminar Item",
            message: "Tem a certeza? Se este item estiver em uso, o histórico será mantido mas o item desaparecerá do catálogo.",
            variant: 'danger',
            confirmText: 'Eliminar',
            onConfirm: () => {
                setMaterials(prev => prev.filter(m => m.id !== id));
                notify('success', 'Item eliminado.');
            }
        });
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                {/* Header */}
                <div>
                   <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Package className="text-purple-600"/> Catálogo</h2>
                   <p className="text-gray-500 text-sm">Gestão de produtos, serviços e stock.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={() => { setEditingId(null); setNewMaterial({ unit: 'Un', type: 'Material', internalCode: '', observations: '', stock: 0, minStock: 0 }); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 whitespace-nowrap font-bold shadow-lg shadow-green-100 text-sm uppercase tracking-wide">
                        <Plus size={16} /> Novo Item
                    </button>
                    <div className="flex bg-gray-100 p-1 rounded-lg border">
                        <button onClick={() => setView('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'list' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                            <List size={16} /> Lista
                        </button>
                        <button onClick={() => setView('stock')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'stock' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                            <Layers size={16} /> Stock
                        </button>
                        <button onClick={() => setView('stats')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'stats' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                            <BarChart2 size={16} /> Analítica
                        </button>
                    </div>
                </div>
             </div>

             {view === 'stats' && (
                 <div className="flex-1 overflow-y-auto">
                     <CatalogStats materials={materials} invoices={invoices} />
                 </div>
             )}

             {view === 'stock' && (
                 <div className="flex-1 overflow-hidden">
                     <StockManagement 
                        materials={materials} 
                        setMaterials={setMaterials} 
                        stockMovements={stockMovements}
                        setStockMovements={setStockMovements}
                     />
                 </div>
             )}

             {view === 'list' && (
                 <div className="flex flex-col flex-1 gap-4 overflow-hidden animate-fade-in-up">
                    {/* Toolbar */}
                    <div className="bg-white p-3 border rounded-xl flex flex-wrap gap-4 items-center justify-between shadow-sm shrink-0">
                        <div className="flex gap-2">
                            <button onClick={() => setTypeFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${typeFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Todos</button>
                            <button onClick={() => setTypeFilter('Material')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors flex items-center gap-2 ${typeFilter === 'Material' ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}><Box size={12}/> Materiais</button>
                            <button onClick={() => setTypeFilter('Serviço')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors flex items-center gap-2 ${typeFilter === 'Serviço' ? 'bg-purple-100 text-purple-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}><Wrench size={12}/> Serviços</button>
                        </div>
                        
                        <div className="flex gap-2 flex-1 justify-end">
                            <div className="relative w-64">
                                <input 
                                    type="text" 
                                    placeholder="Procurar..." 
                                    className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg w-full text-sm outline-none focus:ring-2 focus:ring-green-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
                            </div>
                            <button onClick={importHook.openModal} className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm text-xs font-bold uppercase">
                                <Upload size={14} /> Importar
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                        <div className="flex-1 overflow-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 sticky top-0 z-10 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left">Código</th>
                                        <th className="px-6 py-3 text-left">Tipo</th>
                                        <th className="px-6 py-3 text-left">Item / Descrição</th>
                                        <th className="px-6 py-3 text-center">Un</th>
                                        <th className="px-6 py-3 text-center">Stock</th>
                                        <th className="px-6 py-3 text-right">Preço Unit.</th>
                                        <th className="px-6 py-3 text-right w-24">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredMaterials.length > 0 ? filteredMaterials.map(m => (
                                        <tr key={m.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-6 py-3 font-mono font-bold text-gray-600 text-xs">{m.internalCode}</td>
                                            <td className="px-6 py-3">
                                                {m.type === 'Material' ? (
                                                    <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 w-fit"><Box size={12}/> Material</span>
                                                ) : (
                                                    <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 w-fit"><Wrench size={12}/> Serviço</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="text-gray-800 font-bold">{m.name}</div>
                                                {m.observations && <div className="text-gray-400 text-xs italic truncate max-w-[200px]">{m.observations}</div>}
                                            </td>
                                            <td className="px-6 py-3 text-center text-gray-500 font-medium text-xs">{m.unit}</td>
                                            <td className="px-6 py-3 text-center">
                                                {m.type === 'Material' ? (
                                                    <span className={`font-mono font-bold ${m.stock !== undefined && m.minStock !== undefined && m.stock <= m.minStock ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-gray-700'}`}>
                                                        {m.stock}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-right text-gray-800 font-black">{m.price.toLocaleString('pt-CV')} CVE</td>
                                            <td className="px-6 py-3 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEdit(m)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                                    <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">Nenhum item encontrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                 </div>
             )}

            {/* Modal de Edição / Criação */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Item" : "Novo Item"}>
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Tipo</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setNewMaterial({ ...newMaterial, type: 'Material' })} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all ${newMaterial.type === 'Material' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border text-gray-500'}`}><Box size={14}/> Material</button>
                                <button type="button" onClick={() => setNewMaterial({ ...newMaterial, type: 'Serviço' })} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all ${newMaterial.type === 'Serviço' ? 'bg-purple-600 text-white shadow-md' : 'bg-white border text-gray-500'}`}><Wrench size={14}/> Serviço</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><Hash size={12}/> Código (Automático)</label>
                            <input disabled placeholder={editingId ? newMaterial.internalCode : "Gerado ao guardar..."} className="w-full border rounded-xl p-2 text-sm font-mono font-bold uppercase bg-gray-200 text-gray-500" value={editingId ? newMaterial.internalCode : ''} />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nome / Descrição</label>
                        <input required className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={newMaterial.name || ''} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Unidade</label>
                            <select className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})}>
                                <option value="Un">Unidade (Un)</option><option value="h">Hora (h)</option><option value="Kg">Quilo (Kg)</option><option value="m">Metro (m)</option><option value="m2">Metro Q. (m²)</option><option value="L">Litro (L)</option><option value="EA">EA</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Preço Unitário</label>
                            <input type="number" min="0" required className="w-full border rounded-xl p-3 text-sm font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none" value={newMaterial.price || ''} onChange={e => setNewMaterial({...newMaterial, price: Number(e.target.value)})} />
                        </div>
                    </div>

                    {/* Stock Section (Only for Materials) */}
                    {newMaterial.type === 'Material' && (
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-yellow-700 uppercase mb-1">Stock Atual</label>
                                <input type="number" className="w-full border border-yellow-200 rounded-xl p-2 text-sm text-center font-bold" value={newMaterial.stock || 0} onChange={e => setNewMaterial({...newMaterial, stock: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-yellow-700 uppercase mb-1">Alerta Mínimo</label>
                                <input type="number" className="w-full border border-yellow-200 rounded-xl p-2 text-sm text-center font-bold" value={newMaterial.minStock || 0} onChange={e => setNewMaterial({...newMaterial, minStock: Number(e.target.value)})} />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Observações</label>
                        <textarea className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none h-20" placeholder="Detalhes técnicos, fornecedor, etc..." value={newMaterial.observations || ''} onChange={e => setNewMaterial({...newMaterial, observations: e.target.value})} />
                    </div>
                    
                    <div className="pt-6 flex justify-end gap-3 border-t">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancelar</button>
                        <button type="submit" className="px-10 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg shadow-green-100 hover:bg-green-700 transition-all">Guardar</button>
                    </div>
                </form>
            </Modal>

            {/* Import Modal */}
            <MaterialImportModal 
                isOpen={importHook.isModalOpen}
                onClose={() => importHook.setIsModalOpen(false)}
                isLoading={importHook.isLoading}
                result={importHook.result}
                onConfirm={importHook.confirmImport}
                onFileSelect={importHook.handleFileSelect}
                fileInputRef={importHook.fileInputRef}
            />
        </div>
    );
};
