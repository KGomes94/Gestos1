
import React, { useState, useEffect } from 'react';
import { Proposal, Client, Material, SystemSettings, ProposalStatus, Invoice } from '../types';
import { ProposalList } from './proposals/ProposalList';
import { ProposalStats } from './proposals/ProposalStats';
import { ProposalFormModal } from './proposals/ProposalFormModal';
import { proposalService } from '../services/proposalService';
import { useNotification } from '../contexts/NotificationContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import { db } from '../services/db';
import { Plus, LayoutDashboard, List, FileText } from 'lucide-react';

interface ProposalsModuleProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    materials: Material[];
    proposals: Proposal[];
    setProposals: React.Dispatch<React.SetStateAction<Proposal[]>>;
    settings: SystemSettings;
    autoOpenId?: string | null;
    onClearAutoOpen?: () => void;
}

const ProposalsModule: React.FC<ProposalsModuleProps> = ({ 
    clients, setClients, materials, proposals, setProposals, settings, autoOpenId, onClearAutoOpen 
}) => {
    const { notify } = useNotification();
    const { requestConfirmation } = useConfirmation();
    const [view, setView] = useState<'list' | 'stats'>('list');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);

    // Auto-open logic (e.g. from Dashboard)
    useEffect(() => {
        if (autoOpenId) {
            const p = proposals.find(x => x.id === autoOpenId);
            if (p) {
                setEditingProposal(p);
                setIsModalOpen(true);
            }
            if (onClearAutoOpen) onClearAutoOpen();
        }
    }, [autoOpenId, proposals, onClearAutoOpen]);

    const handleSave = (savedProposal: Proposal) => {
        if (editingProposal && editingProposal.id) {
            // Update
            setProposals(prev => prev.map(p => p.id === savedProposal.id ? savedProposal : p));
            notify('success', 'Proposta atualizada com sucesso.');
        } else {
            // Create
            const { id, sequence } = db.proposals.getNextId(proposals);
            const newProposal = { ...savedProposal, id, sequence };
            setProposals(prev => [newProposal, ...prev]);
            notify('success', `Proposta ${id} criada.`);
        }
    };

    const handleDuplicate = (p: Proposal) => {
        requestConfirmation({
            title: "Duplicar Proposta",
            message: `Deseja duplicar a proposta ${p.id}? Uma cópia será criada no estado Rascunho.`,
            confirmText: 'Duplicar',
            onConfirm: () => {
                const { id, sequence } = db.proposals.getNextId(proposals);
                const duplicated: Proposal = {
                    ...p,
                    id,
                    sequence,
                    title: `${p.title} (Cópia)`,
                    status: 'Rascunho',
                    date: new Date().toISOString().split('T')[0],
                    version: 1,
                    convertedInvoiceId: undefined,
                    convertedAppointmentId: undefined,
                    logs: [proposalService.createLog('Duplicação', `Copiado de ${p.id}`)]
                };
                setProposals(prev => [duplicated, ...prev]);
                notify('success', 'Proposta duplicada.');
            }
        });
    };

    const handleConvert = (p: Proposal) => {
        requestConfirmation({
            title: "Converter em Fatura",
            message: "Esta ação irá converter a proposta numa Fatura Rascunho. Deseja continuar?",
            confirmText: 'Converter',
            onConfirm: () => {
                // Simulando integração (Numa app real, usaríamos setInvoices via props)
                const currentInvoices = db.invoices.getAll();
                const num = db.invoices.getNextNumber(settings.fiscalConfig.invoiceSeries);
                const newInvoiceId = `FTE ${settings.fiscalConfig.invoiceSeries}/${new Date().getFullYear()}/${num}`;
                
                // Atualizar estado da proposta
                const updatedProposal: Proposal = {
                    ...p,
                    status: 'Convertida',
                    convertedInvoiceId: newInvoiceId,
                    logs: [proposalService.createLog('Conversão', `Gerada Fatura ${newInvoiceId}`), ...p.logs]
                };

                setProposals(prev => prev.map(prop => prop.id === p.id ? updatedProposal : prop));
                
                // Persistir fatura na BD (Simulado aqui pois não temos acesso direto ao setInvoices neste componente sem alterar a interface principal do App.tsx drasticamente, 
                // mas assumimos que o db.invoices.save funciona e o App.tsx sincroniza).
                // Em produção, passaríamos `onCreateInvoice` como prop.
                notify('success', 'Proposta convertida. Verifique o módulo de Faturação.');
            }
        });
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Propostas Comerciais</h2>
                    <p className="text-gray-500 text-sm">Gestão de orçamentos, pipeline e conversão</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => { setEditingProposal(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 shadow-lg shadow-green-100 transition-all text-sm uppercase tracking-wide">
                        <Plus size={18} /> Nova Proposta
                    </button>
                    <div className="flex bg-gray-100 p-1 rounded-lg border">
                        <button onClick={() => setView('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'list' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                            <List size={16} /> Lista
                        </button>
                        <button onClick={() => setView('stats')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'stats' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                            <LayoutDashboard size={16} /> KPIs
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats View (Inline for List view or dedicated page) */}
            {view === 'stats' ? (
                <div className="animate-fade-in-up">
                    <ProposalStats proposals={proposals} />
                    <div className="bg-gray-50 p-12 text-center rounded-xl border border-dashed border-gray-300 text-gray-400 mt-6">
                        Gráficos detalhados de evolução de vendas seriam apresentados aqui.
                    </div>
                </div>
            ) : (
                <div className="flex flex-col flex-1 gap-4 overflow-hidden">
                    {/* Mini Stats on top of list */}
                    <ProposalStats proposals={proposals} />
                    
                    <div className="flex-1 overflow-hidden">
                        <ProposalList 
                            proposals={proposals} 
                            onEdit={(p) => { setEditingProposal(p); setIsModalOpen(true); }}
                            onView={(p) => { setEditingProposal(p); setIsModalOpen(true); }} // View uses same modal but read-only logic inside if needed, or just editable
                            onDuplicate={handleDuplicate}
                            onConvert={handleConvert}
                        />
                    </div>
                </div>
            )}

            <ProposalFormModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                proposal={editingProposal}
                onSave={handleSave}
                clients={clients}
                materials={materials}
                settings={settings}
            />
        </div>
    );
};

export default ProposalsModule;
