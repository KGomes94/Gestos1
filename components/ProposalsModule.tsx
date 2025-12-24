
import React, { useState, useMemo, useEffect } from 'react';
import { Proposal, ProposalItem, Client, Material, ProposalType, ProposalStatus, SystemSettings, ClientType, Appointment, HistoryLog } from '../types';
import { FileText, CheckCircle2, ArrowLeft, Printer, Plus, Trash2, LayoutDashboard, List, Calendar, Search, Edit, MapPin, Phone, Mail, CalendarPlus, TrendingUp, DollarSign, ScrollText, X } from 'lucide-react';
import Modal from './Modal';
import { db } from '../services/db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { printService } from '../services/printService';

interface ProposalsModuleProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    materials: Material[];
    proposals: Proposal[];
    setProposals: React.Dispatch<React.SetStateAction<Proposal[]>>;
    settings: SystemSettings;
    autoOpenId?: string | null;
    onClearAutoOpen?: () => void;
}

const ProposalsModule: React.FC<ProposalsModuleProps> = ({ clients, setClients, materials, proposals, setProposals, settings, autoOpenId, onClearAutoOpen }) => {
  const { notify } = useNotification();
  const { user } = useAuth();
  const [subView, setSubView] = useState<'dashboard' | 'list'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'details' | 'items' | 'totals' | 'logs'>('details');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newProp, setNewProp] = useState<Partial<Proposal>>({
      status: 'Criada', date: new Date().toISOString().split('T')[0],
      items: [], discount: 0, retention: settings.defaultRetentionRate || 0,
      taxRate: settings.defaultTaxRate || 15, notes: settings.defaultProposalNotes || '', logs: []
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [itemQty, setItemQty] = useState(1);

  const handleSaveProposal = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newProp.clientId || (newProp.items || []).length === 0) {
          notify('error', "Selecione um cliente e adicione itens.");
          return;
      }

      const clientObj = clients.find(c => c.id === Number(newProp.clientId));
      const totals = calculateTotals(newProp.items || [], newProp.discount || 0, newProp.retention || 0, newProp.taxRate || 15);
      
      const logEntry: HistoryLog = {
          timestamp: new Date().toISOString(),
          action: editingId ? 'Atualização' : 'Criação',
          details: `Status: ${newProp.status}. Valor Final: ${totals.totalToPay.toLocaleString()} CVE`,
          user: user?.name
      };

      const proposalData = {
          ...newProp,
          clientName: clientObj?.company || 'Desconhecido',
          logs: [logEntry, ...(newProp.logs || [])]
      } as Proposal;

      if (editingId) {
          setProposals(prev => prev.map(p => p.id === editingId ? { ...p, ...proposalData } : p));
      } else {
          const { id, sequence } = db.proposals.getNextId(proposals);
          setProposals(prev => [{ ...proposalData, id, sequence }, ...prev]);
      }

      setIsModalOpen(false);
      notify('success', 'Proposta guardada.');
  };

  const calculateTotals = (items: ProposalItem[], disc: number, ret: number, tax: number) => {
    const subtotal = items.reduce((a, v) => a + v.total, 0);
    const discVal = subtotal * (disc / 100);
    const taxable = subtotal - discVal;
    const taxVal = taxable * (tax / 100);
    const retVal = taxable * (ret / 100);
    return { subtotal, discVal, taxable, taxVal, retVal, totalToPay: taxable + taxVal - retVal };
  };

  const filteredProposals = useMemo(() => {
    return proposals.filter(p => 
        p.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.id?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => b.sequence - a.sequence);
  }, [proposals, searchTerm]);

  const handlePrint = () => {
    if (!newProp.id) return;
    printService.printProposal(newProp as Proposal, settings);
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
            <div><h2 className="text-2xl font-bold text-gray-800">Propostas Comerciais</h2><p className="text-gray-500 text-sm">Gestão de orçamentos e negociações</p></div>
            <div className="flex bg-gray-100 p-1 rounded-lg border">
                <button onClick={() => setSubView('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'dashboard' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><LayoutDashboard size={16} /> Dash</button>
                <button onClick={() => setSubView('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subView === 'list' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}><List size={16} /> Lista</button>
            </div>
       </div>

      {subView === 'dashboard' && ( <div className="p-12 text-center text-gray-400 italic">Estatísticas de vendas e propostas.</div> )}

      {subView === 'list' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in-up">
              <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                  <div className="relative w-64"><input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-3 py-2 border rounded-lg text-sm w-full outline-none focus:ring-2 focus:ring-green-500"/><Search size={16} className="absolute left-3 top-2.5 text-gray-400" /></div>
                  <button onClick={() => {setEditingId(null); setNewProp({status:'Criada', date: new Date().toISOString().split('T')[0], items:[], discount:0, retention: settings.defaultRetentionRate, taxRate: settings.defaultTaxRate, logs:[]}); setModalTab('details'); setIsModalOpen(true);}} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 transition-all"><Plus size={18} /> Nova Proposta</button>
              </div>
              <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black"><tr><th className="px-6 py-4 text-left">ID</th><th className="px-6 py-4 text-left">Data</th><th className="px-6 py-4 text-left">Cliente</th><th className="px-6 py-4 text-right">Total</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-right">Ações</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">{filteredProposals.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-mono font-bold text-gray-500">{p.id}</td>
                        <td className="px-6 py-4 text-gray-600">{new Date(p.date).toLocaleDateString('pt-PT')}</td>
                        <td className="px-6 py-4 font-bold text-gray-800">{p.clientName}</td>
                        <td className="px-6 py-4 text-right font-black text-gray-900">{calculateTotals(p.items, p.taxRate, p.discount, p.retention).totalToPay.toLocaleString()}</td>
                        <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${p.status === 'Aprovada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span></td>
                        <td className="px-6 py-4 text-right"><button onClick={() => {setEditingId(p.id); setNewProp(p); setModalTab('details'); setIsModalOpen(true);}} className="text-green-600 font-bold border border-green-200 px-3 py-1 rounded-lg bg-green-50 hover:bg-green-100">Ver/Editar</button></td>
                      </tr>
                  ))}</tbody>
              </table>
          </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? `Editar Proposta ${editingId}` : "Nova Proposta Comercial"}>
          <div className="flex flex-col max-h-[85vh]">
              <div className="flex border-b mb-6 overflow-x-auto">
                {['details', 'items', 'totals', 'logs'].map((t) => (
                    <button key={t} onClick={() => setModalTab(t as any)} className={`px-6 py-3 text-sm font-black uppercase border-b-2 transition-all ${modalTab === t ? 'border-green-600 text-green-700 bg-green-50' : 'border-transparent text-gray-400'}`}>
                        {t === 'details' ? 'Cabeçalho' : t === 'items' ? 'Itens' : t === 'totals' ? 'Financeiro' : 'Logs'}
                    </button>
                ))}
                {editingId && (
                    <button onClick={handlePrint} className="ml-auto flex items-center gap-2 bg-blue-50 text-blue-700 px-6 py-3 text-xs font-black uppercase hover:bg-blue-600 hover:text-white transition-all">
                        <Printer size={16}/> Imprimir PDF
                    </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto pr-2">
                  {modalTab === 'details' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                          <div className="space-y-4">
                              <div><label className="text-[10px] font-black text-gray-400 uppercase">Cliente</label><select className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none font-bold" value={newProp.clientId || ''} onChange={e => {const c=clients.find(x=>x.id===Number(e.target.value)); setNewProp({...newProp, clientId: c?.id, clientName: c?.company, nif: c?.nif, zone: c?.address, contactPhone: c?.phone, contactEmail: c?.email});}}><option value="">Selecionar cliente...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company}</option>)}</select></div>
                              <div><label className="text-[10px] font-black text-gray-400 uppercase">Título da Proposta</label><input type="text" className="w-full border rounded-xl p-3 text-sm" value={newProp.title || ''} onChange={e => setNewProp({...newProp, title: e.target.value})} placeholder="Ex: Manutenção de AC e Ventilação" /></div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div><label className="text-[10px] font-black text-gray-400 uppercase">Data Emissão</label><input type="date" className="w-full border rounded-xl p-3 text-sm" value={newProp.date} onChange={e => setNewProp({...newProp, date: e.target.value})} /></div>
                                  <div><label className="text-[10px] font-black text-gray-400 uppercase">Validade</label><input type="date" className="w-full border rounded-xl p-3 text-sm" value={newProp.validUntil || ''} onChange={e => setNewProp({...newProp, validUntil: e.target.value})} /></div>
                              </div>
                          </div>
                          <div className="space-y-4">
                              <div><label className="text-[10px] font-black text-gray-400 uppercase">Estado</label><select className="w-full border rounded-xl p-3 text-sm font-bold bg-yellow-50" value={newProp.status} onChange={e => setNewProp({...newProp, status: e.target.value as ProposalStatus})}><option>Criada</option><option>Aprovada</option><option>Executada</option><option>Rejeitada</option></select></div>
                              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                  <h4 className="text-[10px] font-black text-gray-400 uppercase mb-2">Dados de Faturação do Cliente</h4>
                                  <div className="text-xs space-y-1">
                                      <p><strong>NIF:</strong> {newProp.nif || '---'}</p>
                                      <p><strong>Zona:</strong> {newProp.zone || '---'}</p>
                                      <p><strong>Contacto:</strong> {newProp.contactPhone || '---'}</p>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}
                  {modalTab === 'items' && (
                      <div className="space-y-4">
                          <div className="flex gap-2 bg-gray-50 p-4 rounded-xl border">
                              <select className="flex-1 border rounded-xl p-3 text-sm" value={selectedMaterialId} onChange={e => setSelectedMaterialId(e.target.value)}><option value="">Escolher Artigo...</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name} ({m.price.toLocaleString()} CVE)</option>)}</select>
                              <input type="number" className="w-20 border rounded-xl p-3 text-center" value={itemQty} onChange={e => setItemQty(Number(e.target.value))} />
                              <button onClick={() => {
                                  const m = materials.find(x=>x.id===Number(selectedMaterialId));
                                  if(!m) return;
                                  const newItem: ProposalItem = { id: Date.now(), type: 'Material', description: m.name, quantity: itemQty, unitPrice: m.price, total: m.price * itemQty };
                                  setNewProp({...newProp, items: [...(newProp.items || []), newItem]});
                                  setSelectedMaterialId(''); setItemQty(1);
                              }} className="bg-blue-600 text-white px-6 rounded-xl font-bold">Adicionar</button>
                          </div>
                          <div className="border rounded-xl overflow-hidden shadow-sm">
                              <table className="w-full text-sm">
                                  <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400"><tr><th className="p-3 text-left">Item / Descrição</th><th className="p-3 text-center">Qtd</th><th className="p-3 text-right">P. Unit</th><th className="p-3 text-right">Total</th><th className="p-3 w-10"></th></tr></thead>
                                  <tbody className="divide-y">{newProp.items?.map(i => (
                                      <tr key={i.id} className="hover:bg-gray-50">
                                          <td className="p-3">{i.description}</td>
                                          <td className="p-3 text-center">{i.quantity}</td>
                                          <td className="p-3 text-right">{i.unitPrice.toLocaleString()}</td>
                                          <td className="p-3 text-right font-bold">{i.total.toLocaleString()}</td>
                                          <td className="p-3 text-center"><button onClick={() => setNewProp({...newProp, items: newProp.items?.filter(x=>x.id!==i.id)})} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td>
                                      </tr>
                                  ))}</tbody>
                              </table>
                          </div>
                      </div>
                  )}
                  {modalTab === 'totals' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-1">
                          <div className="space-y-4">
                              <div><label className="text-[10px] font-black text-gray-400 uppercase">IVA (%)</label><input type="number" className="w-full border rounded-xl p-3 text-sm" value={newProp.taxRate} onChange={e => setNewProp({...newProp, taxRate: Number(e.target.value)})} /></div>
                              <div><label className="text-[10px] font-black text-gray-400 uppercase">Desconto Global (%)</label><input type="number" className="w-full border rounded-xl p-3 text-sm" value={newProp.discount} onChange={e => setNewProp({...newProp, discount: Number(e.target.value)})} /></div>
                              <div><label className="text-[10px] font-black text-gray-400 uppercase">Retenção na Fonte (%)</label><input type="number" className="w-full border rounded-xl p-3 text-sm" value={newProp.retention} onChange={e => setNewProp({...newProp, retention: Number(e.target.value)})} /></div>
                          </div>
                          <div className="bg-green-50 p-6 rounded-2xl border border-green-100 flex flex-col justify-center">
                              {(() => {
                                  const t = calculateTotals(newProp.items || [], newProp.taxRate || 15, newProp.discount || 0, newProp.retention || 0);
                                  return (
                                      <div className="space-y-3">
                                          <div className="flex justify-between text-xs text-gray-500"><span>Subtotal Bruto:</span><span>{t.subtotal.toLocaleString()} CVE</span></div>
                                          <div className="flex justify-between text-xs text-red-600 font-bold"><span>Desconto:</span><span>-{t.discVal.toLocaleString()}</span></div>
                                          <div className="flex justify-between text-xs text-green-700"><span>Total IVA:</span><span>{t.taxVal.toLocaleString()}</span></div>
                                          <div className="flex justify-between text-xs text-orange-600"><span>Retenção:</span><span>-{t.retVal.toLocaleString()}</span></div>
                                          <div className="flex justify-between text-2xl font-black text-green-800 border-t pt-3 mt-3"><span>TOTAL:</span><span>{t.totalToPay.toLocaleString()} CVE</span></div>
                                      </div>
                                  )
                              })()}
                          </div>
                          <div className="md:col-span-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase">Termos e Condições / Observações</label>
                              <textarea className="w-full border rounded-xl p-4 h-32 text-sm mt-1" value={newProp.notes} onChange={e => setNewProp({...newProp, notes: e.target.value})} placeholder="Instruções de pagamento, validade, etc..." />
                          </div>
                      </div>
                  )}
                  {modalTab === 'logs' && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-gray-700 flex items-center gap-2"><ScrollText size={18}/> Histórico de Auditoria</h4>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 max-h-[300px] overflow-y-auto shadow-inner space-y-2">
                            {(newProp.logs || []).map((log, idx) => (
                                <div key={idx} className="text-xs border-b border-gray-200 py-2 last:border-0"><span className="text-blue-600 font-bold">{new Date(log.timestamp).toLocaleString('pt-PT')}</span> — <span className="font-black uppercase text-gray-700">{log.action}</span> por <span className="text-green-700 font-bold">{log.user || 'Sistemas'}</span>: <span className="text-gray-600">{log.details}</span></div>
                            ))}
                        </div>
                      </div>
                  )}
              </div>
              <div className="pt-6 border-t mt-6 flex justify-end gap-3">
                  <button onClick={() => setIsModalOpen(false)} className="px-8 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold">Fechar</button>
                  <button onClick={handleSaveProposal} className="px-10 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg shadow-green-100 hover:bg-green-700 transition-all">Guardar Proposta</button>
              </div>
          </div>
      </Modal>
    </div>
  );
};

export default ProposalsModule;
