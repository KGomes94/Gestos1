
import React, { useMemo, useState } from 'react';
import { Invoice, Purchase, Transaction, Account, Client } from '../types';
import { currency } from '../utils/currency';
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, Phone, ArrowUpRight, DollarSign, PieChart, Activity, Calendar } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface FinancialDashboardProps {
    invoices: Invoice[];
    purchases: Purchase[];
    transactions: Transaction[];
    categories: Account[];
    clients: Client[];
    currentBalance: number; // Passado do hub ou calculado
}

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
    invoices, purchases, transactions, categories, clients, currentBalance
}) => {
    const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1);
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

    // --- HELPERS ---
    const getCategoryCode = (name: string): string => {
        const cat = categories.find(c => c.name === name);
        return cat ? cat.code : '9.9'; // 9.9 = Indefinido
    };

    // Fix: Parse manual da data para evitar deslocamento de fuso horário (UTC vs Local)
    const isSameMonth = (dateStr: string) => {
        if (!dateStr) return false;
        const parts = dateStr.split('-');
        if (parts.length < 3) return false;
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]);
        return m === monthFilter && y === yearFilter;
    };

    // Local Today String
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // Calcular anos disponíveis dinamicamente (Correção de fuso horário aplicada)
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        years.add(new Date().getFullYear());
        invoices.forEach(i => { if(i.date) years.add(parseInt(i.date.split('-')[0])); });
        purchases.forEach(p => { if(p.date) years.add(parseInt(p.date.split('-')[0])); });
        return Array.from(years).sort((a,b) => b - a);
    }, [invoices, purchases]);

    // --- CÁLCULO DE KPIs (LIQUIDEZ) ---
    const liquidityStats = useMemo(() => {
        // 1. Recebível Hoje (Faturas Venda Pendentes vencendo hoje)
        const receivableToday = invoices
            .filter(i => i.status === 'Emitida' && i.date === todayStr) 
            .reduce((acc, i) => currency.add(acc, i.total), 0);

        // 2. Pagável Hoje (Faturas Compra Abertas vencendo hoje)
        const payableToday = purchases
            .filter(p => p.status === 'Aberta' && p.dueDate === todayStr)
            .reduce((acc, p) => currency.add(acc, p.total), 0);

        // 3. Recebível Mês (Para Forecast)
        const receivableMonth = invoices
            .filter(i => (i.status === 'Emitida' || i.status === 'Pendente Envio') && isSameMonth(i.dueDate))
            .reduce((acc, i) => currency.add(acc, i.total), 0);

        // 4. Pagável Mês (Para Forecast)
        const payableMonth = purchases
            .filter(p => p.status === 'Aberta' && isSameMonth(p.dueDate))
            .reduce((acc, p) => currency.add(acc, p.total), 0);

        const forecast = currency.sub(currency.add(currentBalance, receivableMonth), payableMonth);

        return { receivableToday, payableToday, receivableMonth, payableMonth, forecast };
    }, [invoices, purchases, currentBalance, monthFilter, yearFilter]);

    // --- CÁLCULO DE RESULTADOS (DRE - Competência) ---
    const dreStats = useMemo(() => {
        const monthInvoices = invoices.filter(i => isSameMonth(i.date) && i.status !== 'Rascunho' && i.status !== 'Anulada');
        const monthPurchases = purchases.filter(p => isSameMonth(p.date) && p.status !== 'Rascunho' && p.status !== 'Anulada');

        // KPI_RECEITA_BRUTA (Grupo 1)
        const receitaBruta = monthInvoices.reduce((acc, i) => currency.add(acc, i.total), 0);

        // KPI_CUSTO_VARIAVEL (Grupo 2)
        const custoVariavel = monthPurchases.filter(p => {
            const cat = categories.find(c => c.id === p.categoryId);
            return cat && cat.code.startsWith('2.');
        }).reduce((acc, p) => currency.add(acc, p.total), 0);

        const margemContribuicao = currency.sub(receitaBruta, custoVariavel);

        // KPI_CUSTO_FIXO (Grupo 3)
        const custoFixo = monthPurchases.filter(p => {
            const cat = categories.find(c => c.id === p.categoryId);
            return cat && cat.code.startsWith('3.');
        }).reduce((acc, p) => currency.add(acc, p.total), 0);

        // KPI_EBITDA (Margem - Fixo)
        const ebitda = currency.sub(margemContribuicao, custoFixo);
        const ebitdaMargin = receitaBruta > 0 ? (ebitda / receitaBruta) * 100 : 0;

        // KPI_RESULTADO_FINANCEIRO (Grupo 4)
        const resultadoFinanceiro = monthPurchases.filter(p => {
            const cat = categories.find(c => c.id === p.categoryId);
            return cat && cat.code.startsWith('4.');
        }).reduce((acc, p) => currency.add(acc, p.total), 0);

        // Impostos (Aproximação baseada no taxTotal das faturas/compras)
        const impostos = currency.sub(
            monthInvoices.reduce((acc, i) => currency.add(acc, i.taxTotal), 0),
            monthPurchases.reduce((acc, p) => currency.add(acc, p.taxTotal), 0)
        );

        const lucroLiquido = currency.sub(currency.sub(ebitda, resultadoFinanceiro), impostos);

        return { receitaBruta, custoVariavel, margemContribuicao, custoFixo, ebitda, ebitdaMargin, resultadoFinanceiro, lucroLiquido };
    }, [invoices, purchases, categories, monthFilter, yearFilter]);

    // --- DADOS PARA GRÁFICOS ---
    const chartsData = useMemo(() => {
        // 1. Donut: Composição de Despesas
        const expenseComposition = [
            { name: 'Custo Variável (G2)', value: dreStats.custoVariavel },
            { name: 'Custo Fixo (G3)', value: dreStats.custoFixo },
            { name: 'Financeiro (G4)', value: dreStats.resultadoFinanceiro },
        ].filter(i => i.value > 0);

        // 2. Linha: Tendência (Baseado no Filtro)
        const trendData = [];
        
        // Se filtro for "Todos", mostra Jan-Dez do ano selecionado.
        // Se filtro for Mês específico, mostra os 6 meses anteriores a esse mês.
        const monthsToShow = monthFilter === 0 ? 12 : 6;
        const startMonthIndex = monthFilter === 0 ? 0 : (monthFilter - 6); 

        for (let i = 0; i < monthsToShow; i++) {
            let m = startMonthIndex + i; // 0-based index
            let y = yearFilter;

            // Ajuste para meses negativos (ano anterior) se estivermos a ver ultimos 6 meses
            if (m < 0) {
                m += 12;
                y -= 1;
            }

            const monthLabel = new Date(y, m).toLocaleString('pt-PT', { month: 'short' });
            
            // Fix: Parse manual de data para evitar bug de Timezone
            const monthInvs = invoices.filter(inv => {
                if (!inv.date || inv._deleted || inv.status === 'Rascunho') return false;
                const [iy, im] = inv.date.split('-').map(Number);
                return (im - 1) === m && iy === y;
            });

            const monthPurs = purchases.filter(pur => {
                if (!pur.date || pur._deleted || pur.status === 'Anulada') return false;
                const [py, pm] = pur.date.split('-').map(Number);
                return (pm - 1) === m && py === y;
            });
            
            const fixedCosts = monthPurs.filter(p => {
                const cat = categories.find(c => c.id === p.categoryId);
                return cat && cat.code.startsWith('3.');
            }).reduce((acc, p) => currency.add(acc, p.total), 0);

            trendData.push({
                name: `${monthLabel}`,
                Receita: monthInvs.reduce((acc, i) => currency.add(acc, i.total), 0),
                PontoEquilibrio: fixedCosts
            });
        }

        return { expenseComposition, trendData };
    }, [dreStats, invoices, purchases, categories, monthFilter, yearFilter]);

    // --- LISTAS DE ALERTA ---
    const alerts = useMemo(() => {
        // Clientes em Atraso (Emitida e Vencida)
        const overdueClients = invoices
            .filter(i => (i.status === 'Emitida' || i.status === 'Pendente Envio') && i.dueDate < todayStr)
            .map(i => {
                const diffTime = Math.abs(new Date(todayStr).getTime() - new Date(i.dueDate).getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                return {
                    id: i.id,
                    client: i.clientName,
                    amount: i.total,
                    days: diffDays,
                    phone: clients.find(c => c.id === i.clientId)?.phone
                };
            })
            .sort((a, b) => b.days - a.days)
            .slice(0, 5);

        // Contas a Pagar Breve (Próximos 7 dias)
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().split('T')[0];

        const upcomingPayables = purchases
            .filter(p => p.status === 'Aberta' && p.dueDate >= todayStr && p.dueDate <= nextWeekStr)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .slice(0, 5);

        return { overdueClients, upcomingPayables };
    }, [invoices, purchases, clients]);

    const handleWhatsapp = (phone: string | undefined, client: string, amount: number) => {
        if (!phone) return alert("Cliente sem telefone registado.");
        const msg = `Olá ${client}, verificamos um valor em aberto de ${amount.toLocaleString()} CVE. Podemos ajudar a regularizar?`;
        window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    return (
        <div className="flex flex-col h-full space-y-6 animate-fade-in-up overflow-y-auto pb-6 pr-2">
            
            {/* Header com Filtro */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Dashboard Financeiro</h3>
                    <p className="text-xs text-gray-500">Visão integrada de Liquidez e Resultados.</p>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-lg border shadow-sm">
                    <select value={monthFilter} onChange={e => setMonthFilter(Number(e.target.value))} className="text-sm font-bold text-gray-700 bg-transparent outline-none cursor-pointer">
                        <option value={0}>Todos os Meses</option>
                        {Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('pt-PT', {month: 'long'})}</option>)}
                    </select>
                    <select value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))} className="text-sm font-bold text-gray-700 bg-transparent outline-none cursor-pointer border-l pl-2">
                        {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* LINHA 1: CARDS KPI */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet size={48} className="text-blue-600"/></div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Saldo Atual (Caixa/Bco)</p>
                    <div>
                        <h3 className="text-2xl font-black text-gray-800">{currentBalance.toLocaleString()} CVE</h3>
                        <p className="text-[10px] text-gray-500 mt-1">Previsão Fim Mês: <span className={liquidityStats.forecast >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{liquidityStats.forecast.toLocaleString()}</span></p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden border-l-4 border-l-green-500">
                    <div className="absolute right-0 top-0 p-4 opacity-10"><TrendingUp size={48} className="text-green-600"/></div>
                    <p className="text-xs font-black text-green-700 uppercase tracking-wider">A Receber Hoje</p>
                    <div>
                        <h3 className="text-2xl font-black text-green-700">{liquidityStats.receivableToday.toLocaleString()} CVE</h3>
                        <p className="text-[10px] text-gray-400 mt-1">Total Mês: {liquidityStats.receivableMonth.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden border-l-4 border-l-red-500">
                    <div className="absolute right-0 top-0 p-4 opacity-10"><TrendingDown size={48} className="text-red-600"/></div>
                    <p className="text-xs font-black text-red-700 uppercase tracking-wider">A Pagar Hoje</p>
                    <div>
                        <h3 className="text-2xl font-black text-red-600">{liquidityStats.payableToday.toLocaleString()} CVE</h3>
                        <p className="text-[10px] text-gray-400 mt-1">Total Mês: {liquidityStats.payableMonth.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden border-l-4 border-l-purple-500">
                    <div className="absolute right-0 top-0 p-4 opacity-10"><Activity size={48} className="text-purple-600"/></div>
                    <div className="flex justify-between items-start">
                        <p className="text-xs font-black text-purple-700 uppercase tracking-wider">EBITDA (Mês)</p>
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">{dreStats.ebitdaMargin.toFixed(1)}%</span>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-purple-700">{dreStats.ebitda.toLocaleString()} CVE</h3>
                        <p className="text-[10px] text-gray-400 mt-1">Lucro Líquido: {dreStats.lucroLiquido.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* LINHA 2: GRÁFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Donut Despesas */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
                    <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><PieChart size={16}/> Composição de Custos</h4>
                    <div className="flex-1 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie 
                                    data={chartsData.expenseComposition} 
                                    cx="50%" cy="50%" 
                                    innerRadius={50} 
                                    outerRadius={80} 
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartsData.expenseComposition.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => value.toLocaleString() + ' CVE'} />
                                <Legend wrapperStyle={{fontSize: '10px'}} />
                            </RePieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Tendência */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
                    <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><ArrowUpRight size={16}/> {monthFilter === 0 ? `Tendência Anual (${yearFilter})` : 'Tendência (Últimos 6 meses)'}</h4>
                    <div className="flex-1 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartsData.trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(value: number) => value.toLocaleString() + ' CVE'} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                <Legend />
                                <Line type="monotone" dataKey="Receita" stroke="#16a34a" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                                <Line type="monotone" dataKey="PontoEquilibrio" name="Custos Fixos" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* LINHA 3: ALERTAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Clientes em Atraso */}
                <div className="bg-white border border-red-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-red-50 p-3 border-b border-red-100 flex justify-between items-center">
                        <h4 className="text-xs font-black text-red-800 uppercase flex items-center gap-2"><AlertTriangle size={14}/> Clientes em Atraso (Top 5)</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-white text-gray-500 font-bold border-b">
                                <tr>
                                    <th className="p-3 text-left">Cliente</th>
                                    <th className="p-3 text-right">Valor</th>
                                    <th className="p-3 text-center">Dias</th>
                                    <th className="p-3 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {alerts.overdueClients.map(c => (
                                    <tr key={c.id} className="hover:bg-red-50/30">
                                        <td className="p-3 font-bold text-gray-700">{c.client}</td>
                                        <td className="p-3 text-right font-mono">{c.amount.toLocaleString()}</td>
                                        <td className="p-3 text-center text-red-600 font-bold">+{c.days}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => handleWhatsapp(c.phone, c.client, c.amount)} className="text-green-600 hover:bg-green-50 p-1.5 rounded transition-colors" title="Cobrar por WhatsApp">
                                                <Phone size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {alerts.overdueClients.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400 italic">Nenhum atraso crítico.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Contas a Pagar Breve */}
                <div className="bg-white border border-orange-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-orange-50 p-3 border-b border-orange-100 flex justify-between items-center">
                        <h4 className="text-xs font-black text-orange-800 uppercase flex items-center gap-2"><Calendar size={14}/> A Pagar (Próx. 7 dias)</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-white text-gray-500 font-bold border-b">
                                <tr>
                                    <th className="p-3 text-left">Fornecedor</th>
                                    <th className="p-3 text-right">Valor</th>
                                    <th className="p-3 text-center">Vencimento</th>
                                    <th className="p-3 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {alerts.upcomingPayables.map(p => (
                                    <tr key={p.id} className="hover:bg-orange-50/30">
                                        <td className="p-3 font-bold text-gray-700">{p.supplierName}</td>
                                        <td className="p-3 text-right font-mono">{p.total.toLocaleString()}</td>
                                        <td className="p-3 text-center text-orange-600 font-bold">{new Date(p.dueDate).toLocaleDateString()}</td>
                                        <td className="p-3 text-center">
                                            <button className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors" title="Pagar Agora">
                                                <DollarSign size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {alerts.upcomingPayables.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400 italic">Nada a pagar nos próximos 7 dias.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};
