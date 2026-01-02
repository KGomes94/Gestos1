
import React, { useMemo, useState, useEffect } from 'react';
import { Invoice, Purchase, Transaction, Account, Client, SystemSettings } from '../types';
import { currency } from '../utils/currency';
import { Wallet, TrendingUp, TrendingDown, Activity, PieChart, FileText, Download, Printer } from 'lucide-react';
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

    // Estados para Relatórios Avançados (Data Customizada)
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
        
        // Atualizar também o intervalo customizado para coincidir com o filtro rápido visualmente
        const y = dateFilters.year;
        const m = dateFilters.month;
        if (m !== 0) {
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 0);
            setReportStartDate(start.toISOString().split('T')[0]);
            setReportEndDate(end.toISOString().split('T')[0]);
        } else {
            setReportStartDate(`${y}-01-01`);
            setReportEndDate(`${y}-12-31`);
        }
    }, [dateFilters]);

    const { month: monthFilter, year: yearFilter } = dateFilters;

    // --- HELPERS ---
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

    // --- CÁLCULO DE KPIs (LIQUIDEZ - Tesouraria) ---
    const liquidityStats = useMemo(() => {
        const receivableToday = invoices
            .filter(i => i.status === 'Emitida' && i.date === todayStr) 
            .reduce((acc, i) => currency.add(acc, i.total), 0);

        const payableToday = purchases
            .filter(p => p.status === 'Aberta' && p.dueDate === todayStr)
            .reduce((acc, p) => currency.add(acc, p.total), 0);

        const receivableMonth = invoices
            .filter(i => (i.status === 'Emitida' || i.status === 'Pendente Envio') && isSameMonth(i.dueDate))
            .reduce((acc, i) => currency.add(acc, i.total), 0);

        const payableMonth = purchases
            .filter(p => p.status === 'Aberta' && isSameMonth(p.dueDate))
            .reduce((acc, p) => currency.add(acc, p.total), 0);

        const forecast = currency.sub(currency.add(currentBalance, receivableMonth), payableMonth);

        return { receivableToday, payableToday, receivableMonth, payableMonth, forecast };
    }, [invoices, purchases, currentBalance, monthFilter, yearFilter]);

    // --- DRE COMPLETO (Demonstração de Resultados - Competência) ---
    const dreStats = useMemo(() => {
        // Filtra documentos do período (exclui rascunhos/anulados)
        const periodInvoices = invoices.filter(i => isSameMonth(i.date) && i.status !== 'Rascunho' && i.status !== 'Anulada');
        const periodPurchases = purchases.filter(p => isSameMonth(p.date) && p.status !== 'Rascunho' && p.status !== 'Anulada');

        // 1. Receita Operacional Bruta (Faturação Total)
        const grossRevenue = periodInvoices.reduce((acc, i) => currency.add(acc, i.total), 0);

        // 2. Deduções (Impostos s/ Vendas, Devoluções, Descontos concedidos)
        // Nota: i.total já inclui IVA. i.subtotal é a base.
        // Se considerarmos Receita Bruta = Total Faturado, então IVA é uma dedução.
        const taxesOnSales = periodInvoices.reduce((acc, i) => currency.add(acc, i.taxTotal), 0);
        // Notas de Crédito (Devoluções) - assumimos que NCEs estão na lista com valor positivo mas type='NCE'
        const returns = invoices.filter(i => isSameMonth(i.date) && i.type === 'NCE' && i.status !== 'Rascunho').reduce((acc, i) => currency.add(acc, i.total), 0);
        
        const deductions = currency.add(taxesOnSales, returns);

        // 3. Receita Operacional Líquida
        const netRevenue = currency.sub(grossRevenue, deductions);

        // 4. CMV / Custo Variável (Grupo 2)
        const variableCosts = periodPurchases.filter(p => {
            const cat = categories.find(c => c.id === p.categoryId);
            return cat && (cat.type === 'Custo Direto' || cat.code.startsWith('2.'));
        }).reduce((acc, p) => currency.add(acc, p.total), 0);

        // 5. Lucro Bruto (Margem de Contribuição)
        const grossProfit = currency.sub(netRevenue, variableCosts);
        const grossMarginPerc = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

        // 6. Despesas Operacionais / Fixas (Grupo 3)
        const fixedCosts = periodPurchases.filter(p => {
            const cat = categories.find(c => c.id === p.categoryId);
            return cat && (cat.type === 'Custo Fixo' || cat.code.startsWith('3.'));
        }).reduce((acc, p) => currency.add(acc, p.total), 0);

        // 7. EBITDA (Resultado Operacional antes de Financeiros/Depreciação)
        const ebitda = currency.sub(grossProfit, fixedCosts);
        const ebitdaMargin = netRevenue > 0 ? (ebitda / netRevenue) * 100 : 0;

        // 8. Resultado Financeiro (Grupo 4)
        const financialCosts = periodPurchases.filter(p => {
            const cat = categories.find(c => c.id === p.categoryId);
            return cat && (cat.type === 'Despesa Financeira' || cat.code.startsWith('4.'));
        }).reduce((acc, p) => currency.add(acc, p.total), 0);

        // 9. Resultado Líquido do Exercício
        const netIncome = currency.sub(ebitda, financialCosts);
        const netMarginPerc = netRevenue > 0 ? (netIncome / netRevenue) * 100 : 0;

        return { 
            grossRevenue, deductions, netRevenue, 
            variableCosts, grossProfit, grossMarginPerc,
            fixedCosts, ebitda, ebitdaMargin,
            financialCosts, netIncome, netMarginPerc
        };
    }, [invoices, purchases, categories, monthFilter, yearFilter]);

    // --- DADOS PARA GRÁFICOS ---
    const chartsData = useMemo(() => {
        const expenseComposition = [
            { name: 'CMV / Variável', value: dreStats.variableCosts },
            { name: 'Custos Fixos', value: dreStats.fixedCosts },
            { name: 'Financeiro', value: dreStats.financialCosts },
        ].filter(i => i.value > 0);

        const trendData = [];
        const monthsToShow = monthFilter === 0 ? 12 : 6;
        const startMonthIndex = monthFilter === 0 ? 0 : (monthFilter - 6); 

        for (let i = 0; i < monthsToShow; i++) {
            let m = startMonthIndex + i;
            let y = yearFilter;
            if (m < 0) { m += 12; y -= 1; }

            const monthLabel = new Date(y, m).toLocaleString('pt-PT', { month: 'short' });
            
            // Recalcular simplificado para gráfico
            const monthInvs = invoices.filter(inv => {
                if (!inv.date || inv._deleted || inv.status === 'Rascunho' || inv.type === 'NCE') return false;
                const [iy, im] = inv.date.split('-').map(Number);
                return (im - 1) === m && iy === y;
            });
            const monthPurs = purchases.filter(pur => {
                if (!pur.date || pur._deleted || pur.status === 'Anulada') return false;
                const [py, pm] = pur.date.split('-').map(Number);
                return (pm - 1) === m && py === y;
            });
            
            const rec = monthInvs.reduce((acc, i) => currency.add(acc, i.subtotal), 0); // Usar subtotal para gráfico
            const des = monthPurs.reduce((acc, p) => currency.add(acc, p.total), 0);

            trendData.push({
                name: `${monthLabel}`,
                Receita: rec,
                Despesa: des,
                Lucro: rec - des
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
            // Agora usa a lógica completa do DRE
            printService.printPeriodFinancialReport(transactions, invoices, purchases, categories, period, settings);
        }
    };

    // Componente de Linha do DRE
    const DreRow = ({ label, value, isTotal = false, isSub = false, percent = 0, indent = false, negative = false }: any) => (
        <div className={`flex justify-between items-center py-2 border-b border-gray-100 ${isTotal ? 'bg-gray-50 font-bold' : ''} ${isSub ? 'text-gray-500 text-xs' : 'text-sm text-gray-700'}`}>
            <div className={`flex-1 ${indent ? 'pl-6' : ''}`}>
                {label}
            </div>
            <div className="w-32 text-right font-mono">
                <span className={negative ? 'text-red-600' : (isTotal && value > 0 ? 'text-green-700' : '')}>
                    {negative && value > 0 ? '-' : ''}{Math.abs(value).toLocaleString()}
                </span>
            </div>
            <div className="w-16 text-right text-xs text-gray-400 font-medium">
                {percent !== 0 ? `${percent.toFixed(1)}%` : '-'}
            </div>
        </div>
    );

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

            {/* LINHA 1: KPIs LIQUIDEZ */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-28 border-l-4 border-l-blue-500">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Saldo Disponível (Caixa)</p>
                    <h3 className="text-2xl font-black text-gray-800">{currentBalance.toLocaleString()} <span className="text-sm text-gray-400 font-normal">CVE</span></h3>
                    <p className="text-[10px] text-gray-500">Previsão Fim Mês: <span className={liquidityStats.forecast >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{liquidityStats.forecast.toLocaleString()}</span></p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-28 border-l-4 border-l-purple-500">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Resultado Líquido (Competência)</p>
                    <h3 className={`text-2xl font-black ${dreStats.netIncome >= 0 ? 'text-purple-700' : 'text-red-600'}`}>{dreStats.netIncome.toLocaleString()} <span className="text-sm text-gray-400 font-normal">CVE</span></h3>
                    <p className="text-[10px] text-gray-500">Margem Líquida: <strong>{dreStats.netMarginPerc.toFixed(1)}%</strong></p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-28 border-l-4 border-l-green-500">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">A Receber (Hoje)</p>
                    <h3 className="text-2xl font-black text-green-700">{liquidityStats.receivableToday.toLocaleString()} <span className="text-sm text-gray-400 font-normal">CVE</span></h3>
                    <p className="text-[10px] text-gray-400">Total Mês: {liquidityStats.receivableMonth.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-28 border-l-4 border-l-red-500">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">A Pagar (Hoje)</p>
                    <h3 className="text-2xl font-black text-red-600">{liquidityStats.payableToday.toLocaleString()} <span className="text-sm text-gray-400 font-normal">CVE</span></h3>
                    <p className="text-[10px] text-gray-400">Total Mês: {liquidityStats.payableMonth.toLocaleString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLUNA ESQUERDA: DRE COMPLETO */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><FileText size={16}/> DRE - Demonstração de Resultados</h4>
                        <span className="text-xs font-mono text-gray-500 bg-gray-200 px-2 py-1 rounded">Valores em CVE</span>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[500px]">
                        
                        <div className="mb-2 grid grid-cols-3 text-[10px] font-black text-gray-400 uppercase border-b pb-1">
                            <div className="col-span-2">Descrição</div>
                            <div className="text-right pr-16">Valor</div>
                            <div className="text-right">AV %</div>
                        </div>

                        {/* RECEITA */}
                        <DreRow label="1. Faturação Bruta (Vendas + Serviços)" value={dreStats.grossRevenue} isTotal />
                        <DreRow label="(-) Impostos e Deduções" value={dreStats.deductions} negative indent isSub />
                        
                        {/* RECEITA LÍQUIDA */}
                        <DreRow label="2. Receita Operacional Líquida" value={dreStats.netRevenue} isTotal percent={100} />
                        
                        {/* CUSTOS VARIÁVEIS */}
                        <DreRow label="(-) Custos Variáveis (CMV / CPV)" value={dreStats.variableCosts} negative />
                        
                        {/* MARGEM BRUTA */}
                        <DreRow label="3. Margem Bruta (Contribuição)" value={dreStats.grossProfit} isTotal percent={dreStats.grossMarginPerc} />
                        
                        {/* CUSTOS FIXOS */}
                        <DreRow label="(-) Despesas Fixas Operacionais" value={dreStats.fixedCosts} negative />
                        
                        {/* EBITDA */}
                        <div className="my-2 border-t border-gray-200"></div>
                        <div className="bg-blue-50/50 rounded-lg">
                            <DreRow label="4. EBITDA (Resultado Operacional)" value={dreStats.ebitda} isTotal percent={dreStats.ebitdaMargin} />
                        </div>
                        <div className="my-2 border-b border-gray-200"></div>

                        {/* FINANCEIRO */}
                        <DreRow label="(-) Resultado Financeiro / Amortizações" value={dreStats.financialCosts} negative />
                        
                        {/* RESULTADO LIQUIDO */}
                        <div className="mt-4 bg-gray-100 p-3 rounded-xl border border-gray-200">
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="text-xs font-black text-gray-500 uppercase">5. Resultado Líquido do Exercício</span>
                                    <h3 className={`text-2xl font-black ${dreStats.netIncome >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                        {dreStats.netIncome.toLocaleString()} CVE
                                    </h3>
                                </div>
                                <div className="text-right">
                                    <span className="block text-[10px] text-gray-400 font-bold uppercase">Margem Líquida</span>
                                    <span className={`text-lg font-bold ${dreStats.netMarginPerc >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {dreStats.netMarginPerc.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* COLUNA DIREITA: GRÁFICOS */}
                <div className="flex flex-col gap-6">
                    {/* Donut */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col h-64">
                        <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><PieChart size={16}/> Estrutura de Custos</h4>
                        <div className="flex-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie data={chartsData.expenseComposition} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                                        {chartsData.expenseComposition.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => value.toLocaleString() + ' CVE'} />
                                    <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{fontSize: '10px'}}/>
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Trend Line */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-1 min-h-[250px]">
                        <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Activity size={16}/> Evolução Mensal</h4>
                        <div className="flex-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartsData.trendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={10} width={40} />
                                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                                    <Line type="monotone" dataKey="Receita" stroke="#10b981" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="Lucro" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* ZONA DE RELATÓRIOS (Footer) */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="p-2 bg-white rounded-lg border shadow-sm"><Printer size={20} className="text-gray-500"/></div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-800">Exportar Relatórios Oficiais</h4>
                        <div className="flex gap-2 items-center text-xs mt-1">
                            <input type="date" className="border rounded p-1" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)}/>
                            <span className="text-gray-400">até</span>
                            <input type="date" className="border rounded p-1" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)}/>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => handlePrintReport('balancete')} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-green-700 font-bold text-xs uppercase shadow-sm transition-all">
                        <Download size={14}/> Balancete
                    </button>
                    <button onClick={() => handlePrintReport('financeiro')} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 border border-purple-600 text-white rounded-xl hover:bg-purple-700 font-bold text-xs uppercase shadow-lg transition-all">
                        <FileText size={14}/> DRE (PDF)
                    </button>
                </div>
            </div>
        </div>
    );
};
