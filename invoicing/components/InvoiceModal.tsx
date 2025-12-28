
import React, { useState } from 'react';
import { DraftInvoice, Client, Material, Invoice, InvoiceType, SystemSettings } from '../../types';
import { useInvoiceDraft } from '../hooks/useInvoiceDraft';
import { Plus, Trash2, Send, Save, AlertTriangle, RotateCcw, Lock, Percent, CalendarClock } from 'lucide-react';
import Modal from '../../components/Modal';
import { db } from '../../services/db';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    draftState: ReturnType<typeof useInvoiceDraft>; // Using the hook's return type for props
    clients: Client[];
    materials: Material[];
    invoices: Invoice[]; // For reference in NC
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ 
    isOpen, onClose, draftState, clients, materials, invoices 
}) => {
    const { 
        draft, applyRetention, isIssuing, errors, 
        setType, setDate, setClient, addItem, removeItem, toggleRetention, 
        setReferenceInvoice, setReason, saveDraft, finalize, isReadOnly 
    } = draftState;

    // Acesso seguro às settings via db cache síncrono para esta modal (idealmente viria via props, mas para evitar prop drilling massivo)
    // Num refactor maior, settings deveria vir via Context.
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    React.useEffect(() => {
        db.settings.get().then(setSettings);
    }, []);

    const [selectedMatId, setSelectedMatId] = useState('');
    const [qty, setQty] = useState(1);
    const [customPrice, setCustomPrice] = useState<number>(0);

    const handleMaterialSelect = (id: string) => {
        setSelectedMatId(id);
        const m = materials.find(x => x.id === Number(id));
        if (m) {
            setCustomPrice(m.price);
        }
    };

    const handleAddItem = () => {
        const m = materials.find(x => x.id === Number(selectedMatId));
        if (m) {
            addItem(m, qty, customPrice);
            setSelectedMatId('');
            setQty(1);
            setCustomPrice(0);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={draft.status === 'Rascunho' ? "Novo Documento (Rascunho)" : "Detalhes do Documento"}>
            <div className="flex flex-col max-h-[85vh]">
                {/* READ ONLY BANNER */}
                {isReadOnly && (
                    <div className="bg-gray-100 p-3 mb-4 rounded-lg flex items-center gap-2 text-xs font-bold text-gray-600 border border-gray-300">
                        <Lock size={14}/> Este documento foi emitido e não pode ser alterado.
                    </div>
                )}

                {/* Validation Errors */}
                {errors.length > 0 && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                        <div className="flex items-center gap-2 text-red-700 font-bold text-sm"><AlertTriangle size={16}/> Erros de Validação:</div>
                        <ul className="list-disc pl-5 text-xs text-red-600 mt-1">
                            {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                        </ul>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Tipo de Documento</label>
                        <select disabled={isReadOnly} className="w-full border rounded-xl p-3 text-sm font-bold bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-500" value={draft.type} onChange={e => setType(e.target.value as InvoiceType)}>
                            <option value="FTE">Fatura (FTE)</option>
                            <option value="FRE">Fatura-Recibo (FRE)</option>
                            <option value="TVE">Talão de Venda (TVE)</option>
                            <option value="NCE">Nota de Crédito (NCE)</option>
                        </select>
                    </div>
                    
                    {/* DATA MANUAL SE ATIVADO NAS SETTINGS */}
                    {settings?.fiscalConfig?.allowManualInvoiceDate ? (
                        <div>
                            <label className="text-[10px] font-black text-orange-500 uppercase block mb-1 flex items-center gap-1"><CalendarClock size={12}/> Data Emissão (Manual)</label>
                            <input 
                                type="date" 
                                disabled={isReadOnly} 
                                className="w-full border border-orange-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none disabled:bg-gray-100 disabled:text-gray-500" 
                                value={draft.date} 
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="hidden md:block"></div> // Spacer se data manual desativada
                    )}

                    <div className={`${settings?.fiscalConfig?.allowManualInvoiceDate ? 'md:col-span-1' : 'md:col-span-2'}`}>
                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Cliente</label>
                        <select disabled={isReadOnly} className="w-full border rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-500" value={draft.clientId || ''} onChange={e => { const c = clients.find(cl=>cl.id===Number(e.target.value)); if(c) setClient(c); }}>
                            <option value="">Selecione o destinatário...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.company} (NIF: {c.nif})</option>)}
                        </select>
                    </div>
                </div>

                {/* NC Specifics */}
                {draft.type === 'NCE' && (
                    <div className="bg-red-50 p-4 rounded-xl border border-red-200 mb-6">
                        <h4 className="text-xs font-bold text-red-700 uppercase mb-3 flex items-center gap-2"><RotateCcw size={14}/> Dados da Retificação</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-red-400 uppercase block mb-1">Referente à Fatura</label>
                                <select disabled={isReadOnly} className="w-full border border-red-200 rounded-lg p-2 text-sm disabled:bg-gray-100" value={draft.relatedInvoiceId || ''} onChange={e => { const i = invoices.find(inv=>inv.id===e.target.value); if(i) setReferenceInvoice(i); }}>
                                    <option value="">Selecione a fatura original...</option>
                                    {invoices.filter(i => i.type !== 'NCE' && i.status !== 'Rascunho').map(i => (
                                        <option key={i.id} value={i.id}>{i.id} - {i.clientName} ({i.total} CVE)</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-red-400 uppercase block mb-1">Motivo da Retificação</label>
                                <input disabled={isReadOnly} className="w-full border border-red-200 rounded-lg p-2 text-sm disabled:bg-gray-100" placeholder="Ex: Erro no preço, Devolução..." value={draft.reason || ''} onChange={e => setReason(e.target.value)} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-4">
                    {!isReadOnly && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Adicionar Item</label>
                                <select className="w-full border rounded-xl p-3 text-sm bg-white" value={selectedMatId} onChange={e => handleMaterialSelect(e.target.value)}>
                                    <option value="">Procurar Material / Serviço...</option>
                                    {materials.map(m => <option key={m.id} value={m.id}>{m.internalCode ? `[${m.internalCode}] ` : ''}{m.name} ({m.price} CVE)</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <div className="w-28">
                                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Preço</label>
                                    <input 
                                        type="number" 
                                        className="w-full border rounded-xl p-3 text-sm text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={customPrice} 
                                        onChange={e => setCustomPrice(Number(e.target.value))} 
                                    />
                                </div>
                                <div className="w-20">
                                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Qtd</label>
                                    <input type="number" className="w-full border rounded-xl p-3 text-sm text-center" value={qty} onChange={e => setQty(Number(e.target.value))} />
                                </div>
                                <button onClick={handleAddItem} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors"><Plus size={20}/></button>
                            </div>
                        </div>
                    )}

                    <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400"><tr><th className="px-4 py-3 text-left">Ref</th><th className="px-4 py-3 text-left">Descrição</th><th className="px-4 py-3 text-center">Qtd</th><th className="px-4 py-3 text-right">P. Unit</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 w-10"></th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {draft.items?.map(item => (
                                    <tr key={item.id}>
                                        <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{item.itemCode}</td>
                                        <td className="px-4 py-3 font-bold text-gray-700">{item.description}</td>
                                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right">{item.unitPrice.toLocaleString()}</td>
                                        <td className={`px-4 py-3 text-right font-black ${item.total < 0 ? 'text-red-600' : 'text-gray-900'}`}>{item.total.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center">
                                            {!isReadOnly && (
                                                <button onClick={() => removeItem(item.id)} className="text-red-300 hover:text-red-600"><Trash2 size={16}/></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="pt-6 border-t mt-6 flex flex-col md:flex-row justify-between gap-6">
                    <div className="space-y-3">
                         <label className={`flex items-center gap-3 p-2 rounded-lg transition-colors group ${isReadOnly ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                             <div className={`w-10 h-5 rounded-full relative transition-colors ${applyRetention ? 'bg-red-500' : 'bg-gray-200'}`} onClick={toggleRetention}>
                                 <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${applyRetention ? 'left-6' : 'left-1'}`}></div>
                             </div>
                             <span className="text-xs font-black uppercase text-gray-500 group-hover:text-red-600 transition-colors flex items-center gap-1">Aplicar Retenção na Fonte (4% IR) <Percent size={12}/></span>
                         </label>
                    </div>
                    <div className="text-right space-y-2 min-w-[200px]">
                         <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase"><span>Subtotal:</span><span>{draft.subtotal?.toLocaleString()} CVE</span></div>
                         {draft.withholdingTotal! > 0 && <div className="flex justify-between text-[10px] font-black text-red-500 uppercase"><span>Retenção (4%):</span><span>-{draft.withholdingTotal?.toLocaleString()} CVE</span></div>}
                         <div className="flex justify-between items-end border-t pt-2"><span className="text-xs font-black text-gray-500 uppercase">Total:</span><span className={`text-2xl font-black ml-4 ${draft.type==='NCE'?'text-red-600':'text-green-700'}`}>{draft.total?.toLocaleString()} CVE</span></div>
                    </div>
                </div>

                <div className="pt-8 flex justify-end gap-3">
                    {!isReadOnly ? (
                        <>
                            <button onClick={saveDraft} className="px-6 py-2 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2"><Save size={16}/> Guardar Rascunho</button>
                            <button onClick={finalize} disabled={isIssuing || (draft.items?.length||0)===0} className="px-8 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-all">
                                {isIssuing ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <Send size={18}/>} 
                                Finalizar e Preparar Envio
                            </button>
                        </>
                    ) : (
                        <button onClick={onClose} className="px-6 py-2 border rounded-xl font-bold text-gray-500">Fechar</button>
                    )}
                </div>
            </div>
        </Modal>
    );
};
