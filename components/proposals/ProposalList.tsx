
import React, { useState, useMemo } from 'react';
import { Proposal, ProposalStatus } from '../../types';
import { Search, Eye, Edit, Copy, CheckCircle, FileText, Filter, Calendar, Flame, Snowflake, Sun } from 'lucide-react';
import { proposalService } from '../../services/proposalService';

interface ProposalListProps {
    proposals: Proposal[];
    onEdit: (p: Proposal) => void;
    onView: (p: Proposal) => void;
    onDuplicate: (p: Proposal) => void;
    onConvert: (p: Proposal) => void;
}

export const ProposalList: React.FC<ProposalListProps> = ({ proposals, onEdit, onView, onDuplicate, onConvert }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('Todos');
    const [monthFilter, setMonthFilter] = useState<number>(new Date().getMonth() + 1);
    const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());

    const filteredProposals = useMemo(() => {
        return proposals.filter(p => {
            const matchSearch = 
                p.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                p.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.title?.toLowerCase().includes(searchTerm.toLowerCase());
            
            // Normalize old statuses to new statuses for filtering consistency
            const normalizedStatus = 
                p.status === 'Criada' ? 'Rascunho' : 
                p.status === 'Aprovada' || p.status === 'Executada' ? 'Aceite' : 
                p.status;

            const matchStatus = statusFilter === 'Todos' || normalizedStatus === statusFilter;
            
            const pDate = new Date(p.date);
            const matchDate = (pDate.getMonth() + 1 === monthFilter) && (pDate.getFullYear() === yearFilter);

            return matchSearch && matchStatus && matchDate;
        }).sort((a, b) => b.sequence - a.sequence); // Sort descending by sequence
    }, [proposals, searchTerm, statusFilter, monthFilter, yearFilter]);

    const getStatusStyle = (status: string, validUntil: string) => {
        const isExpired = new Date(validUntil) < new Date() && status !== 'Convertida' && status !== 'Aceite' && status !== 'Rejeitada';
        
        if (isExpired) return 'bg-red-50 text-red-600 border-red-200';
        
        switch(status) {
            case 'Aceite': 
            case 'Aprovada': 
            case 'Executada':
            case 'Convertida': return 'bg-green-50 text-green-700 border-green-200';
            case 'Enviada': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'Rejeitada': return 'bg-gray-100 text-gray-500 border-gray-200 line-through';
            default: return 'bg-yellow-50 text-yellow-700 border-yellow-200'; // Rascunho
        }
    };

    const getStatusLabel = (p: Proposal) => {
        if (proposalService.checkExpiration(p)) return 'Expirada';
        return p.status;
    };

    const TemperatureIcon = ({ temp }: { temp: string }) => {
        switch(temp) {
            case 'Hot': return <Flame size={16} className="text-red-500" fill="currentColor" title="Quente (Urgente)" />;
            case 'Warm': return <Sun size={16} className="text-orange-400" fill="currentColor" title="Morno (Em negociação)" />;
            case 'Cold': return <Snowflake size={16} className="text-blue-300" title="Frio (Rascunho)" />;
            case 'Won': return <CheckCircle size={16} className="text-green-500" title="Ganho" />;
            case 'Lost': return <div className="w-2 h-2 rounded-full bg-gray-300" title="Perdido" />;
            default: return <div className="w-2 h-2 rounded-full bg-gray-200" />;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full animate-fade-in-up">
            {/* Filters Toolbar */}
            <div className="p-4 border-b bg-gray-50/50 flex flex-col md:flex-row gap-4 items-center justify-between shrink-0">
                <div className="relative w-full md:w-64">
                    <input 
                        type="text" 
                        placeholder="Pesquisar cliente, ref..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="pl-9 pr-3 py-2 border rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                </div>
                
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <div className="flex items-center bg-white border rounded-xl px-2">
                        <Filter size={14} className="text-gray-400 mr-2"/>
                        <select className="py-2 text-xs font-bold text-gray-700 outline-none bg-transparent" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="Todos">Todos os Estados</option>
                            <option value="Rascunho">Rascunhos</option>
                            <option value="Enviada">Enviadas</option>
                            <option value="Aceite">Aceites/Convertidas</option>
                            <option value="Rejeitada">Rejeitadas</option>
                        </select>
                    </div>
                    <div className="flex items-center bg-white border rounded-xl px-2">
                        <Calendar size={14} className="text-gray-400 mr-2"/>
                        <select className="py-2 text-xs font-bold text-gray-700 outline-none bg-transparent" value={monthFilter} onChange={e => setMonthFilter(Number(e.target.value))}>
                            {Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('pt-PT', {month: 'long'})}</option>)}
                        </select>
                        <select className="py-2 text-xs font-bold text-gray-700 outline-none bg-transparent border-l ml-2 pl-2" value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))}>
                            <option value={2024}>2024</option>
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 text-center w-10">Prob.</th>
                            <th className="px-6 py-4 text-left">Referência</th>
                            <th className="px-6 py-4 text-left">Cliente</th>
                            <th className="px-6 py-4 text-left">Emissão / Validade</th>
                            <th className="px-6 py-4 text-right">Valor Total</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredProposals.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center">
                                        <TemperatureIcon temp={proposalService.getTemperature(p)} />
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-mono font-bold text-gray-600 flex items-center gap-2">
                                        {p.id}
                                        {p.version > 1 && <span className="bg-gray-200 text-gray-600 px-1.5 rounded text-[9px]">v{p.version}</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-400">{p.title || 'Sem título'}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-800">{p.clientName}</div>
                                    {p.clientNif && <div className="text-xs text-gray-400 font-mono">NIF: {p.clientNif}</div>}
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-600">
                                    <div className="flex gap-2"><span>E: {new Date(p.date).toLocaleDateString('pt-PT')}</span></div>
                                    <div className={`flex gap-2 font-medium mt-0.5 ${proposalService.checkExpiration(p) ? 'text-red-500' : 'text-gray-500'}`}><span>V: {new Date(p.validUntil).toLocaleDateString('pt-PT')}</span></div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="font-black text-gray-900">{(p.total || 0).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">{p.currency || 'CVE'}</span></div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${getStatusStyle(p.status, p.validUntil)}`}>
                                        {getStatusLabel(p)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {/* Actions based on status */}
                                        <button onClick={() => onView(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver"><Eye size={16}/></button>
                                        
                                        {(p.status === 'Rascunho' || p.status === 'Criada') && (
                                            <button onClick={() => onEdit(p)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Editar"><Edit size={16}/></button>
                                        )}
                                        
                                        <button onClick={() => onDuplicate(p)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Duplicar"><Copy size={16}/></button>
                                        
                                        {(p.status === 'Aceite' || p.status === 'Aprovada') && !p.convertedInvoiceId && (
                                            <button onClick={() => onConvert(p)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="Converter em Fatura"><FileText size={16}/></button>
                                        )}
                                        
                                        {p.convertedInvoiceId && (
                                            <span className="p-2 text-green-600 flex items-center gap-1 text-[10px] font-bold bg-green-50 rounded-lg border border-green-100 cursor-default">
                                                <CheckCircle size={12}/> Faturado
                                            </span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredProposals.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm italic">
                                    Nenhuma proposta encontrada com os filtros atuais.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
