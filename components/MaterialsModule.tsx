
import React, { useState } from 'react';
import { Material } from '../types';
import { Package, Plus, Search, Trash2, Edit2, Hash, Wrench, Box } from 'lucide-react';
import Modal from './Modal';
import { db } from '../services/db';
import { useConfirmation } from '../contexts/ConfirmationContext';

interface MaterialsModuleProps {
    materials: Material[];
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
}

const MaterialsModule: React.FC<MaterialsModuleProps> = ({ materials, setMaterials }) => {
    const { requestConfirmation } = useConfirmation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [newMaterial, setNewMaterial] = useState<Partial<Material>>({ unit: 'Un', type: 'Material', internalCode: '', observations: '' });
    const [editingId, setEditingId] = useState<number | null>(null);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingId) {
            setMaterials(prev => prev.map(m => m.id === editingId ? { ...m, ...newMaterial } as Material : m));
            setEditingId(null);
        } else {
            // Auto generate code if creation
            const type = newMaterial.type || 'Material';
            const autoCode = db.materials.getNextCode(type);

            const material: Material = {
                id: Date.now(),
                name: newMaterial.name || 'Novo Material',
                unit: newMaterial.unit || 'Un',
                price: Number(newMaterial.price) || 0,
                type: type,
                internalCode: autoCode,
                observations: newMaterial.observations || ''
            };
            setMaterials([...materials, material]);
        }
        
        setIsModalOpen(false);
        setNewMaterial({ unit: 'Un', type: 'Material', internalCode: '', observations: '' });
    };

    const handleEdit = (m: Material) => {
        setEditingId(m.id);
        setNewMaterial(m);
        setIsModalOpen(true);
    };

    const handleDelete = (id: number) => {
        requestConfirmation({
            title: "Eliminar Artigo",
            message: "Tem a certeza que deseja eliminar este artigo? Esta ação não pode ser desfeita.",
            variant: 'danger',
            confirmText: 'Eliminar',
            onConfirm: () => {
                setMaterials(prev => prev.filter(m => m.id !== id));
            }
        });
    };

    const filteredMaterials = materials.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.internalCode && m.internalCode.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => (a.internalCode || '').localeCompare(b.internalCode || ''));

    return (
        <div className="space-y-6">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                   <h2 className="text-2xl font-bold text-gray-800">Materiais & Serviços</h2>
                   <p className="text-gray-500 text-sm">Gestão de artigos com numeração automática</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <input 
                            type="text" 
                            placeholder="Procurar por código, nome ou tipo..." 
                            className="pl-8 pr-3 py-2 border border-gray-300 rounded-xl w-full text-sm outline-none focus:ring-2 focus:ring-green-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search size={14} className="absolute left-2.5 top-3 text-gray-400" />
                    </div>
                    {/* Botão Novo agora no header esquerdo da lista é uma convenção para outros módulos, aqui mantemos à direita como solicitado anteriormente ou padrão */}
                    <button onClick={() => { setEditingId(null); setNewMaterial({ unit: 'Un', type: 'Material', internalCode: '', observations: '' }); setIsModalOpen(true); }} className="bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700 flex items-center gap-2 whitespace-nowrap font-bold shadow-lg shadow-green-100">
                        <Plus size={16} /> Novo Artigo
                    </button>
                </div>
             </div>

             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                        <tr>
                            <th className="px-6 py-4 text-left">Código (Ref)</th>
                            <th className="px-6 py-4 text-left">Tipo</th>
                            <th className="px-6 py-4 text-left">Item / Descrição</th>
                            <th className="px-6 py-4 text-left">Observações</th>
                            <th className="px-6 py-4 text-center">Un</th>
                            <th className="px-6 py-4 text-right">Preço Unit.</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredMaterials.length > 0 ? filteredMaterials.map(m => (
                            <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-mono font-bold text-gray-600 text-xs">{m.internalCode}</td>
                                <td className="px-6 py-4">
                                    {m.type === 'Material' ? (
                                        <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 w-fit"><Box size={12}/> Material</span>
                                    ) : (
                                        <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 w-fit"><Wrench size={12}/> Serviço</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-gray-800 font-bold">{m.name}</td>
                                <td className="px-6 py-4 text-gray-500 text-xs italic truncate max-w-[150px]">{m.observations || '-'}</td>
                                <td className="px-6 py-4 text-center text-gray-500 font-medium">{m.unit}</td>
                                <td className="px-6 py-4 text-right text-gray-800 font-black">{m.price.toLocaleString('pt-CV')} CVE</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => handleEdit(m)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">Nenhum artigo registado no catálogo.</td></tr>
                        )}
                    </tbody>
                </table>
             </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Artigo" : "Registar Novo Artigo"}>
                <form onSubmit={handleSave} className="space-y-6">
                    {/* Linha 1: Tipo e Código (Auto) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Tipo de Artigo</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setNewMaterial({ ...newMaterial, type: 'Material' })}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all ${newMaterial.type === 'Material' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border text-gray-500'}`}
                                >
                                    <Box size={14}/> Material
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewMaterial({ ...newMaterial, type: 'Serviço' })}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all ${newMaterial.type === 'Serviço' ? 'bg-purple-600 text-white shadow-md' : 'bg-white border text-gray-500'}`}
                                >
                                    <Wrench size={14}/> Serviço
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><Hash size={12}/> Código (Automático)</label>
                            <input 
                                disabled
                                placeholder={editingId ? newMaterial.internalCode : "Gerado ao guardar..."} 
                                className="w-full border rounded-xl p-2 text-sm font-mono font-bold uppercase bg-gray-200 text-gray-500" 
                                value={editingId ? newMaterial.internalCode : ''}
                            />
                        </div>
                    </div>
                    
                    {/* Linha 2: Dados Principais */}
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nome do Item / Serviço</label>
                        <input required className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={newMaterial.name || ''} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Unidade</label>
                            <select className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})}>
                                <option value="Un">Unidade (Un)</option>
                                <option value="h">Hora (h)</option>
                                <option value="Kg">Quilo (Kg)</option>
                                <option value="m">Metro (m)</option>
                                <option value="m2">Metro Q. (m²)</option>
                                <option value="L">Litro (L)</option>
                                <option value="EA">EA</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Preço Unitário</label>
                            <input type="number" min="0" required className="w-full border rounded-xl p-3 text-sm font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none" value={newMaterial.price || ''} onChange={e => setNewMaterial({...newMaterial, price: Number(e.target.value)})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Observações</label>
                        <textarea 
                            className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none h-20"
                            placeholder="Detalhes técnicos, fornecedor, etc..."
                            value={newMaterial.observations || ''} 
                            onChange={e => setNewMaterial({...newMaterial, observations: e.target.value})}
                        />
                    </div>
                    
                    <div className="pt-6 flex justify-end gap-3 border-t">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancelar</button>
                        <button type="submit" className="px-10 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg shadow-green-100 hover:bg-green-700 transition-all">Guardar Artigo</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default MaterialsModule;
