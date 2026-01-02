
import React, { useMemo, useState, useEffect } from 'react';
import { Invoice, Purchase, Transaction, Account, Client, SystemSettings } from '../types';
import { currency } from '../utils/currency';
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, Phone, Activity, Calendar, PieChart, FileText, Download } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { db } from '../services/db';
import { printService } from '../services/printService';

interface FinancialDashboardProps {
    invoices: Invoice[];
    purchases: Purchase[];
    transactions: Transaction[];
    categories: Account[];
    clients: Client[];
    currentBalance: number;
    settings?: SystemSettings;
}

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
    invoices, purchases, transactions, categories, clients, currentBalance, settings
}) => {
    // Usar estado local inicializado com os valores globais
    const [dateFilters, setDateFilters] = useState(() => db.filters.getGlobalDate());

    // Estados para Relatórios Avançados
    const [reportStartDate, setReportStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [reportEndDate, setReportEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    // Atualizar persistência quando o filtro muda
    useEffect(() => {
        db.filters.saveGlobalDate(dateFilters);
    }, [dateFilters]);

    const { month: monthFilter, year: yearFilter } = dateFilters;

    // --- HELPERS ---
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

    // Calcular anos disponíveis dinamicamente
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

    // --- BILLING STATS (FATURAÇÃO vs META) ---
    const billingStats = useMemo(() => {
        const yearInvoices = invoices.filter(i => i.date && parseInt(i.date.split('-')[0]) === yearFilter);
        const visibleInvoices = yearInvoices.filter(i => (monthFilter === 0) || (new Date(i.date).getMonth() + 1) === monthFilter);
        const isCounted = (inv: Invoice) => inv.status !== 'Anulada' && inv.status !== 'Rascunho' && inv.type !== 'NCE';
        const monthlyBilled = visibleInvoices.filter(isCounted).reduce((acc, i) => currency.add(acc, i.total), 0);
        const monthlyTarget = settings?.monthlyTarget ?? 0;
        const billingPercent = monthlyTarget > 0 ? Math.round((monthlyBilled / monthlyTarget) * 100) : 0;
        return { monthlyBilled, monthlyTarget, billingPercent };
    }, [invoices, monthFilter, yearFilter, settings?.monthlyTarget]);

    // --- DADOS PARA GRÁFICOS ---
    const chartsData = useMemo(() => {
        // 1. Donut: Composição de Despesas
        const expenseComposition = [
            { name: 'Custo Variável', value: dreStats.custoVariavel },
            { name: 'Custo Fixo', value: dreStats.custoFixo },
            { name: 'Financeiro', value: dreStats.resultadoFinanceiro },
        ].filter(i => i.value > 0);

        // 2. Linha: Tendência (Baseado no Filtro)
        const trendData = [];
        
        const monthsToShow = monthFilter === 0 ? 12 : 6;
        const startMonthIndex = monthFilter === 0 ? 0 : (monthFilter - 6); 

        for (let i = 0; i < monthsToShow; i++) {
            let m = startMonthIndex + i; // 0-based index
            let y = yearFilter;

            if (m < 0) {
                m += 12;
                y -= 1;
            }

            const monthLabel = new Date(y, m).toLocaleString('pt-PT', { month: 'short' });
            
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
                DespesaFixa: fixedCosts
            });
        }

        return { expenseComposition, trendData };
    }, [dreStats, invoices, purchases, categories, monthFilter, yearFilter]);

    const handlePrintReport = (type: 'balancete' | 'consolidado' | 'financeiro') => {
        if (!settings) return;
        
        const period = { start: reportStartDate, end: reportEndDate };
        
        if (type === 'balancete') {
            printService.printTrialBalance(transactions, invoices, purchases, categories, period, settings);
        } else if (type === 'consolidado') {
            printService.printConsolidatedStatement(transactions, invoices, purchases, period, settings);
        } else if (type === 'financeiro') {
            printService.printPeriodFinancialReport(transactions, invoices, purchases, categories, period, settings);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-6 animate-fade-in-up overflow-y-auto pb-6 pr-2">
            
            {/* Header com Filtro */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Dashboard Financeiro</h3>
                    <p className="text-xs text-gray-500">Visão integrada de Liquidez e Resultados.</p>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-lg border shadow-sm">
                    <select 
                        value={monthFilter} 
                        onChange={e => setDateFilters({...dateFilters, month: Number(e.target.value)})} 
                        className="text-sm font-bold text-gray-700 bg-transparent outline-none cursor-pointer"
                    >
                        <option value={0}>Todos os Meses</option>
                        {Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('pt-PT', {month: 'long'})}</option>)}
                    </select>
                    <select 
                        value={yearFilter} 
                        onChange={e => setDateFilters({...dateFilters, year: Number(e.target.value)})} 
                        className="text-sm font-bold text-gray-700 bg-transparent outline-none cursor-pointer border-l pl-2"
                    >
                        {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* LINHA 1: CARDS KPI */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 shrink-0">
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

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden border-l-4 border-l-red-500">
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

                {/* Faturação vs Meta Mensal */}
                <div title={`Comparação da meta mensal vs faturação do período selecionado`} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between h-32">
                    <div>
                        <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Faturação vs Meta Mensal</div>
                        <div className="text-sm text-gray-600 mb-2">{billingStats.monthlyBilled.toLocaleString()} CVE de {billingStats.monthlyTarget.toLocaleString()} CVE</div>
                        <div className="text-2xl font-black" style={{color: billingStats.billingPercent >= 100 ? '#16a34a' : '#f97316'}}>{billingStats.billingPercent}%</div>
                    </div>
                    <div className="w-24 h-24 flex items-center justify-center">
                        <svg width="80" height="80" viewBox="0 0 36 36">
                            <path d="M18 2a16 16 0 1 1 0 32a16 16 0 0 1 0-32" fill="none" stroke="#e6e6e6" strokeWidth="4"/>
                            <path d="M18 2a16 16 0 1 1 0 32a16 16 0 0 1 0-32" fill="none" stroke={billingStats.billingPercent >= 100 ? '#16a34a' : '#f97316'} strokeWidth="4" strokeDasharray={`${Math.min(100, billingStats.billingPercent)} 100`} strokeLinecap="round" transform="rotate(-90 18 18)"/>
                            <text x="18" y="20" textAnchor="middle" fontSize="6" fill="#111">{billingStats.billingPercent}%</text>
                        </svg>
                    </div>
                </div>
            </div>

            {/* LINHA 2: GRÁFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
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
                                <Tooltip formatter={(value: number) => value.toLocaleString('pt-CV') + ' CVE'} />
                                <Legend verticalAlign="bottom" height={36}/>
                            </RePieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Line Chart Trends */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col lg:col-span-2">
                    <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Activity size={16}/> Tendência Operacional</h4>
                    <div className="flex-1 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartsData.trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                                <Tooltip formatter={(value: number) => value.toLocaleString('pt-CV') + ' CVE'} />
                                <Legend />
                                <Line type="monotone" dataKey="Receita" stroke="#3b82f6" strokeWidth={2} dot={{r: 4}} activeDot={{r: 6}} />
                                <Line type="monotone" dataKey="DespesaFixa" name="Custo Fixo (Breakeven)" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ZONA DE RELATÓRIOS AVANÇADOS */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <FileText size={16}/> Relatórios Avançados
                </h4>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full md:w-auto">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Período</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                className="border rounded-lg p-2 text-sm w-full outline-none focus:ring-2 focus:ring-green-500"
                                value={reportStartDate}
                                onChange={e => setReportStartDate(e.target.value)}
                            />
                            <span className="text-gray-400">-</span>
                            <input 
                                type="date" 
                                className="border rounded-lg p-2 text-sm w-full outline-none focus:ring-2 focus:ring-green-500"
                                value={reportEndDate}
                                onChange={e => setReportEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                        <button onClick={() => handlePrintReport('balancete')} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-green-700 font-bold text-xs uppercase shadow-sm transition-all whitespace-nowrap">
                            <Download size={14}/> Balancete
                        </button>
                        <button onClick={() => handlePrintReport('consolidado')} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-blue-700 font-bold text-xs uppercase shadow-sm transition-all whitespace-nowrap">
                            <Download size={14}/> Extrato Consolidado
                        </button>
                        <button onClick={() => handlePrintReport('financeiro')} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-purple-700 font-bold text-xs uppercase shadow-sm transition-all whitespace-nowrap">
                            <Download size={14}/> Relatório Financeiro
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
