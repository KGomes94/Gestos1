
import React from 'react';
import { Wallet, Users, Download, AlertCircle, Briefcase, FileText, Calendar, Package, Bell, CheckCircle2, Clock } from 'lucide-react';
import { Transaction, SystemSettings, ViewState, Employee, Appointment } from '../types';

interface DashboardProps {
    transactions: Transaction[];
    settings: SystemSettings;
    onNavigate: (view: ViewState) => void;
    employees: Employee[];
    appointments: Appointment[];
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, settings, onNavigate, employees, appointments }) => {
  const currentDate = new Date().toLocaleDateString('pt-PT');
  
  // FILTRAR REGISTOS ELIMINADOS (_deleted)
  const activeTransactions = transactions.filter(t => !t._deleted);
  const activeAppointments = appointments.filter(a => !a._deleted);

  const paidTransactions = activeTransactions.filter(t => t.status === 'Pago' && !t.isVoided);
  const totalIncome = paidTransactions.reduce((acc, t) => acc + Number(t.income || 0), 0);
  const totalExpense = paidTransactions.reduce((acc, t) => acc + Number(t.expense || 0), 0);
  const balance = totalIncome - totalExpense;
  
  const today = new Date().toISOString().split('T')[0];
  const pendingAppointments = activeAppointments.filter(a => a.status !== 'Concluído' && a.status !== 'Cancelado').length;
  const overdueAppointments = activeAppointments.filter(a => a.date < today && a.status !== 'Concluído' && a.status !== 'Cancelado').length;
  
  const unreconciledCount = paidTransactions.filter(t => !t.isReconciled).length;
  const receivables = activeTransactions.filter(t => t.status === 'Pendente' && !t.isVoided && t.income).reduce((acc, t) => acc + Number(t.income || 0), 0);
  const payables = activeTransactions.filter(t => t.status === 'Pendente' && !t.isVoided && t.expense).reduce((acc, t) => acc + Number(t.expense || 0), 0);

  const hasData = activeTransactions.length > 0 || activeAppointments.length > 0;
  const visibleCards = settings.dashboard?.visibleCards || ['financial', 'hr', 'system'];
  const visibleLinks = settings.dashboard?.visibleQuickLinks || ['financeiro', 'clientes', 'propostas', 'agenda'];

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
          <div className="xl:col-span-3 space-y-6 sm:space-y-8">
            {!hasData ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 flex items-start gap-4">
                    <div className="p-2 bg-yellow-100 rounded-full text-yellow-600"><AlertCircle size={24} /></div>
                    <div><h3 className="text-lg font-bold text-yellow-800">Sem dados registados</h3><p className="text-yellow-700 mt-1">O sistema está limpo. Adicione registos no módulo de Tesouraria.</p></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {visibleCards.includes('financial') && (
                        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-600 flex justify-between items-start cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('financeiro')}>
                            <div><h2 className="text-gray-700 font-semibold mb-1">Financeiro</h2><p className="text-gray-500 text-sm mb-3">Saldo Atual (Caixa)</p><div className={`text-2xl sm:text-3xl font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{balance.toLocaleString('pt-CV', { minimumFractionDigits: 2 })} CVE</div></div>
                            <div className="p-2 bg-green-50 rounded text-green-600"><Wallet size={24} /></div>
                        </div>
                    )}
                    {visibleCards.includes('hr') && (
                        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-600 flex justify-between items-start cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('rh')}>
                            <div><h2 className="text-gray-700 font-semibold mb-1">Recursos Humanos</h2><p className="text-gray-500 text-sm mb-3">Funcionários</p><div className="text-2xl sm:text-3xl font-bold text-gray-900">{employees.length}</div></div>
                            <div className="p-2 bg-green-50 rounded text-green-600"><Users size={24} /></div>
                        </div>
                    )}
                </div>
            )}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Acesso Rápido</h3>
                <div className="flex flex-wrap gap-4">
                {visibleLinks.map(linkId => {
                    const Icon = getLinkIcon(linkId);
                    return (<button key={linkId} onClick={() => onNavigate(linkId as ViewState)} className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded border border-gray-200 hover:bg-green-50 hover:text-green-700 transition-all font-medium"><Icon size={16} /><span>{getLinkLabel(linkId)}</span></button>);
                })}
                </div>
            </div>
          </div>

          <div className="xl:col-span-1 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b flex items-center gap-2"><Bell size={18} className="text-gray-500"/><h3 className="font-bold text-gray-700">Alertas</h3></div>
                  <div className="divide-y divide-gray-100">
                      <div className={`p-4 flex justify-between items-center ${overdueAppointments > 0 ? 'bg-red-50' : ''}`}><div><p className="text-sm font-medium text-gray-600">Atrasos Agenda</p></div><div className={`font-bold text-lg ${overdueAppointments > 0 ? 'text-red-600' : 'text-gray-400'}`}>{overdueAppointments}</div></div>
                      <div className="p-4 flex justify-between items-center"><div><p className="text-sm font-medium text-gray-600">Por Conciliar</p></div><div className={`font-bold text-lg ${unreconciledCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{unreconciledCount}</div></div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
