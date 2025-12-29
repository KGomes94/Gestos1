
import React, { useMemo } from 'react';
import { Material, Invoice } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Box, Wrench, AlertTriangle, TrendingUp } from 'lucide-react';

interface CatalogStatsProps {
    materials: Material[];
    invoices: Invoice[];
}

export const CatalogStats: React.FC<CatalogStatsProps> = ({ materials, invoices }) => {
    
    // 1. Distribuição de Tipos
    const typeDistribution = useMemo(() => {
        const matCount = materials.filter(m => m.type === 'Material').length;
        const svcCount = materials.filter(m => m.type === 'Serviço').length;
        return [
            { name: 'Materiais', value: matCount, color: '#3b82f6' },
            { name: 'Serviços', value: svcCount, color: '#a855f7' }
        ];
    }, [materials]);

    // 2. Itens Mais Vendidos (Baseado em Faturas Emitidas/Pagas)
    const topItems = useMemo(() => {
        const counts: Record<string, number> = {};
        invoices.forEach(inv => {
            if (inv.status === 'Rascunho' || inv.status === 'Anulada') return;
            inv.items.forEach(item => {
                // Tenta agrupar por nome já que itemCode pode não estar sempre linkado
                const key = item.description; 
                counts[key] = (counts[key] || 0) + item.quantity;
            });
        });

        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, qtd]) => ({ name, qtd }));
    }, [invoices]);

    // 3. Alertas de Stock
    const lowStockItems = useMemo(() => {
        return materials.filter(m => m.type === 'Material' && (m.stock || 0) <= (m.minStock || 0));
    }, [materials]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Card Distribuição */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Box size={18}/> Composição do Catálogo
                    </h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={typeDistribution} 
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" cy="50%" 
                                    innerRadius={40} 
                                    outerRadius={70}
                                    paddingAngle={5}
                                >
                                    {typeDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 text-xs font-bold text-gray-500">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> Materiais ({typeDistribution[0].value})</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-500 rounded-full"></div> Serviços ({typeDistribution[1].value})</div>
                    </div>
                </div>

                {/* Card Top Vendas */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 md:col-span-2">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <TrendingUp size={18}/> Top 5 Mais Vendidos
                    </h3>
                    {topItems.length > 0 ? (
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topItems} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 10}} />
                                    <Tooltip cursor={{fill: '#f9fafb'}} />
                                    <Bar dataKey="qtd" fill="#16a34a" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-gray-400 italic text-sm">Sem dados de vendas suficientes.</div>
                    )}
                </div>
            </div>

            {/* Alertas de Stock */}
            {lowStockItems.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                    <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
                        <AlertTriangle size={18}/> Alertas de Stock Baixo
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {lowStockItems.map(m => (
                            <div key={m.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-gray-800 text-sm">{m.name}</div>
                                    <div className="text-xs text-gray-500 font-mono">{m.internalCode}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-red-600 font-black text-lg">{m.stock}</div>
                                    <div className="text-[9px] text-red-400 uppercase font-bold">Mín: {m.minStock}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
