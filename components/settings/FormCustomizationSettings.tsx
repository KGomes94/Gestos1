
import React, { useState } from 'react';
import { SystemSettings, InvoiceLayoutConfig, ServiceOrderLayoutConfig, ProposalLayoutConfig } from '../../types';
import { FileText, CreditCard, Calendar, FileBarChart, ToggleLeft, ToggleRight, LayoutTemplate, Palette } from 'lucide-react';

interface FormCustomizationSettingsProps {
    settings: SystemSettings;
    onChange: (newSettings: SystemSettings) => void;
}

export const FormCustomizationSettings: React.FC<FormCustomizationSettingsProps> = ({ settings, onChange }) => {
    const [activeTab, setActiveTab] = useState<'proposals' | 'invoices' | 'orders' | 'reports'>('proposals');

    // Default Configs if undefined (Fixed Types)
    const proposalConfig: ProposalLayoutConfig = settings.proposalLayout || {
        primaryColor: '#16a34a',
        secondaryColor: '#f0fdf4',
        backgroundStyle: 'clean',
        headerShape: 'rounded',
        showClientNif: true,
        showClientAddress: true,
        showTerms: true,
        showSignature: true,
        showValidity: true
    };

    const invoiceConfig: InvoiceLayoutConfig = settings.invoiceLayout || { 
        showQrCode: true, showBankInfo: true, customFooterText: '', showSalesman: false, bankInfoText: '' 
    };
    const orderConfig: ServiceOrderLayoutConfig = settings.serviceOrderLayout || { 
        showPrices: false, showTechnicianName: true, disclaimerText: '', showClientSignature: true 
    };

    const updateProposalLayout = (updates: Partial<ProposalLayoutConfig>) => {
        onChange({ ...settings, proposalLayout: { ...proposalConfig, ...updates } });
    };

    const updateInvoiceLayout = (updates: Partial<InvoiceLayoutConfig>) => {
        onChange({ ...settings, invoiceLayout: { ...invoiceConfig, ...updates } });
    };

    const updateOrderLayout = (updates: Partial<ServiceOrderLayoutConfig>) => {
        onChange({ ...settings, serviceOrderLayout: { ...orderConfig, ...updates } });
    };

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                activeTab === id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            <Icon size={16}/> {label}
        </button>
    );

    const Toggle = ({ label, checked, onChange, description }: any) => (
        <div className="flex items-start gap-3 p-3 border rounded-lg bg-white">
            <button onClick={() => onChange(!checked)} className={`mt-0.5 ${checked ? 'text-green-600' : 'text-gray-300'}`}>
                {checked ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
            </button>
            <div>
                <span className="text-sm font-bold text-gray-800 block">{label}</span>
                {description && <span className="text-xs text-gray-500">{description}</span>}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <LayoutTemplate size={20} className="text-green-600"/> Personalização de Documentos
                </h3>
                <p className="text-sm text-gray-500">Configure a aparência e conteúdo dos PDFs gerados pelo sistema.</p>
            </div>

            <div className="flex gap-2 border-b overflow-x-auto">
                <TabButton id="proposals" label="Propostas" icon={FileText} />
                <TabButton id="invoices" label="Faturas & Recibos" icon={CreditCard} />
                <TabButton id="orders" label="Ordens de Serviço" icon={Calendar} />
            </div>

            <div className="pt-4">
                {/* PROPOSTAS */}
                {activeTab === 'proposals' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Toggle 
                                label="Mostrar NIF do Cliente" 
                                checked={proposalConfig.showClientNif} 
                                onChange={(v: boolean) => updateProposalLayout({ showClientNif: v })} 
                            />
                            <Toggle 
                                label="Mostrar Morada Completa" 
                                checked={proposalConfig.showClientAddress} 
                                onChange={(v: boolean) => updateProposalLayout({ showClientAddress: v })} 
                            />
                            <Toggle 
                                label="Área de Assinatura" 
                                checked={proposalConfig.showSignature} 
                                onChange={(v: boolean) => updateProposalLayout({ showSignature: v })} 
                                description="Adiciona espaço para assinatura no final do documento."
                            />
                            <Toggle 
                                label="Termos e Condições" 
                                checked={proposalConfig.showTerms} 
                                onChange={(v: boolean) => updateProposalLayout({ showTerms: v })} 
                            />
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h4 className="text-xs font-black text-gray-500 uppercase mb-3 flex items-center gap-2"><Palette size={14}/> Estilo Visual</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Cor Principal</label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" className="h-8 w-8 border rounded cursor-pointer" value={proposalConfig.primaryColor} onChange={e => updateProposalLayout({ primaryColor: e.target.value })} />
                                        <span className="text-xs font-mono">{proposalConfig.primaryColor}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Layout</label>
                                    <select className="w-full border rounded-lg p-2 text-xs" value={proposalConfig.backgroundStyle} onChange={e => updateProposalLayout({ backgroundStyle: e.target.value as any })}>
                                        <option value="clean">Clean (Minimalista)</option>
                                        <option value="modern">Moderno (Com fundo)</option>
                                        <option value="corporate">Corporativo (Formal)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* FATURAS */}
                {activeTab === 'invoices' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Toggle 
                                label="Mostrar Código QR (Fiscal)" 
                                checked={invoiceConfig.showQrCode} 
                                onChange={(v: boolean) => updateInvoiceLayout({ showQrCode: v })} 
                                description="Obrigatório para faturas comunicadas."
                            />
                            <Toggle 
                                label="Mostrar Dados Bancários" 
                                checked={invoiceConfig.showBankInfo} 
                                onChange={(v: boolean) => updateInvoiceLayout({ showBankInfo: v })} 
                            />
                            <Toggle 
                                label="Exibir Vendedor/Responsável" 
                                checked={invoiceConfig.showSalesman} 
                                onChange={(v: boolean) => updateInvoiceLayout({ showSalesman: v })} 
                            />
                        </div>

                        {invoiceConfig.showBankInfo && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Informação Bancária (IBAN/NIB)</label>
                                <textarea 
                                    className="w-full border rounded-xl p-3 text-sm h-20 outline-none focus:ring-2 focus:ring-green-500" 
                                    placeholder="Banco X: 0000.0000...&#10;Banco Y: 0000.0000..."
                                    value={invoiceConfig.bankInfoText || ''}
                                    onChange={e => updateInvoiceLayout({ bankInfoText: e.target.value })}
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Rodapé Personalizado (Legal)</label>
                            <input 
                                type="text" 
                                className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-green-500" 
                                placeholder="Ex: Processado por computador..."
                                value={invoiceConfig.customFooterText || ''}
                                onChange={e => updateInvoiceLayout({ customFooterText: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {/* ORDENS DE SERVIÇO */}
                {activeTab === 'orders' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Toggle 
                                label="Mostrar Preços na Ordem" 
                                checked={orderConfig.showPrices} 
                                onChange={(v: boolean) => updateOrderLayout({ showPrices: v })} 
                                description="Útil para esconder custos ao entregar ao técnico."
                            />
                            <Toggle 
                                label="Nome do Técnico" 
                                checked={orderConfig.showTechnicianName} 
                                onChange={(v: boolean) => updateOrderLayout({ showTechnicianName: v })} 
                            />
                            <Toggle 
                                label="Assinatura do Cliente" 
                                checked={orderConfig.showClientSignature} 
                                onChange={(v: boolean) => updateOrderLayout({ showClientSignature: v })} 
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Texto de Isenção de Responsabilidade (Disclaimer)</label>
                            <textarea 
                                className="w-full border rounded-xl p-3 text-sm h-24 outline-none focus:ring-2 focus:ring-green-500" 
                                placeholder="Ex: A empresa não se responsabiliza por dados perdidos..."
                                value={orderConfig.disclaimerText || ''}
                                onChange={e => updateOrderLayout({ disclaimerText: e.target.value })}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
