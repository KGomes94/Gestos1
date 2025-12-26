
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, InvoiceItem, InvoiceType, Client, Material, SystemSettings, Transaction, RecurringContract, AccountType } from '../types';
import { FileText, Plus, Search, Printer, Send, AlertCircle, CheckCircle2, MoreVertical, Trash2, ArrowLeft, Download, ShieldCheck, CreditCard, Hash, Percent, LayoutDashboard, Repeat, CalendarCheck, BarChart4, DollarSign } from 'lucide-react';
import Modal from './Modal';
import { db } from '../services/db';
import { useNotification } from '../contexts/NotificationContext';
import { fiscalService } from '../services/fiscalService';
import { printService } from '../services/printService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface InvoicingModuleProps {
    clients: Client[];
    materials: Material[];
    settings: SystemSettings;
    setTransactions: any;
    invoices: Invoice[];
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
    recurringContracts: RecurringContract[];
    setRecurringContracts: React.Dispatch<React.SetStateAction<RecurringContract[]>>;
}

const InvoicingModule: React.FC<InvoicingModuleProps> = ({ clients = [], materials = [], settings, setTransactions, invoices = [], setInvoices, recurringContracts = [], setRecurringContracts }) => {
    const { notify } = useNotification();
    const [subView, setSubView] = useState<'dashboard' | 'list' | 'recurring'>('dashboard');
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isIssuing, setIsIssuing] = useState(false);

    // Helper seguro para datas
    const safeDate = (dateStr: string | undefined | null) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-PT');
    };

    // Form State for Invoice
    const [newInv, setNewInv] = useState<Partial<Invoice>>({
        type: 'FTE', date: new Date().toISOString().split('T')[0],
        items: [], subtotal: 0, taxTotal: 0, withholdingTotal: 0, total: 0, status: 'Rascunho'
    });

    const [selectedMatId, setSelectedMatId] = useState('');
    const [qty, setQty] = useState(1);
    const [applyRetention, setApplyRetention] = useState(false);

    // Payment Modal
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
    const [payMethod, setPayMethod] = useState('Transferência');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    // Recurring Contract State
    const [isRecurModalOpen, setIsRecurModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Partial<RecurringContract>>({ frequency: 'Mensal', active: true, items: [], nextRun: new Date().toISOString().split('T')[0] });

    const calculateTotals = (items: InvoiceItem[], retentionActive: boolean) => {
        const sub = items.reduce((a, b) => a + ((b.unitPrice || 0) * (b.quantity || 0)), 0);
        const tax = items.reduce((a, b) => a + ((b.unitPrice || 0) * (b.quantity || 0) * ((b.taxRate || 0) / 100)), 0);
        const withholding = retentionActive ? (sub * 0.04) : 0;
        return { sub, tax, withholding, total: (sub + tax) - withholding };
    };

    // --- DASHBOARD DATA ---
    const dashboardStats = useMemo(() => {
        const validInvoices = Array.isArray(invoices) ? invoices : [];
        const totalInvoiced = validInvoices.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
        const pendingValue = validInvoices.filter(i => i.status === 'Emitida').reduce((acc, i) => acc + (Number(i.total) || 0), 0);
        const draftCount = validInvoices.filter(i => i.status === 'Rascunho').length;
        
        // Chart Data (Monthly)
        const currentYear = new Date().getFullYear();
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const chartData = months.map((m, idx) => {
            const monthInvoices = validInvoices.filter(i => {
                if (!i.date) return false;
                const d = new Date(i.date);
                if (isNaN(d.getTime())) return false;
                return d.getMonth() === idx && d.getFullYear() === currentYear;
            });
            return {
                name: m,
                faturado: monthInvoices.reduce((acc, i) => acc + (Number(i.total) || 0), 0),
                pago: monthInvoices.filter(i => i.status === 'Paga').reduce((acc, i) => acc + (Number(i.total) || 0), 0)
            };
        });

        return { totalInvoiced, pendingValue, draftCount, chartData };
    }, [invoices]);

    // --- INVOICE HANDLERS ---
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
        const num = db.invoices.getNextNumber(settings.fiscalConfig?.invoiceSeries || 'A');
        const series = settings.fiscalConfig?.invoiceSeries || 'A';
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

            // Integração Financeira (FRE e TVE são recibos imediatos)
            if (newInv.type === 'FRE' || newInv.type === 'TVE') {
                createTransaction(finalInvoice, 'Pago');
            }

            setIsModalOpen(false);
            notify('success', `Fatura emitida e comunicada à DNRE.`);
        } catch (e) {
            notify('error', 'Erro na comunicação fiscal.');
        } finally {
            setIsIssuing(false);
        }
    };

    const createTransaction = (inv: Invoice, status: 'Pago' | 'Pendente', method = 'Transferência', date = inv.date) => {
        const tx: Transaction = {
            id: Date.now(),
            date: date || new Date().toISOString().split('T')[0],
            description: `Faturação Ref: ${inv.id} - ${inv.clientName}`,
            reference: inv.id,
            type: method as any,
            category: 'Receita Operacional',
            income: inv.total,
            expense: null,
            status: status,
            clientId: inv.clientId,
            clientName: inv.clientName,
            invoiceId: inv.id
        };
        setTransactions((prev: Transaction[]) => [tx, ...prev]);
    };

    const handleRegisterPayment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!payInvoice) return;

        // Update Invoice Status
        setInvoices(prev => prev.map(i => i.id === payInvoice.id ? { ...i, status: 'Paga' } : i));

        // Create Transaction
        createTransaction(payInvoice, 'Pago', payMethod, payDate);

        notify('success', 'Pagamento registado e transação criada.');
        setIsPayModalOpen(false);
        setPayInvoice(null);
    };

    // --- RECURRING CONTRACT HANDLERS ---
    const handleSaveContract = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingContract.clientId || (editingContract.items || []).length === 0) {
            notify('error', 'Cliente e Itens obrigatórios.');
            return;
        }
        
        const client = clients.find(c => c.id === editingContract.clientId);
        const amount = (editingContract.items || []).reduce((a, b) => a + (b.total || 0), 0);

        const contract: RecurringContract = {
            ...editingContract as RecurringContract,
            id: editingContract.id || `AV-${Date.now()}`,
            clientName: client?.company || 'Cliente',
            amount: amount
        };

        if (editingContract.id) {
            setRecurringContracts(prev => prev.map(c => c.id === contract.id ? contract : c));
        } else {
            setRecurringContracts(prev => [...prev, contract]);
        }
        setIsRecurModalOpen(false);
        notify('success', 'Avença configurada.');
    };

    const handleAddContractItem = () => {
        const m = materials.find(x => x.id === Number(selectedMatId));
        if (!m) return;
        const item: InvoiceItem = { 
            id: Date.now(), 
            description: m.name, 
            quantity: qty, 
            unitPrice: m.price, 
            taxRate: settings.defaultTaxRate, 
            total: m.price * qty 
        };
        setEditingContract(prev => ({ ...prev, items: [...(prev.items || []), item] }));
        setSelectedMatId(''); setQty(1);
    };

    const filteredInvoices = (Array.isArray(invoices) ? invoices : []).filter(i => 
        (i.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (i.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.iud && i.iud.includes(searchTerm))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><CreditCard className="text-green-600"/> Faturação Certificada</h2>
                    <p className="text-gray-500 text-sm">Norma DNRE v10.0 - Em Conformidade</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg border">
                    <button onClick={() => setSubView('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'dashboard' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><LayoutDashboard size={16} /> Dash</button>
                    <button onClick={() => setSubView('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'list' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><FileText size={16} /> Faturas</button>
                    <button onClick={() => setSubView('recurring')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'recurring' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><Repeat size={16} /> Avenças</button>
                </div>
            </div>

            {subView === 'dashboard' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Faturado</div>
                            <div className="text-2xl font-black text-gray-900">{dashboardStats.totalInvoiced.toLocaleString()} CVE</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Valores Pendentes</div>
                            <div className="text-2xl font-black text-orange-600">{dashboardStats.pendingValue.toLocaleString()} CVE</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Rascunhos</div>
                            <div className="text-2xl font-black text-blue-600">{dashboardStats.draftCount} docs</div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-[350px]">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><BarChart4 size={18}/> Evolução Mensal</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={dashboardStats.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                                <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
                                <Bar dataKey="faturado" fill="#3b82f6" name="Faturado" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="pago" fill="#22c55e" name="Pago" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {subView === 'list' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center gap-4 bg-gray-50/50">
                        <div className="relative flex-1 max-w-md">
                            <input type="text" placeholder="IUD ou Nº..." className="pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                        </div>
                        <button onClick={() => { setNewInv({ type: 'FTE', date: new Date().toISOString().split('T')[0], items: [], subtotal: 0, taxTotal: 0, withholdingTotal: 0, total: 0 }); setApplyRetention(false); setIsModalOpen(true); }} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100">
                            <Plus size={18} /> Novo Documento
                        </button>
                    </div>
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black">
                            <tr>
                                <th className="px-6 py-4 text-left">Documento / IUD</th>
                                <th className="px-6 py-4 text-left">Data</th>
                                <th className="px-6 py-4 text-left">Cliente</th>
                                <th className="px-6 py-4 text-right">Total Líquido</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredInvoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-gray-50 group">
                                    <td className="px-6 py-4">
                                        <div className="font-black text-gray-800">{inv.id}</div>
                                        <div className="font-mono text-[9px] text-green-700 truncate max-w-[150px]">{inv.iud || 'PENDENTE'}</div>
                                        {inv.isRecurring && <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded ml-1">AVENÇA</span>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{safeDate(inv.date)}</td>
                                    <td className="px-6 py-4 font-bold text-gray-700">{inv.clientName}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-black text-gray-900">{(inv.total || 0).toLocaleString()} CVE</div>
                                        {inv.withholdingTotal > 0 && <div className="text-[10px] text-red-500 font-bold">Ret: -{(inv.withholdingTotal || 0).toLocaleString()}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            inv.status === 'Paga' ? 'bg-green-100 text-green-700' : 
                                            inv.status === 'Emitida' ? 'bg-orange-100 text-orange-700' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {inv.status === 'Emitida' && (
                                                <button onClick={() => { setPayInvoice(inv); setPayDate(new Date().toISOString().split('T')[0]); setIsPayModalOpen(true); }} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-colors" title="Registar Pagamento"><DollarSign size={16}/></button>
                                            )}
                                            <button onClick={() => window.alert(`IUD: ${inv.iud}`)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"><Printer size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {subView === 'recurring' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="flex justify-end">
                        <button onClick={() => { setEditingContract({ frequency: 'Mensal', active: true, items: [], nextRun: new Date().toISOString().split('T')[0] }); setIsRecurModalOpen(true); }} className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all flex items-center gap-2">
                            <Plus size={16}/> Nova Avença
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(Array.isArray(recurringContracts) ? recurringContracts : []).map(c => (
                            <div key={c.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between hover:shadow-md transition-shadow">
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.active ? 'Ativo' : 'Inativo'}</span>
                                        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">{c.frequency}</span>
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">{c.clientName}</h3>
                                    <p className="text-xs text-gray-500 mb-4">{c.description || 'Sem descrição'}</p>
                                    <div className="space-y-2 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="flex justify-between"><span>Próxima Emissão:</span> <span className="font-bold">{safeDate(c.nextRun)}</span></div>
                                        <div className="flex justify-between"><span>Valor:</span> <span className="font-bold text-green-700">{(c.amount || 0).toLocaleString()} CVE</span></div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t flex justify-end gap-2">
                                    <button onClick={() => { setEditingContract(c); setIsRecurModalOpen(true); }} className="text-blue-600 text-xs font-bold uppercase hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">Editar</button>
                                </div>
                            </div>
                        ))}
                        {(Array.isArray(recurringContracts) ? recurringContracts : []).length === 0 && (
                            <div className="col-span-full p-12 text-center text-gray-400 italic bg-gray-50 rounded-2xl border border-dashed border-gray-300">Nenhum contrato recorrente configurado.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Issue Invoice */}
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
                                            <td className="px-4 py-3 text-right">{(item.unitPrice || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-black">{((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString()}</td>
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
                             <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase"><span>Subtotal:</span><span>{(newInv.subtotal || 0).toLocaleString()} CVE</span></div>
                             {(newInv.withholdingTotal || 0) > 0 && <div className="flex justify-between text-[10px] font-black text-red-500 uppercase"><span>Retenção (4%):</span><span>-{(newInv.withholdingTotal || 0).toLocaleString()} CVE</span></div>}
                             <div className="flex justify-between items-end border-t pt-2"><span className="text-xs font-black text-gray-500 uppercase">Total a Pagar:</span><span className="text-2xl font-black text-green-700 ml-4">{(newInv.total || 0).toLocaleString()} CVE</span></div>
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

            {/* Modal Register Payment */}
            <Modal isOpen={isPayModalOpen} onClose={() => setIsPayModalOpen(false)} title="Registar Pagamento">
                <form onSubmit={handleRegisterPayment} className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-xl border border-green-100 mb-4">
                        <p className="text-xs font-bold text-green-800 uppercase">Documento</p>
                        <p className="font-black text-lg">{payInvoice?.id}</p>
                        <p className="text-sm text-gray-600">{payInvoice?.clientName}</p>
                        <p className="text-right font-black text-xl text-green-700">{(payInvoice?.total || 0).toLocaleString()} CVE</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data do Pagamento</label>
                        <input type="date" required className="w-full border rounded-lg p-2" value={payDate} onChange={e => setPayDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método</label>
                        <select className="w-full border rounded-lg p-2" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                            {(settings.paymentMethods || ['Dinheiro', 'Cheque', 'Transferência']).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t">
                        <button type="button" onClick={() => setIsPayModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Cancelar</button>
                        <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold">Confirmar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default InvoicingModule;
