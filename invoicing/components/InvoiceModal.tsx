
import React, { useState, useMemo, useEffect } from 'react';
import { DraftInvoice, Client, Material, Invoice, InvoiceType, SystemSettings } from '../../types';
import { useInvoiceDraft } from '../hooks/useInvoiceDraft';
import { Plus, Trash2, Send, Save, AlertTriangle, RotateCcw, Lock, Percent, CalendarClock, Hash, MapPin, FileText, Check, X, CreditCard } from 'lucide-react';
import Modal from '../../components/Modal';
import { db } from '../../services/db';
import { fiscalService } from '../../services/fiscalService';
import { fiscalRules } from '../services/fiscalRules';
import { SearchableSelect } from '../../components/SearchableSelect';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    draftState: ReturnType<typeof useInvoiceDraft>; 
    clients: Client[];
    materials: Material[];
    invoices: Invoice[]; 
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ 
    isOpen, onClose, draftState, clients, materials, invoices 
}) => {
    const { 
        draft, applyRetention, isIssuing, errors, 
        setType, setDate, setClient, setClientNif, setClientAddress, setNotes, 
        addItem, removeItem, toggleRetention, 
        setReferenceInvoice, setReason, setPaymentMethod, saveDraft, finalize, isReadOnly 
    } = draftState;

    const [settings, setSettings] = useState<SystemSettings | null>(null);
    useEffect(() => {
        db.settings.get().then(setSettings);
    }, []);

    const [selectedMatId, setSelectedMatId] = useState('');
    const [qty, setQty] = useState(1);
    const [customPrice, setCustomPrice] = useState<number>(0);

    const clientOptions = useMemo(() => clients.map(c => ({
        value: c.id,
        label: c.company,
        subLabel: `NIF: ${c.nif || 'N/A'}`
    })), [clients]);

    const materialOptions = useMemo(() => materials.map(m => ({
        value: m.id,
        label: m.name,
        subLabel: `${m.price.toLocaleString()} CVE`
    })), [materials]);

    const invoiceOptions = useMemo(() => invoices
        .filter(i => i.type !== 'NCE' && i.status !== 'Rascunho')
        .map(i => ({
            value: i.id,
            label: `${i.id} - ${i.clientName}`,
            subLabel: `Total: ${i.total.toLocaleString()} CVE`
        })), 
    [invoices]);

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

    const isNifValid = draft.clientNif ? fiscalService.isValidNIF(draft.clientNif) : false;
    const showNifSuccess = draft.clientNif && isNifValid;
    const showNifError = draft.clientNif && !isNifValid;

    const isAutoPaid = fiscalRules.isAutoPaid(draft.type);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={draft.status === 'Rascunho' ? "Novo Documento (Rascunho)" : "Detalhes do Documento"}>
            <div className="flex flex-col h-[85vh]">
                
                {/* Scrollable Container for the upper part (Headers + Configs) */}
                <div className="shrink-0 overflow-y-auto max-h-[40vh] border-b border-gray-100 pb-4 mb-4 pr-2">
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

                    {/* LINHA 1: TIPO, DATA, CLIENTE */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Tipo de Documento</label>
                            <select disabled={isReadOnly} className="w-full border rounded-xl p-3 text-sm font-bold bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-500" value={draft.type} onChange={e => setType(e.target.value as InvoiceType)}>
                                <option value="FTE">Fatura (FTE)</option>
                                <option value="FRE">Fatura-Recibo (FRE)</option>
                                <option value="TVE">Talão de Venda (TVE)</option>
                                <option value="NCE">Nota de Crédito (NCE)</option>
                            </select>
                        </div>
                        
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
                            <div className="hidden md:block"></div>
                        )}

                        <div className={`${settings?.fiscalConfig?.allowManualInvoiceDate ? 'md:col-span-1' : 'md:col-span-2'}`}>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Cliente</label>
                            <SearchableSelect
                                options={clientOptions}
                                value={draft.clientId || ''}
                                onChange={(val) => { const c = clients.find(cl => cl.id === Number(val)); if (c) setClient(c); }}
                                placeholder="Procurar Cliente..."
                                disabled={isReadOnly}
                            />
                        </div>
                    </div>

                    {/* LINHA 2: DETALHES DO CLIENTE */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="md:col-span-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1 flex items-center gap-1"><Hash size={12}/> NIF Consumidor</label>
                            <div className="relative">
                                <input 
                                    disabled={isReadOnly} 
                                    type="text" 
                                    maxLength={9}
                                    className={`w-full border rounded-lg p-2.5 text-sm font-mono focus:ring-2 outline-none disabled:bg-gray-100 disabled:text-gray-500 bg-white ${
                                        !isReadOnly && showNifError ? 'border-red-300 focus:ring-red-500' : 
                                        !isReadOnly && showNifSuccess ? 'border-green-300 focus:ring-green-500' : 'focus:ring-blue-500'
                                    }`}
                                    placeholder="999999999"
                                    value={draft.clientNif || ''} 
                                    onChange={e => setClientNif(e.target.value)}
                                />
                                {!isReadOnly && (
                                    <div className="absolute right-3 top-2.5 pointer-events-none">
                                        {showNifSuccess && <Check size={16} className="text-green-500"/>}
                                        {showNifError && <X size={16} className="text-red-500"/>}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1 flex items-center gap-1"><MapPin size={12}/> Morada / Contacto</label>
                            <input 
                                disabled={isReadOnly} 
                                type="text" 
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-500 bg-white" 
                                placeholder="Morada completa, telefone..."
                                value={draft.clientAddress || ''} 
                                onChange={e => setClientAddress(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* PAYMENT METHOD SELECTOR (Visible for TVE/FRE) */}
                    {isAutoPaid && (
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200 mb-6">
                            <div className="flex items-center gap-2 mb-3 text-green-700 font-bold text-xs uppercase">
                                <CreditCard size={14}/> Método de Pagamento (Entrada Imediata)
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-green-600 uppercase block mb-1">Método</label>
                                    <select 
                                        disabled={isReadOnly} 
                                        className="w-full border border-green-300 rounded-xl p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500"
                                        value={draft.paymentMethod || 'Dinheiro'}
                                        onChange={e => setPaymentMethod(e.target.value)}
                                    >
                                        {(settings?.paymentMethods || ['Dinheiro', 'Cheque', 'Transferência', 'Vinti4']).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center text-xs text-green-700 italic">
                                    Este valor será registado automaticamente na tesouraria ao emitir.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NC Specifics */}
                    {draft.type === 'NCE' && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-200 mb-6">
                            <h4 className="text-xs font-bold text-red-700 uppercase mb-3 flex items-center gap-2"><RotateCcw size={14}/> Dados da Retificação</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-red-400 uppercase block mb-1">Referente à Fatura</label>
                                    <SearchableSelect
                                        options={invoiceOptions}
                                        value={draft.relatedInvoiceId || ''}
                                        onChange={(val) => { const i = invoices.find(inv => inv.id === val); if (i) setReferenceInvoice(i); }}
                                        placeholder="Procurar Fatura..."
                                        disabled={isReadOnly}
                                        className="border-red-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-red-400 uppercase block mb-1">Motivo da Retificação</label>
                                    <input disabled={isReadOnly} className="w-full border border-red-200 rounded-xl p-3 text-sm disabled:bg-gray-100" placeholder="Ex: Erro no preço, Devolução..." value={draft.reason || ''} onChange={e => setReason(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* LISTA DE ITENS (Flex-1 to take remaining height, min-h-0 to allow scroll) */}
                <div className="flex-1 flex flex-col min-h-0 space-y-4">
                    {!isReadOnly && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row gap-4 items-end shrink-0">
                            <div className="flex-1 w-full">
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Adicionar Item</label>
                                <SearchableSelect
                                    options={materialOptions}
                                    value={selectedMatId}
                                    onChange={handleMaterialSelect}
                                    placeholder="Procurar Material / Serviço..."
                                />
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

                    <div className="border rounded-xl overflow-hidden bg-white shadow-sm flex-1 relative">
                        <div className="absolute inset-0 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 sticky top-0 z-10 shadow-sm"><tr><th className="px-4 py-3 text-left">Ref</th><th className="px-4 py-3 text-left">Descrição</th><th className="px-4 py-3 text-center">Qtd</th><th className="px-4 py-3 text-right">P. Unit</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 w-10"></th></tr></thead>
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
                                    {(!draft.items || draft.items.length === 0) && (
                                        <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Adicione artigos ou serviços acima.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* OBSERVATIONS & TOTALS */}
                <div className="pt-4 border-t mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
                    <div className="space-y-4">
                         <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1 flex items-center gap-1"><FileText size={12}/> Observações / Notas</label>
                            <textarea 
                                disabled={isReadOnly}
                                className="w-full border rounded-xl p-3 text-xs h-16 outline-none focus:ring-2 focus:ring-green-500 resize-none disabled:bg-gray-100"
                                placeholder="Detalhes adicionais, condições de pagamento..."
                                value={draft.notes || ''}
                                onChange={e => setNotes(e.target.value)}
                            />
                         </div>
                         
                         <label className={`flex items-center gap-3 p-2 rounded-lg transition-colors group ${isReadOnly ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                             <div className={`w-10 h-5 rounded-full relative transition-colors ${applyRetention ? 'bg-red-500' : 'bg-gray-200'}`} onClick={toggleRetention}>
                                 <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${applyRetention ? 'left-6' : 'left-1'}`}></div>
                             </div>
                             <span className="text-xs font-black uppercase text-gray-500 group-hover:text-red-600 transition-colors flex items-center gap-1">Aplicar Retenção na Fonte (4% IR) <Percent size={12}/></span>
                         </label>
                    </div>
                    
                    <div className="text-right space-y-1">
                         <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase"><span>Subtotal:</span><span>{draft.subtotal?.toLocaleString()} CVE</span></div>
                         {draft.withholdingTotal! > 0 && <div className="flex justify-between text-[10px] font-black text-red-500 uppercase"><span>Retenção (4%):</span><span>-{draft.withholdingTotal?.toLocaleString()} CVE</span></div>}
                         <div className="flex justify-between items-end border-t pt-2 mt-2"><span className="text-xs font-black text-gray-500 uppercase">Total:</span><span className={`text-2xl font-black ml-4 ${draft.type==='NCE'?'text-red-600':'text-green-700'}`}>{draft.total?.toLocaleString()} CVE</span></div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 shrink-0">
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
