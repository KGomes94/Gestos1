
import React from 'react';
import { SystemSettings, ProposalLayoutConfig, ProposalSettingsConfig } from '../../types';
import { FileText, Layout, Palette, Settings, CheckSquare } from 'lucide-react';

interface ProposalSettingsProps {
    settings: SystemSettings;
    onChange: (newSettings: SystemSettings) => void;
}

export const ProposalSettings: React.FC<ProposalSettingsProps> = ({ settings, onChange }) => {
    
    // Ensure nested object exists
    const config = settings.proposalConfig || {
        defaultValidityDays: 15,
        defaultPaymentTerms: 'Pronto Pagamento',
        allowEditAfterSent: false,
        autoConvert: false,
        proposalSequence: 1,
        activeTypes: ['Padrão']
    };

    const updateLayout = (updates: Partial<ProposalLayoutConfig>) => {
        onChange({
            ...settings,
            proposalLayout: { ...settings.proposalLayout, ...updates }
        });
    };

    const updateConfig = (updates: Partial<ProposalSettingsConfig>) => {
        onChange({
            ...settings,
            proposalConfig: { ...config, ...updates }
        });
    };

    const updateGeneral = (field: keyof SystemSettings, value: any) => {
        onChange({ ...settings, [field]: value });
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <FileText size={20} className="text-green-600"/> Configuração de Propostas
                </h3>
                <p className="text-sm text-gray-500">Personalize o comportamento e aparência dos orçamentos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Comportamento e Regras */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h4 className="text-xs font-black text-gray-500 uppercase mb-4 flex items-center gap-2">
                        <Settings size={14}/> Regras de Negócio
                    </h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Validade Padrão (Dias)</label>
                                <input 
                                    type="number" 
                                    className="w-full border rounded-lg p-2 text-sm" 
                                    value={config.defaultValidityDays} 
                                    onChange={e => updateConfig({ defaultValidityDays: Number(e.target.value) })} 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Sequência Inicial</label>
                                <input 
                                    type="number" 
                                    className="w-full border rounded-lg p-2 text-sm" 
                                    value={config.proposalSequence} 
                                    onChange={e => updateConfig({ proposalSequence: Number(e.target.value) })} 
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2 pt-2">
                            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                                <input type="checkbox" className="w-4 h-4 text-green-600 rounded" checked={config.allowEditAfterSent} onChange={e => updateConfig({ allowEditAfterSent: e.target.checked })} />
                                <span className="text-sm font-medium text-gray-700">Permitir edição após envio (Estado 'Enviada')</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                                <input type="checkbox" className="w-4 h-4 text-green-600 rounded" checked={config.autoConvert} onChange={e => updateConfig({ autoConvert: e.target.checked })} />
                                <span className="text-sm font-medium text-gray-700">Sugerir conversão automática ao aceitar</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Estilo Visual */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                    <h4 className="text-xs font-black text-gray-500 uppercase mb-4 flex items-center gap-2">
                        <Palette size={14}/> Estilo Visual (PDF)
                    </h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Cor Principal</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="color" 
                                        className="h-9 w-9 border rounded cursor-pointer" 
                                        value={settings.proposalLayout.primaryColor} 
                                        onChange={e => updateLayout({ primaryColor: e.target.value })} 
                                    />
                                    <input 
                                        type="text" 
                                        className="border rounded-lg px-2 text-xs font-mono flex-1 uppercase" 
                                        value={settings.proposalLayout.primaryColor} 
                                        onChange={e => updateLayout({ primaryColor: e.target.value })} 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Estilo</label>
                                <select 
                                    className="w-full border rounded-lg p-2 text-sm bg-white" 
                                    value={settings.proposalLayout.backgroundStyle} 
                                    onChange={e => updateLayout({ backgroundStyle: e.target.value as any })}
                                >
                                    <option value="clean">Minimalista</option>
                                    <option value="modern">Moderno</option>
                                    <option value="corporate">Corporativo</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.proposalLayout.showClientNif} onChange={e => updateLayout({ showClientNif: e.target.checked })} className="rounded text-green-600"/> <span className="text-xs">Mostrar NIF Cliente</span></label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.proposalLayout.showSignature} onChange={e => updateLayout({ showSignature: e.target.checked })} className="rounded text-green-600"/> <span className="text-xs">Área de Assinatura</span></label>
                        </div>
                    </div>
                </div>

                {/* Textos Padrão */}
                <div className="md:col-span-2 space-y-4">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Termos e Condições Padrão (Rodapé)</label>
                        <textarea 
                            className="w-full border rounded-xl p-4 h-40 text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"
                            value={settings.defaultProposalNotes} 
                            onChange={e => updateGeneral('defaultProposalNotes', e.target.value)} 
                            placeholder="Texto padrão a aparecer no rodapé de todas as novas propostas..."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
