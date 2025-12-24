
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, InvoiceItem, InvoiceType, Client, Material, SystemSettings, Transaction } from '../types';
import { FileText, Plus, Search, Printer, Send, AlertCircle, CheckCircle2, MoreVertical, Trash2, ArrowLeft, Download, ShieldCheck, CreditCard, Hash, Percent } from 'lucide-react';
import Modal from './Modal';
import { db } from '../services/db';
import { useNotification } from '../contexts/NotificationContext';
import { fiscalService } from '../services/fiscalService';
import { printService } from '../services/printService';

interface InvoicingModuleProps {
    clients: Client[];
    materials: Material[];
    settings: SystemSettings;
    setTransactions: any;
}

const InvoicingModule: React.FC<InvoicingModuleProps> = ({ clients, materials, settings, setTransactions }) => {
    const { notify } = useNotification();
    const [invoices, setInvoices] = useState<Invoice[]>(() => db.invoices.getAll());
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isIssuing, setIsIssuing] = useState(false);

    // Form State
    const [newInv, setNewInv] = useState<Partial<Invoice>>({
        type: 'FTE', date: new Date().toISOString().split('T')[0],
        items: [], subtotal: 0, taxTotal: 0, withholdingTotal: 0, total: 0, status: 'Rascunho'
    });

    const [selectedMatId, setSelectedMatId] = useState('');
    const [qty, setQty] = useState(1);
    const [applyRetention, setApplyRetention] = useState(false);

    useEffect(() => { db.invoices.save(invoices); }, [invoices]);

    const calculateTotals = (items: InvoiceItem[], retentionActive: boolean) => {
        const sub = items.reduce((a, b) => a + (b.unitPrice * b.quantity), 0);
        // Exemplo XML: TaxTypeCode="NA" para IVA se houver Isenção (REMPE), mas IR é calculado sobre o total líquido.
        const tax = items.reduce((a, b) => a + (b.unitPrice * b.quantity * (b.taxRate / 100)), 0);
        
        // Retenção de 4% (Conforme exemplo XML e padrão REMPE Cabo Verde)
        const withholding = retentionActive ? (sub * 0.04) : 0;
        
        return { sub, tax, withholding, total: (sub + tax) - withholding };
    };

    const handleAddItem = () => {
        const m = materials.find(x => x.id === Number(selectedMatId));
        if (!m) return;
        const item: InvoiceItem = { 
            id: Date.now(), 
            description: m.name, 
            itemCode: m.internalCode || 'N/A',
            quantity: qty, 
            unitPrice: m.price, 
            taxRate: settings.defaultTaxRate, 
            total: m.price * qty 
        };
        const updatedItems = [...(newInv.items || []), item];
        const res = calculateTotals(updatedItems, applyRetention);
        setNewInv({ ...newInv, items: updatedItems, subtotal: res.sub, taxTotal: res.tax, withholdingTotal: res.withholding, total: res.total });
        setSelectedMatId(''); setQty(1);
    };

    const toggleRetention = () => {
        const newStatus = !applyRetention;
        setApplyRetention(newStatus);
        const res = calculateTotals(newInv.items || [], newStatus);
        setNewInv({ ...newInv, subtotal: res.sub, taxTotal: res.tax, withholdingTotal: res.withholding, total: res.total });
    };

    const handleIssue = async () => {
        if (!newInv.clientId || (newInv.items || []).length === 0) {
            notify('error', 'Selecione um cliente e adicione itens.');
            return;
        }

        setIsIssuing(true);
        const client = clients.find(c => c.id === Number(newInv.clientId));
        const num = db.invoices.getNextNumber(settings.fiscalConfig.invoiceSeries);
        const series = settings.fiscalConfig.invoiceSeries;
        const invDisplayId = `${newInv.type} ${series}${new Date().getFullYear()}/${num.toString().padStart(3, '0')}`;

        const invoiceData: Invoice = {
            ...newInv,
            id: invDisplayId,
            internalId: num,
            typeCode: fiscalService.getTypeCode(newInv.type as InvoiceType),
            clientName: client?.company || client?.name || 'Desconhecido',
            clientNif: client?.nif || '',
            clientAddress: client?.address || '',
            status: 'Emitida',
            fiscalStatus: 'Pendente',
            iud: ''
        } as Invoice;

        try {
            const fiscalResponse = await fiscalService.communicateInvoice(invoiceData, settings);
            const finalInvoice = { ...invoiceData, ...fiscalResponse };

            setInvoices(prev => [finalInvoice, ...prev]);

            // Integração Financeira
            if (newInv.type === 'FRE' || newInv.type === 'TVE') {
                const tx: Transaction = {
                    id: Date.now(),
                    date: invoiceData.date,
                    description: `Faturação Ref: ${invDisplayId}`,
                    reference: invDisplayId,
                    type: 'Transferência',
                    category: 'Serviços',
                    income: invoiceData.total,
                    expense: null,
                    status: 'Pago',
                    clientId: invoiceData.clientId,
                    clientName: invoiceData.clientName,
                    invoiceId: invDisplayId
                };
                setTransactions((prev: Transaction[]) => [tx, ...prev]);
            }

            setIsModalOpen(false);
            notify('success', `Fatura emitida e comunicada à DNRE.`);
        } catch (e) {
            notify('error', 'Erro na comunicação fiscal.');
        } finally {
            setIsIssuing(false);
        }
    };

    const filteredInvoices = invoices.filter(i => 
        i.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        i.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.iud && i.iud.includes(searchTerm))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><CreditCard className="text-green-600"/> Faturação Certificada</h2>
                    <p className="text-gray-500 text-sm">Norma DNRE v10.0 - Em Conformidade</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <input type="text" placeholder="IUD ou Nº..." className="pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    </div>
                    <button onClick={() => { setNewInv({ type: 'FTE', date: new Date().toISOString().split('T')[0], items: [], subtotal: 0, taxTotal: 0, withholdingTotal: 0, total: 0 }); setApplyRetention(false); setIsModalOpen(true); }} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100">
                        <Plus size={18} /> Novo Documento
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black">
                        <tr>
                            <th className="px-6 py-4 text-left">Documento / IUD</th>
                            <th className="px-6 py-4 text-left">Data</th>
                            <th className="px-6 py-4 text-left">Cliente</th>
                            <th className="px-6 py-4 text-right">Total Líquido</th>
                            <th className="px-6 py-4 text-center">Estado DNRE</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredInvoices.map(inv => (
                            <tr key={inv.id} className="hover:bg-gray-50 group">
                                <td className="px-6 py-4">
                                    <div className="font-black text-gray-800">{inv.id}</div>
                                    <div className="font-mono text-[9px] text-green-700 truncate max-w-[150px]">{inv.iud || 'PENDENTE'}</div>
                                </td>
                                <td className="px-6 py-4 text-gray-600">{new Date(inv.date).toLocaleDateString('pt-PT')}</td>
                                <td className="px-6 py-4 font-bold text-gray-700">{inv.clientName}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="font-black text-gray-900">{inv.total.toLocaleString()} CVE</div>
                                    {inv.withholdingTotal > 0 && <div className="text-[10px] text-red-500 font-bold">Ret: -{inv.withholdingTotal.toLocaleString()}</div>}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                        inv.fiscalStatus === 'Transmitido' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {inv.fiscalStatus}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => window.alert(`IUD completo: ${inv.iud}`)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"><Printer size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Emitir Fatura (Conformidade DNRE)">
                <div className="flex flex-col max-h-[85vh]">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Tipo</label>
                            <select className="w-full border rounded-xl p-3 text-sm font-bold bg-green-50 focus:ring-2 focus:ring-green-500 outline-none" value={newInv.type} onChange={e => setNewInv({...newInv, type: e.target.value as InvoiceType})}>
                                <option value="FTE">Fatura Eletrónica (FTE)</option>
                                <option value="FRE">Fatura-Recibo (FRE)</option>
                                <option value="TVE">Talão de Venda (TVE)</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Cliente</label>
                            <select className="w-full border rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none" value={newInv.clientId || ''} onChange={e => setNewInv({...newInv, clientId: Number(e.target.value)})}>
                                <option value="">Selecione o destinatário...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.company} (NIF: {c.nif})</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Material / Serviço</label>
                                <select className="w-full border rounded-xl p-3 text-sm bg-white" value={selectedMatId} onChange={e => setSelectedMatId(e.target.value)}>
                                    <option value="">Procurar...</option>
                                    {materials.map(m => <option key={m.id} value={m.id}>{m.internalCode ? `[${m.internalCode}] ` : ''}{m.name} ({m.price} CVE)</option>)}
                                </select>
                            </div>
                            <div className="w-24"><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Qtd</label><input type="number" className="w-full border rounded-xl p-3 text-sm text-center" value={qty} onChange={e => setQty(Number(e.target.value))} /></div>
                            <button onClick={handleAddItem} className="bg-blue-600 text-white p-3 rounded-xl"><Plus size={20}/></button>
                        </div>

                        <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400"><tr><th className="px-4 py-3 text-left">Ref</th><th className="px-4 py-3 text-left">Descrição</th><th className="px-4 py-3 text-center">Qtd</th><th className="px-4 py-3 text-right">P. Unit</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 w-10"></th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {newInv.items?.map(item => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{item.itemCode}</td>
                                            <td className="px-4 py-3 font-bold text-gray-700">{item.description}</td>
                                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                                            <td className="px-4 py-3 text-right">{item.unitPrice.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-black">{(item.quantity * item.unitPrice).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-center"><button onClick={() => {const up=newInv.items?.filter(x=>x.id!==item.id)||[]; const r=calculateTotals(up, applyRetention); setNewInv({...newInv, items:up, ...r});}} className="text-red-300 hover:text-red-600"><Trash2 size={16}/></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="pt-6 border-t mt-6 flex flex-col md:flex-row justify-between gap-6">
                        <div className="space-y-3">
                             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                                 <ShieldCheck className="text-blue-600" size={24}/>
                                 <p className="text-[10px] text-blue-800 font-bold leading-tight">Comunicação direta com o repositório principal da DNRE.</p>
                             </div>
                             <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors group">
                                 <div className={`w-10 h-5 rounded-full relative transition-colors ${applyRetention ? 'bg-red-500' : 'bg-gray-200'}`} onClick={toggleRetention}>
                                     <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${applyRetention ? 'left-6' : 'left-1'}`}></div>
                                 </div>
                                 <span className="text-xs font-black uppercase text-gray-500 group-hover:text-red-600 transition-colors flex items-center gap-1">Aplicar Retenção na Fonte (4% IR) <Percent size={12}/></span>
                             </label>
                        </div>
                        <div className="text-right space-y-2 min-w-[200px]">
                             <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase"><span>Subtotal:</span><span>{newInv.subtotal?.toLocaleString()} CVE</span></div>
                             {newInv.withholdingTotal! > 0 && <div className="flex justify-between text-[10px] font-black text-red-500 uppercase"><span>Retenção (4%):</span><span>-{newInv.withholdingTotal?.toLocaleString()} CVE</span></div>}
                             <div className="flex justify-between items-end border-t pt-2"><span className="text-xs font-black text-gray-500 uppercase">Total a Pagar:</span><span className="text-2xl font-black text-green-700 ml-4">{newInv.total?.toLocaleString()} CVE</span></div>
                        </div>
                    </div>

                    <div className="pt-8 flex justify-end gap-3">
                        <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 border rounded-xl font-bold text-gray-500">Cancelar</button>
                        <button onClick={handleIssue} disabled={isIssuing || (newInv.items?.length||0)===0} className="px-10 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-all">
                            {isIssuing ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> Comunicando...</> : <><Send size={18}/> Emitir Documento</>}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default InvoicingModule;
