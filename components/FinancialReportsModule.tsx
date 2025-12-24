import React from 'react';
import { MOCK_TRANSACTIONS } from '../constants';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';

const FinancialReportsModule: React.FC = () => {
  const formatCurrency = (val: number | null) => {
    return (val || 0).toLocaleString('pt-CV') + ' CVE';
  };

  // Calculations
  const totalIncome = MOCK_TRANSACTIONS.reduce((acc, t) => acc + (t.income || 0), 0);
  const totalExpense = MOCK_TRANSACTIONS.reduce((acc, t) => acc + (t.expense || 0), 0);
  const netCashFlow = totalIncome - totalExpense;

  const accountsReceivable = MOCK_TRANSACTIONS.filter(t => t.income && t.status === 'Pendente');
  const totalReceivable = accountsReceivable.reduce((acc, t) => acc + (t.income || 0), 0);

  const accountsPayable = MOCK_TRANSACTIONS.filter(t => t.expense && t.status === 'Pendente');
  const totalPayable = accountsPayable.reduce((acc, t) => acc + (t.expense || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Relatórios Financeiros</h2>
           <p className="text-gray-500 text-sm">Análise de fluxo de caixa e pendentes</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 font-medium">Fluxo de Caixa Líquido</h3>
              <div className={`p-2 rounded-full ${netCashFlow >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                <DollarSign size={20} />
              </div>
           </div>
           <div className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
             {formatCurrency(netCashFlow)}
           </div>
           <div className="mt-2 text-xs text-gray-400 flex justify-between">
              <span>Entradas: {formatCurrency(totalIncome)}</span>
              <span>Saídas: {formatCurrency(totalExpense)}</span>
           </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 font-medium">Contas a Receber</h3>
              <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                <TrendingUp size={20} />
              </div>
           </div>
           <div className="text-2xl font-bold text-gray-800">
             {formatCurrency(totalReceivable)}
           </div>
           <p className="mt-2 text-xs text-gray-400">{accountsReceivable.length} transações pendentes</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 font-medium">Contas a Pagar</h3>
              <div className="p-2 rounded-full bg-orange-100 text-orange-600">
                <TrendingDown size={20} />
              </div>
           </div>
           <div className="text-2xl font-bold text-gray-800">
             {formatCurrency(totalPayable)}
           </div>
           <p className="mt-2 text-xs text-gray-400">{accountsPayable.length} transações pendentes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Accounts Payable Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-orange-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Contas a Pagar (Pendentes)</h3>
                <AlertCircle size={18} className="text-orange-500"/>
            </div>
            <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                    <tr>
                        <th className="px-6 py-3 text-left font-medium">Data</th>
                        <th className="px-6 py-3 text-left font-medium">Descrição</th>
                        <th className="px-6 py-3 text-right font-medium">Valor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {accountsPayable.length > 0 ? accountsPayable.map(t => (
                        <tr key={t.id}>
                            <td className="px-6 py-3 text-gray-600">{new Date(t.date).toLocaleDateString('pt-PT')}</td>
                            <td className="px-6 py-3 text-gray-800">{t.description}</td>
                            <td className="px-6 py-3 text-right font-medium text-red-600">{formatCurrency(t.expense)}</td>
                        </tr>
                    )) : (
                        <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-400">Nenhuma conta pendente.</td></tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Accounts Receivable Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-blue-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Contas a Receber (Pendentes)</h3>
                <CheckCircle2 size={18} className="text-blue-500"/>
            </div>
            <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                    <tr>
                        <th className="px-6 py-3 text-left font-medium">Data</th>
                        <th className="px-6 py-3 text-left font-medium">Descrição</th>
                        <th className="px-6 py-3 text-right font-medium">Valor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {accountsReceivable.length > 0 ? accountsReceivable.map(t => (
                        <tr key={t.id}>
                            <td className="px-6 py-3 text-gray-600">{new Date(t.date).toLocaleDateString('pt-PT')}</td>
                            <td className="px-6 py-3 text-gray-800">{t.description}</td>
                            <td className="px-6 py-3 text-right font-medium text-green-600">{formatCurrency(t.income)}</td>
                        </tr>
                    )) : (
                        <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-400">Nenhuma conta a receber.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default FinancialReportsModule;
