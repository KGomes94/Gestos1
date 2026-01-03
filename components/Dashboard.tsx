
import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Users, Download, AlertCircle, Briefcase, FileText, Calendar, Package, Bell, CheckCircle2, Clock } from 'lucide-react';
import { Transaction, SystemSettings, ViewState, Employee, Appointment, Invoice, Purchase } from '../types';
import { db } from '../services/db';
import { currency } from '../utils/currency';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';

interface DashboardProps {
    transactions: Transaction[];
    settings: SystemSettings;
    onNavigate: (view: ViewState) => void;
    employees: Employee[];
    appointments: Appointment[];
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, settings, onNavigate, employees, appointments }) => {
  const currentDate = new Date().toLocaleDateString('pt-PT');
  const todayIso = new Date().toISOString().split('T')[0];
  
  // Calculate totals based on REAL transactions (Cash Basis)
  // CRITICAL FIX: Ignore future transactions to reflect true current balance
  const paidTransactions = transactions.filter(t => 
      t.status === 'Pago' && 
      !t.isVoided && 
      !t._deleted &&
      t.date <= todayIso
  );
  
  const totalIncome = paidTransactions.reduce((acc, t) => currency.add(acc, Number(t.income || 0)), 0);
  const totalExpense = paidTransactions.reduce((acc, t) => currency.add(acc, Number(t.expense || 0)), 0);
  const balance = currency.sub(totalIncome, totalExpense);
  
  // ALERT CALCULATIONS
  const pendingAppointments = appointments.filter(a => a.status !== 'Concluído' && a.status !== 'Cancelado').length;
  const overdueAppointments = appointments.filter(a => a.date < todayIso && a.status !== 'Concluído' && a.status !== 'Cancelado').length;
  
  const unreconciledCount = paidTransactions.filter(t => !t.isReconciled).length;
  
  const receivables = transactions.filter(t => t.status === 'Pendente' && !t.isVoided && !t._deleted && t.income).reduce((acc, t) => currency.add(acc, Number(t.income || 0)), 0);
  const payables = transactions.filter(t => t.status === 'Pendente' && !t.isVoided && !t._deleted && t.expense).reduce((acc, t) => currency.add(acc, Number(t.expense || 0)), 0);

  const hasData = transactions.length > 0 || appointments.length > 0;
  
  // Local invoices/purchases for charts (loaded in background)
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const run = async () => {
          const _invs = await db.invoices.getAll();
          const _purs = await db.purchases.getAll();
          if (!cancelled) {
            setInvoices(_invs || []);
            setPurchases(_purs || []);
          }
        };
        if ('requestIdleCallback' in window) (window as any).requestIdleCallback(run);
        else setTimeout(run, 1000);
      } catch (e) { console.warn('Dashboard: background load failed', e); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Configs
  const visibleLinks = settings.dashboard?.visibleQuickLinks || ['financeiro', 'clientes', 'propostas', 'agenda'];

  // Helper to get icon for link
  const getLinkIcon = (id: string) => {
      switch(id) {
          case 'financeiro': return Wallet;
          case 'clientes': return Briefcase;
          case 'propostas': return FileText;
          case 'agenda': return Calendar;
          case 'materiais': return Package;
          case 'rh': return Users;
          default: return AlertCircle;
      }
  };
  
  const getLinkLabel = (id: string) => {
      switch(id) {
          case 'financeiro': return 'Tesouraria';
          case 'clientes': return 'Clientes';
          case 'propostas': return 'Propostas';
          case 'agenda': return 'Agenda';
          case 'materiais': return 'Materiais';
          case 'rh': return 'RH';
          default: return id;
      }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Dashboard Geral</h1>
        <span className="text-gray-500 text-xs sm:text-sm">{currentDate}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 sm:gap-8">
          
          {/* LEFT MAIN CONTENT */}
          <div className="xl:col-span-3 space-y-6 sm:space-y-8">
            {!hasData ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 flex items-start gap-4">
                    <div className="p-2 bg-yellow-100 rounded-full text-yellow-600">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-yellow-800">Sem dados registados</h3>
                        <p className="text-yellow-700 mt-1">
                            O sistema está limpo. Comece por importar dados no módulo <strong>Tesouraria</strong> ou adicione registos manualmente.
                        </p>
                        <button onClick={() => onNavigate('financeiro')} className="mt-3 text-sm bg-yellow-600 text-white px-3 py-1.5 rounded hover:bg-yellow-700 font-medium">Ir para Tesouraria</button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* Financeiro Card */}
                    <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-600 flex justify-between items-start cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('financeiro')}>
                        <div>
                            <h2 className="text-gray-700 font-semibold mb-1">Financeiro</h2>
                            <p className="text-gray-500 text-sm mb-3">Saldo Atual (Caixa)</p>
                            <div className={`text-2xl sm:text-3xl font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                            {balance.toLocaleString('pt-CV', { minimumFractionDigits: 2 })} CVE
                            </div>
                        </div>
                        <div className="p-2 bg-green-50 rounded text-green-600">
                            <Wallet size={24} />
                        </div>
                    </div>

                    {/* EBITDA Card (repeated) */}
                    <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500 flex justify-between items-start cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('financeiro')}>
                        <div>
                            <h2 className="text-gray-700 font-semibold mb-1">EBITDA (Mês)</h2>
                            <p className="text-gray-500 text-sm mb-3">Margem operacional do mês atual</p>
                            <div className="text-2xl sm:text-3xl font-bold text-purple-700">{(function(){
                                // quick local computation
                                const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()+1;
                                const monthInv = invoices.filter(i => i.date && parseInt(i.date.split('-')[0]) === y && parseInt(i.date.split('-')[1]) === m).reduce((acc, i) => currency.add(acc, i.total), 0);
                                const monthPur = purchases.filter(p => p.date && parseInt(p.date.split('-')[0]) === y && parseInt(p.date.split('-')[1]) === m).reduce((acc, p) => currency.add(acc, p.total), 0);
                                return currency.sub(monthInv, monthPur).toLocaleString('pt-CV');
                            })()} CVE</div>
                        </div>
                        <div className="p-2 bg-purple-50 rounded text-purple-600">
                            <CheckCircle2 size={24} />
                        </div>
                    </div>

                    {/* Mini Faturação Chart */}
                    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100 lg:col-span-3">
                        <h4 className="text-sm font-bold text-gray-700 mb-2">Faturação (Ano Atual)</h4>
                        <div className="h-36">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={(function(){
                                    const year = new Date().getFullYear();
                                    return Array.from({length:12}, (_,i)=>{
                                        const m=i+1;
                                        const monthInvs = invoices.filter(inv => inv.date && parseInt(inv.date.split('-')[0]) === year && parseInt(inv.date.split('-')[1]) === m);
                                        const faturado = monthInvs.filter(inv => inv.status !== 'Anulada' && inv.status !== 'Rascunho' && inv.type !== 'NCE').reduce((acc, i) => currency.add(acc, i.total), 0);
                                        const pago = monthInvs.filter(inv => inv.status === 'Paga').reduce((acc, i) => currency.add(acc, i.total), 0);
                                        return { name: new Date(year, i).toLocaleString('pt-PT', {month: 'short'}), faturado, pago };
                                    });
                                })()}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={12} />
                                    <Tooltip formatter={(value: number) => value.toLocaleString('pt-CV') + ' CVE'} />
                                    <Bar dataKey="faturado" fill="#3b82f6" name="Emitido" radius={[4,4,0,0]} />
                                    <Bar dataKey="pago" fill="#22c55e" name="Recebido" radius={[4,4,0,0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Access Rapid Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Acesso Rápido</h3>
                <div className="flex flex-wrap gap-4">
                {visibleLinks.map(linkId => {
                    const Icon = getLinkIcon(linkId);
                    return (
                        <button 
                            key={linkId}
                            onClick={() => onNavigate(linkId as ViewState)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded border border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-all font-medium flex-1 sm:flex-none justify-center sm:justify-start whitespace-nowrap"
                        >
                            <Icon size={16} />
                            <span>{getLinkLabel(linkId)}</span>
                        </button>
                    );
                })}
                <button 
                    onClick={() => onNavigate('configuracoes')} 
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-400 rounded border border-dashed border-gray-300 hover:text-gray-600 hover:border-gray-400 transition-all text-sm ml-auto"
                >
                    <Download size={14} /> Personalizar
                </button>
                </div>

                {/* Monthly Result (Net) chart */}
                <div className="mt-6">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">Resultado Mensal (Ano Atual)</h4>
                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={(function(){
                                    const year = new Date().getFullYear();
                                    return Array.from({length:12}, (_,i)=>{
                                        const m=i+1;
                                        const monthInvs = invoices.filter(inv => inv.date && parseInt(inv.date.split('-')[0]) === year && parseInt(inv.date.split('-')[1]) === m);
                                        const faturado = monthInvs.filter(inv => inv.status !== 'Anulada' && inv.status !== 'Rascunho' && inv.type !== 'NCE').reduce((acc, i) => currency.add(acc, i.total), 0);
                                        const monthPurs = purchases.filter(p => p.date && parseInt(p.date.split('-')[0]) === year && parseInt(p.date.split('-')[1]) === m);
                                        const custo = monthPurs.reduce((acc, p) => currency.add(acc, p.total), 0);
                                        const lucro = currency.sub(faturado, custo);
                                        return { name: new Date(year, i).toLocaleString('pt-PT', {month: 'short'}), lucro };
                                    });
                                })()}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={12} />
                                    <Tooltip formatter={(value: number) => value.toLocaleString('pt-CV') + ' CVE'} />
                                    <Line type="monotone" dataKey="lucro" stroke="#6b21a8" strokeWidth={2} dot={{r: 4}} activeDot={{r: 6}} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR ALERTS */}
          <div className="xl:col-span-1 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                      <Bell size={18} className="text-gray-500"/>
                      <h3 className="font-bold text-gray-700">Alertas e Pendentes</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                      {/* Overdue Appointments */}
                      <div className={`p-4 flex justify-between items-center ${overdueAppointments > 0 ? 'bg-red-50' : 'bg-white'}`}>
                          <div>
                              <p className="text-sm font-medium text-gray-600">Agendamentos Atrasados</p>
                              <p className="text-xs text-gray-400">Por concluir antes de hoje</p>
                          </div>
                          <div className={`font-bold text-lg ${overdueAppointments > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {overdueAppointments}
                          </div>
                      </div>

                      {/* Open Appointments */}
                      <div className="p-4 flex justify-between items-center bg-white hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate('agenda')}>
                          <div>
                              <p className="text-sm font-medium text-gray-600">Serviços em Aberto</p>
                              <p className="text-xs text-gray-400">Total na agenda</p>
                          </div>
                          <div className="font-bold text-lg text-blue-600">
                              {pendingAppointments}
                          </div>
                      </div>

                      {/* Unreconciled */}
                      <div className={`p-4 flex justify-between items-center ${unreconciledCount > 0 ? 'bg-orange-50' : 'bg-white'}`}>
                          <div>
                              <p className="text-sm font-medium text-gray-600">Contas por Conciliar</p>
                              <p className="text-xs text-gray-400">Transações pagas</p>
                          </div>
                          <div className={`font-bold text-lg ${unreconciledCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                              {unreconciledCount}
                          </div>
                      </div>

                      {/* Receivables */}
                      <div className="p-4 flex justify-between items-center bg-white">
                          <div>
                              <p className="text-sm font-medium text-gray-600">Valores a Receber</p>
                              <p className="text-xs text-gray-400">Faturas pendentes</p>
                          </div>
                          <div className="font-bold text-md text-green-600">
                              {receivables.toLocaleString('pt-CV')}
                          </div>
                      </div>

                      {/* Payables */}
                      <div className="p-4 flex justify-between items-center bg-white">
                          <div>
                              <p className="text-sm font-medium text-gray-600">Valores a Pagar</p>
                              <p className="text-xs text-gray-400">Despesas pendentes</p>
                          </div>
                          <div className="font-bold text-md text-red-600">
                              {payables.toLocaleString('pt-CV')}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
