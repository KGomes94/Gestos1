
import React, { useState } from 'react';
import { Material } from '../types';
import { Package, Plus, Search, Trash2, Edit2, Hash } from 'lucide-react';
import Modal from './Modal';

interface MaterialsModuleProps {
    materials: Material[];
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
}

const MaterialsModule: React.FC<MaterialsModuleProps> = ({ materials, setMaterials }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [newMaterial, setNewMaterial] = useState<Partial<Material>>({ unit: 'Un', category: 'Geral', internalCode: '' });
    const [editingId, setEditingId] = useState<number | null>(null);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingId) {
            setMaterials(prev => prev.map(m => m.id === editingId ? { ...m, ...newMaterial } as Material : m));
            setEditingId(null);
        } else {
            const material: Material = {
                id: Date.now(),
                name: newMaterial.name || 'Novo Material',
                unit: newMaterial.unit || 'Un',
                price: Number(newMaterial.price) || 0,
                category: newMaterial.category || 'Geral',
                internalCode: newMaterial.internalCode || ''
            };
            setMaterials([...materials, material]);
        }
        
        setIsModalOpen(false);
        setNewMaterial({ unit: 'Un', category: 'Geral', internalCode: '' });
    };

    const handleEdit = (m: Material) => {
        setEditingId(m.id);
        setNewMaterial(m);
        setIsModalOpen(true);
    };

    const handleDelete = (id: number) => {
        if(window.confirm('Tem certeza?')) {
            setMaterials(prev => prev.filter(m => m.id !== id));
        }
    };

    const filteredMaterials = materials.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.internalCode && m.internalCode.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                   <h2 className="text-2xl font-bold text-gray-800">Materiais & Serviços</h2>
                   <p className="text-gray-500 text-sm">Gestão de artigos para faturação e propostas</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <input 
                            type="text" 
                            placeholder="Procurar por código ou nome..." 
                            className="pl-8 pr-3 py-2 border border-gray-300 rounded-xl w-full text-sm outline-none focus:ring-2 focus:ring-green-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search size={14} className="absolute left-2.5 top-3 text-gray-400" />
                    </div>
                    <button onClick={() => { setEditingId(null); setNewMaterial({ unit: 'Un', category: 'Geral', internalCode: '' }); setIsModalOpen(true); }} className="bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700 flex items-center gap-2 whitespace-nowrap font-bold shadow-lg shadow-green-100">
                        <Plus size={16} /> Novo Artigo
                    </button>
                </div>
             </div>

             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                        <tr>
                            <th className="px-6 py-4 text-left">Ref / Código</th>
                            <th className="px-6 py-4 text-left">Item / Descrição</th>
                            <th className="px-6 py-4 text-left">Categoria</th>
                            <th className="px-6 py-4 text-center">Un</th>
                            <th className="px-6 py-4 text-right">Preço Unit.</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredMaterials.length > 0 ? filteredMaterials.map(m => (
                            <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-mono font-bold text-gray-400 text-xs">{m.internalCode || '---'}</td>
                                <td className="px-6 py-4 text-gray-800 font-bold">{m.name}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider">{m.category}</span>
                                </td>
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
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">Nenhum artigo registado no catálogo.</td></tr>
                        )}
                    </tbody>
                </table>
             </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Artigo" : "Registar Novo Artigo"}>
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><Hash size={12}/> Código Interno</label>
                            <input placeholder="Ex: AVC01" className="w-full border rounded-xl p-3 text-sm font-bold uppercase focus:ring-2 focus:ring-green-500 outline-none" value={newMaterial.internalCode || ''} onChange={e => setNewMaterial({...newMaterial, internalCode: e.target.value})} />
                            <p className="text-[10px] text-gray-400 mt-1">Ref. fiscal no XML (EmitterIdentification)</p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nome do Item / Serviço</label>
                            <input required className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={newMaterial.name || ''} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Categoria</label>
                            <input list="matCategories" className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={newMaterial.category || ''} onChange={e => setNewMaterial({...newMaterial, category: e.target.value})} />
                            <datalist id="matCategories">
                                <option value="Geral" /><option value="Elétrico" /><option value="Hidráulico" /><option value="Manutenção" /><option value="Mão de Obra" />
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Unidade</label>
                            <select className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})}>
                                <option value="Un">Unidade (Un)</option>
                                <option value="h">Hora (h)</option>
                                <option value="Kg">Quilo (Kg)</option>
                                <option value="m">Metro (m)</option>
                                <option value="EA">EA (Conforme exemplo)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Preço Unitário</label>
                            <input type="number" min="0" required className="w-full border rounded-xl p-3 text-sm font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none" value={newMaterial.price || ''} onChange={e => setNewMaterial({...newMaterial, price: Number(e.target.value)})} />
                        </div>
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
