
import React, { useState, useEffect } from 'react';
import { Proposal, Client, Material, ProposalItem, ProposalStatus, SystemSettings, HistoryLog } from '../../types';
import Modal from '../Modal';
import { proposalService } from '../../services/proposalService';
import { Plus, Trash2, Save, Printer, Lock, AlertTriangle, FileText, Calculator } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { printService } from '../../services/printService';

interface ProposalFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    proposal: Proposal | null;
    onSave: (p: Proposal) => void;
    clients: Client[];
    materials: Material[];
    settings: SystemSettings;
    readOnly?: boolean;
}

export const ProposalFormModal: React.FC<ProposalFormModalProps> = ({ 
    isOpen, onClose, proposal, onSave, clients, materials, settings, readOnly 
}) => {
    const { user } = useAuth();
    const [tab, setTab] = useState<'header' | 'items' | 'finance' | 'notes' | 'logs'>('header');
    
    // Form State
    const [formData, setFormData] = useState<Partial<Proposal>>({});
    
    // Auxiliary State
    const [selectedMatId, setSelectedMatId] = useState('');
    const [itemQty, setItemQty] = useState(1);
    const [errors, setErrors] = useState<string[]>([]);

    // Initialize Form
    useEffect(() => {
        if (isOpen) {
            setTab('header');
            setErrors([]);
            if (proposal) {
                setFormData({ ...proposal });
            } else {
                // New Proposal Defaults
                const today = new Date();
                const valid = new Date();
                valid.setDate(today.getDate() + (settings.defaultProposalValidityDays || 15));

                setFormData({
                    status: 'Rascunho',
                    date: today.toISOString().split('T')[0],
                    validUntil: valid.toISOString().split('T')[0],
                    items: [],
                    discount: 0,
                    retention: settings.defaultRetentionRate || 0,
                    taxRate: settings.defaultTaxRate || 15,
                    currency: settings.currency || 'CVE',
                    notes: settings.defaultProposalNotes || '',
                    logs: [],
                    version: 1,
                    origin: 'Manual'
                });
            }
        }
    }, [isOpen, proposal, settings]);

    // Recalculate Totals whenever critical fields change
    useEffect(() => {
        if (formData.items) {
            const totals = proposalService.calculateTotals(
                formData.items, 
                formData.discount || 0, 
                formData.retention || 0, 
                formData.taxRate || 15
            );
            setFormData(prev => ({
                ...prev,
                subtotal: totals.subtotal,
                taxTotal: totals.taxTotal,
                total: totals.total
            }));
        }
    }, [formData.items, formData.discount, formData.retention, formData.taxRate]);

    const handleSave = () => {
        const validation = proposalService.validate(formData);
        if (!validation.isValid) {
            setErrors(validation.errors);
            return;
        }

        const log: HistoryLog = proposalService.createLog(
            proposal ? 'Atualização' : 'Criação', 
            `Status: ${formData.status}. Total: ${formData.total?.toFixed(0)}`, 
            user?.name
        );

        onSave({ 
            ...formData as Proposal, 
            logs: [log, ...(formData.logs || [])] 
        });
        onClose();
    };

    const handleAddItem = () => {
        const m = materials.find(x => x.id === Number(selectedMatId));
        if (!m) return;

        const newItem: ProposalItem = {
            id: Date.now(),
            type: 'Material',
            description: m.name,
            quantity: itemQty,
            unitPrice: m.price,
            total: m.price * itemQty,
            taxRate: settings.defaultTaxRate // Default tax
        };

        setFormData(prev => ({
            ...prev,
            items: [...(prev.items || []), newItem]
        }));
        setSelectedMatId('');
        setItemQty(1);
    };

    const handleRemoveItem = (id: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items?.filter(i => i.id !== id)
        }));
    };

    // Client Selection Handler - Snapshot Logic
    const handleClientChange = (clientId: number) => {
        const c = clients.find(cl => cl.id === clientId);
        if (c) {
            setFormData(prev => ({
                ...prev,
                clientId: c.id,
                clientName: c.company,
                clientNif: c.nif,
                clientAddress: c.address,
                clientEmail: c.email
            }));
        }
    };

    if (!isOpen) return null;

    const isLocked = readOnly || (proposal && !proposalService.isEditable(proposal, settings));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Proposta ${formData.id || '(Nova)'} ${isLocked ? '[Leitura]' : ''}`}>
            <div className="flex flex-col h-[85vh]">
                
                {/* Header Tabs */}
                <div className="flex border-b mb-4 overflow-x-auto bg-gray-50 rounded-t-lg shrink-0">
                    {[
                        { id: 'header', label: 'Cabeçalho' },
                        { id: 'items', label: 'Itens & Serviços' },
                        { id: 'finance', label: 'Totais & Condições' },
                        { id: 'notes', label: 'Notas' },
                        { id: 'logs', label: 'Auditoria' }
                    ].map(t => (
                        <button 
                            key={t.id} 
                            onClick={() => setTab(t.id as any)} 
                            className={`px-6 py-3 text-xs font-black uppercase border-b-2 transition-all ${tab === t.id ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Validation Errors */}
                {errors.length > 0 && (
                    <div className="bg-red-50 p-3 mb-4 rounded border border-red-200 text-red-700 text-xs font-bold">
                        <div className="flex items-center gap-2 mb-1"><AlertTriangle size={14}/> Por favor corrija os seguintes erros:</div>
                        <ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 pr-4 space-y-6">
                    
                    {/* --- TAB: HEADER --- */}
                    {tab === 'header' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cliente</label>
                                    <select disabled={isLocked} className="w-full border rounded-xl p-3 text-sm font-bold disabled:bg-gray-100" value={formData.clientId || ''} onChange={e => handleClientChange(Number(e.target.value))}>
                                        <option value="">Selecione o Cliente...</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                                    </select>
                                    {formData.clientNif && <p className="text-xs text-gray-400 mt-1 ml-1">NIF: {formData.clientNif} | {formData.clientAddress}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Título da Proposta</label>
                                    <input disabled={isLocked} type="text" className="w-full border rounded-xl p-3 text-sm disabled:bg-gray-100" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Instalação de AC - Sala de Reuniões" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Data Emissão</label>
                                        <input disabled={isLocked} type="date" className="w-full border rounded-xl p-3 text-sm disabled:bg-gray-100" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Válida Até</label>
                                        <input disabled={isLocked} type="date" className="w-full border rounded-xl p-3 text-sm disabled:bg-gray-100" value={formData.validUntil || ''} onChange={e => setFormData({...formData, validUntil: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Estado</label>
                                    <select disabled={isLocked && formData.status !== 'Rascunho'} className="w-full border rounded-xl p-3 text-sm font-bold bg-blue-50 disabled:bg-gray-100 disabled:text-gray-500" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as ProposalStatus})}>
                                        <option value="Rascunho">Rascunho (Em edição)</option>
                                        <option value="Enviada">Enviada (Aguardar resposta)</option>
                                        <option value="Aceite">Aceite (Fechada)</option>
                                        <option value="Rejeitada">Rejeitada (Perdida)</option>
                                        <option value="Expirada">Expirada</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Responsável</label>
                                    <input disabled={isLocked} type="text" className="w-full border rounded-xl p-3 text-sm disabled:bg-gray-100" value={formData.responsible || user?.name || ''} onChange={e => setFormData({...formData, responsible: e.target.value})} />
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Versão:</span> <span className="font-bold">{formData.version || 1}</span></div>
                                    <div className="flex justify-between text-xs text-gray-500"><span>Origem:</span> <span className="font-bold">{formData.origin || 'Manual'}</span></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- TAB: ITEMS --- */}
                    {tab === 'items' && (
                        <div className="space-y-4">
                            {!isLocked && (
                                <div className="flex gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 items-end">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Adicionar Artigo / Serviço</label>
                                        <select className="w-full border rounded-lg p-2 text-sm bg-white" value={selectedMatId} onChange={e => setSelectedMatId(e.target.value)}>
                                            <option value="">Selecione...</option>
                                            {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.price} CVE)</option>)}
                                        </select>
                                    </div>
                                    <div className="w-20">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Qtd</label>
                                        <input type="number" className="w-full border rounded-lg p-2 text-sm text-center" value={itemQty} onChange={e => setItemQty(Number(e.target.value))} />
                                    </div>
                                    <button onClick={handleAddItem} className="bg-green-600 text-white p-2.5 rounded-lg hover:bg-green-700 transition-colors"><Plus size={18}/></button>
                                </div>
                            )}

                            <div className="border rounded-xl overflow-hidden shadow-sm">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100 text-[10px] font-black uppercase text-gray-500">
                                        <tr>
                                            <th className="p-3 text-left">Descrição</th>
                                            <th className="p-3 text-center w-20">Qtd</th>
                                            <th className="p-3 text-right w-32">Preço Unit.</th>
                                            <th className="p-3 text-right w-32">Total</th>
                                            {!isLocked && <th className="p-3 w-10"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {formData.items?.map((item, idx) => (
                                            <tr key={item.id}>
                                                <td className="p-3 font-medium text-gray-700">{item.description}</td>
                                                <td className="p-3 text-center">{item.quantity}</td>
                                                <td className="p-3 text-right">{item.unitPrice.toLocaleString()}</td>
                                                <td className="p-3 text-right font-bold">{item.total.toLocaleString()}</td>
                                                {!isLocked && (
                                                    <td className="p-3 text-center">
                                                        <button onClick={() => handleRemoveItem(item.id)} className="text-red-300 hover:text-red-500"><Trash2 size={16}/></button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                        {(formData.items?.length || 0) === 0 && (
                                            <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Nenhum item adicionado.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* --- TAB: FINANCE --- */}
                    {tab === 'finance' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b pb-2"><Calculator size={16}/> Configuração Fiscal</h4>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Taxa IVA (%)</label>
                                    <input disabled={isLocked} type="number" className="w-full border rounded-xl p-3 text-sm disabled:bg-gray-100" value={formData.taxRate} onChange={e => setFormData({...formData, taxRate: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Desconto Global (%)</label>
                                    <input disabled={isLocked} type="number" className="w-full border rounded-xl p-3 text-sm disabled:bg-gray-100" value={formData.discount} onChange={e => setFormData({...formData, discount: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Retenção na Fonte (%)</label>
                                    <input disabled={isLocked} type="number" className="w-full border rounded-xl p-3 text-sm disabled:bg-gray-100" value={formData.retention} onChange={e => setFormData({...formData, retention: Number(e.target.value)})} />
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-3">
                                <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-2">Resumo Financeiro</h4>
                                <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span> <span>{formData.subtotal?.toLocaleString()} CVE</span></div>
                                <div className="flex justify-between text-sm text-red-600"><span>Desconto</span> <span>-{(formData.subtotal! * (formData.discount! / 100)).toLocaleString()} CVE</span></div>
                                <div className="flex justify-between text-sm text-green-600"><span>Impostos (IVA)</span> <span>+{formData.taxTotal?.toLocaleString()} CVE</span></div>
                                <div className="flex justify-between text-sm text-orange-600"><span>Retenção</span> <span>-{(formData.subtotal! * (formData.retention! / 100)).toLocaleString()} CVE</span></div>
                                <div className="border-t pt-3 mt-2 flex justify-between text-xl font-black text-gray-900"><span>TOTAL</span> <span>{formData.total?.toLocaleString()} CVE</span></div>
                            </div>
                        </div>
                    )}

                    {/* --- TAB: NOTES --- */}
                    {tab === 'notes' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Observações Comerciais (Visível na Proposta)</label>
                                <textarea disabled={isLocked} className="w-full border rounded-xl p-3 h-32 text-sm disabled:bg-gray-100" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Ex: Condições de pagamento: 50% adjudicação..." />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 text-blue-600">Notas Técnicas Internas (Apenas Interno)</label>
                                <textarea disabled={isLocked} className="w-full border rounded-xl p-3 h-24 text-sm bg-blue-50/50 disabled:bg-gray-100" value={formData.technicalNotes || ''} onChange={e => setFormData({...formData, technicalNotes: e.target.value})} placeholder="Ex: Necessário andaime para instalação..." />
                            </div>
                        </div>
                    )}

                    {/* --- TAB: LOGS --- */}
                    {tab === 'logs' && (
                        <div className="space-y-2">
                            {(formData.logs || []).map((log, idx) => (
                                <div key={idx} className="text-xs border-b py-2 flex justify-between text-gray-600">
                                    <span><span className="font-bold">{new Date(log.timestamp).toLocaleString()}</span> - {log.action} ({log.user})</span>
                                    <span className="italic">{log.details}</span>
                                </div>
                            ))}
                            {(formData.logs || []).length === 0 && <p className="text-sm text-gray-400 italic">Sem histórico.</p>}
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t mt-auto flex justify-between items-center shrink-0">
                    <div className="flex gap-2">
                        {proposal && (
                            <button onClick={() => printService.printProposal(proposal, settings)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-gray-200">
                                <Printer size={16}/> Imprimir
                            </button>
                        )}
                        {isLocked && <span className="text-xs text-orange-500 font-bold flex items-center gap-1 ml-2"><Lock size={14}/> Modo Leitura</span>}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50">Fechar</button>
                        {!isLocked && (
                            <button onClick={handleSave} className="px-8 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-green-700 flex items-center gap-2">
                                <Save size={18}/> Guardar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
