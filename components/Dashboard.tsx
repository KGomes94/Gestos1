
import React from 'react';
import { Wallet, Users, Download, AlertCircle, Briefcase, FileText, Calendar, Package, Bell, CheckCircle2, Clock } from 'lucide-react';
import { Transaction, SystemSettings, ViewState, Employee, Appointment } from '../types';
import { db } from '../services/db';

interface DashboardProps {
    transactions: Transaction[];
    settings: SystemSettings;
    onNavigate: (view: ViewState) => void;
    employees: Employee[];
    appointments: Appointment[];
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, settings, onNavigate, employees, appointments }) => {
  const currentDate = new Date().toLocaleDateString('pt-PT');
  
  // Calculate totals based on REAL transactions
  // FIX: Force Number() casting to prevent string concatenation bugs
  const paidTransactions = transactions.filter(t => t.status === 'Pago' && !t.isVoided);
  
  const totalIncome = paidTransactions.reduce((acc, t) => acc + Number(t.income || 0), 0);
  const totalExpense = paidTransactions.reduce((acc, t) => acc + Number(t.expense || 0), 0);
  const balance = totalIncome - totalExpense;
  
  // ALERT CALCULATIONS
  const today = new Date().toISOString().split('T')[0];
  const pendingAppointments = appointments.filter(a => a.status !== 'Concluído' && a.status !== 'Cancelado').length;
  const overdueAppointments = appointments.filter(a => a.date < today && a.status !== 'Concluído' && a.status !== 'Cancelado').length;
  
  const unreconciledCount = paidTransactions.filter(t => !t.isReconciled).length;
  
  const receivables = transactions.filter(t => t.status === 'Pendente' && !t.isVoided && t.income).reduce((acc, t) => acc + Number(t.income || 0), 0);
  const payables = transactions.filter(t => t.status === 'Pendente' && !t.isVoided && t.expense).reduce((acc, t) => acc + Number(t.expense || 0), 0);

  const hasData = transactions.length > 0 || appointments.length > 0;
  
  // Configs
  const visibleCards = settings.dashboard?.visibleCards || ['financial', 'hr', 'system'];
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
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Geral</h1>
        <span className="text-gray-500 text-sm">{currentDate}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* LEFT MAIN CONTENT */}
          <div className="xl:col-span-3 space-y-8">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Financeiro Card */}
                    {visibleCards.includes('financial') && (
                        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-600 flex justify-between items-start cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('financeiro')}>
                            <div>
                                <h2 className="text-gray-700 font-semibold mb-1">Financeiro</h2>
                                <p className="text-gray-500 text-sm mb-3">Saldo Atual (Caixa)</p>
                                <div className={`text-3xl font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                {balance.toLocaleString('pt-CV', { minimumFractionDigits: 2 })} CVE
                                </div>
                            </div>
                            <div className="p-2 bg-green-50 rounded text-green-600">
                                <Wallet size={24} />
                            </div>
                        </div>
                    )}

                    {/* RH Card */}
                    {visibleCards.includes('hr') && (
                        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-600 flex justify-between items-start cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('rh')}>
                            <div>
                                <h2 className="text-gray-700 font-semibold mb-1">Recursos Humanos</h2>
                                <p className="text-gray-500 text-sm mb-3">Funcionários</p>
                                <div className="text-3xl font-bold text-gray-900">
                                {employees.length} <span className="text-sm font-normal text-gray-400">(Registados)</span>
                                </div>
                            </div>
                            <div className="p-2 bg-green-50 rounded text-green-600">
                                <Users size={24} />
                            </div>
                        </div>
                    )}
                    
                    {/* System Card */}
                    {visibleCards.includes('system') && (
                        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500 flex justify-between items-start cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('configuracoes')}>
                            <div>
                                <h2 className="text-gray-700 font-semibold mb-1">Sistema</h2>
                                <p className="text-gray-500 text-sm mb-3">Manutenção</p>
                                <div className="text-sm font-bold text-blue-700">
                                Ver Definições
                                </div>
                            </div>
                            <div className="p-2 bg-blue-50 rounded text-blue-600">
                                <Download size={24} />
                            </div>
                        </div>
                    )}
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
                            className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded border border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-all font-medium"
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
