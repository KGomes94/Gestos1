
import React, { useMemo } from 'react';
import { Proposal } from '../../types';
import { FileText, CheckCircle2, XCircle, Clock, TrendingUp, DollarSign } from 'lucide-react';

interface ProposalStatsProps {
    proposals: Proposal[];
}

export const ProposalStats: React.FC<ProposalStatsProps> = ({ proposals }) => {
    
    const stats = useMemo(() => {
        const total = proposals.length;
        const accepted = proposals.filter(p => p.status === 'Aceite' || p.status === 'Convertida' || p.status === 'Aprovada' || p.status === 'Executada').length;
        const open = proposals.filter(p => p.status === 'Enviada' || p.status === 'Rascunho' || p.status === 'Criada').length;
        const rejected = proposals.filter(p => p.status === 'Rejeitada').length;
        
        const totalValue = proposals.reduce((acc, p) => acc + (p.total || 0), 0);
        const pipelineValue = proposals.filter(p => p.status === 'Enviada').reduce((acc, p) => acc + (p.total || 0), 0);
        const conversionRate = total > 0 ? (accepted / total) * 100 : 0;

        return { total, accepted, open, rejected, totalValue, pipelineValue, conversionRate };
    }, [proposals]);

    const formatCurrency = (val: number) => val.toLocaleString('pt-CV', { maximumFractionDigits: 0 }) + ' CVE';

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase text-gray-400">Total Proposto</p>
                    <h3 className="text-xl font-bold text-gray-800">{formatCurrency(stats.totalValue)}</h3>
                    <div className="flex items-center gap-1 mt-1">
                        <TrendingUp size={12} className="text-green-500"/>
                        <span className="text-xs text-green-600 font-bold">{stats.total} docs</span>
                    </div>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><FileText size={20}/></div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase text-gray-400">Em Pipeline (Aberto)</p>
                    <h3 className="text-xl font-bold text-blue-600">{formatCurrency(stats.pipelineValue)}</h3>
                    <div className="flex items-center gap-1 mt-1">
                        <Clock size={12} className="text-blue-400"/>
                        <span className="text-xs text-blue-500 font-bold">{stats.open} propostas</span>
                    </div>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={20}/></div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase text-gray-400">Taxa de Conversão</p>
                    <h3 className="text-xl font-bold text-green-700">{stats.conversionRate.toFixed(1)}%</h3>
                    <div className="flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} className="text-green-500"/>
                        <span className="text-xs text-green-600 font-bold">{stats.accepted} aceites</span>
                    </div>
                </div>
                <div className="p-3 bg-green-50 text-green-600 rounded-lg"><TrendingUp size={20}/></div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase text-gray-400">Perdidas / Rejeitadas</p>
                    <h3 className="text-xl font-bold text-red-600">{stats.rejected}</h3>
                    <div className="text-xs text-red-400 font-medium mt-1">Oportunidades perdidas</div>
                </div>
                <div className="p-3 bg-red-50 text-red-600 rounded-lg"><XCircle size={20}/></div>
            </div>
        </div>
    );
};
