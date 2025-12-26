
import React from 'react';
import { SystemSettings, ProposalLayoutConfig } from '../../types';
import { FileText, Layout, Palette } from 'lucide-react';

interface ProposalSettingsProps {
    settings: SystemSettings;
    onChange: (newSettings: SystemSettings) => void;
}

export const ProposalSettings: React.FC<ProposalSettingsProps> = ({ settings, onChange }) => {
    
    const updateLayout = (updates: Partial<ProposalLayoutConfig>) => {
        onChange({
            ...settings,
            proposalLayout: { ...settings.proposalLayout, ...updates }
        });
    };

    const updateGeneral = (field: keyof SystemSettings, value: any) => {
        onChange({ ...settings, [field]: value });
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <FileText size={20} className="text-green-600"/> Layout de Propostas
                </h3>
                <p className="text-sm text-gray-500">Personalize a aparência dos orçamentos enviados aos clientes.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                        <h4 className="text-xs font-black text-gray-500 uppercase mb-4 flex items-center gap-2">
                            <Palette size={14}/> Estilo Visual
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Tema de Cor Principal</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="color" 
                                        className="h-10 w-10 border rounded cursor-pointer" 
                                        value={settings.proposalLayout.primaryColor} 
                                        onChange={e => updateLayout({ primaryColor: e.target.value })} 
                                    />
                                    <input 
                                        type="text" 
                                        className="border rounded-lg px-3 text-sm font-mono flex-1 uppercase" 
                                        value={settings.proposalLayout.primaryColor} 
                                        onChange={e => updateLayout({ primaryColor: e.target.value })} 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Estilo de Fundo</label>
                                <select 
                                    className="w-full border rounded-lg p-2.5 text-sm bg-white" 
                                    value={settings.proposalLayout.backgroundStyle} 
                                    onChange={e => updateLayout({ backgroundStyle: e.target.value as any })}
                                >
                                    <option value="clean">Clean (Minimalista)</option>
                                    <option value="modern">Modern (Geométrico)</option>
                                    <option value="corporate">Corporate (Formal)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <h4 className="text-xs font-black text-gray-500 uppercase mb-4 flex items-center gap-2">
                            <Layout size={14}/> Elementos Visíveis
                        </h4>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 text-green-600 rounded" checked={settings.proposalLayout.showClientNif} onChange={e => updateLayout({ showClientNif: e.target.checked })} />
                                <span className="text-sm font-medium text-gray-700">Mostrar NIF do Cliente</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 text-green-600 rounded" checked={settings.proposalLayout.showSignature} onChange={e => updateLayout({ showSignature: e.target.checked })} />
                                <span className="text-sm font-medium text-gray-700">Área de Assinatura</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 text-green-600 rounded" checked={settings.proposalLayout.showValidity} onChange={e => updateLayout({ showValidity: e.target.checked })} />
                                <span className="text-sm font-medium text-gray-700">Data de Validade</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Termos e Condições Padrão</label>
                        <textarea 
                            className="w-full border rounded-xl p-4 h-64 text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"
                            value={settings.defaultProposalNotes} 
                            onChange={e => updateGeneral('defaultProposalNotes', e.target.value)} 
                            placeholder="Texto padrão a aparecer no rodapé de todas as novas propostas..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Validade Padrão (Dias)</label>
                        <input 
                            type="number" 
                            className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            value={settings.defaultProposalValidityDays} 
                            onChange={e => updateGeneral('defaultProposalValidityDays', Number(e.target.value))} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
