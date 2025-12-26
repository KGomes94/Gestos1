
import React from 'react';
import { SystemSettings, FiscalConfig } from '../../types';
import { CreditCard, Server, ShieldCheck, Lock } from 'lucide-react';

interface FiscalSettingsProps {
    settings: SystemSettings;
    onChange: (newSettings: SystemSettings) => void;
}

export const FiscalSettings: React.FC<FiscalSettingsProps> = ({ settings, onChange }) => {
    
    const updateFiscal = (updates: Partial<FiscalConfig>) => {
        onChange({
            ...settings,
            fiscalConfig: { ...settings.fiscalConfig, ...updates }
        });
    };

    const updateGeneral = (field: keyof SystemSettings, value: any) => {
        onChange({ ...settings, [field]: value });
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="border-b pb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <CreditCard size={20} className="text-green-600"/> Integração Fiscal (E-fatura)
                        </h3>
                        <p className="text-sm text-gray-500">Parâmetros de conformidade com a DNRE (Manual Técnico v10.0)</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={settings.fiscalConfig.enabled} 
                            onChange={e => updateFiscal({ enabled: e.target.checked })} 
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Configuração Técnica */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                    <h4 className="text-xs font-black text-gray-500 uppercase mb-4 flex items-center gap-2">
                        <Server size={14}/> Comunicação & IUD
                    </h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Ambiente / Repositório</label>
                            <select 
                                className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none" 
                                value={settings.fiscalConfig.repositoryCode} 
                                onChange={e => updateFiscal({ repositoryCode: e.target.value as any })}
                            >
                                <option value="1">1 - Produção (Repositório Principal)</option>
                                <option value="2">2 - Homologação (Testes Oficiais)</option>
                                <option value="3">3 - Sandbox (Desenvolvimento)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Código de LED (5 Dígitos)</label>
                            <input 
                                type="text" 
                                maxLength={5} 
                                placeholder="00001" 
                                className="w-full border rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none" 
                                value={settings.fiscalConfig.ledCode} 
                                onChange={e => updateFiscal({ ledCode: e.target.value })} 
                            />
                        </div>
                    </div>
                </div>

                {/* Séries e Impostos */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <h4 className="text-xs font-black text-blue-800 uppercase mb-4 flex items-center gap-2">
                        <Lock size={14}/> Numeração & Impostos
                    </h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-blue-600 mb-1 uppercase">Série Documental</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-blue-200 rounded-lg p-2.5 text-sm text-center font-black uppercase focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={settings.fiscalConfig.invoiceSeries} 
                                    onChange={e => updateFiscal({ invoiceSeries: e.target.value.toUpperCase() })} 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-blue-600 mb-1 uppercase">Próximo Nº</label>
                                <input 
                                    type="number" 
                                    className="w-full border border-blue-200 rounded-lg p-2.5 text-sm text-center font-black focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={settings.fiscalConfig.nextInvoiceNumber} 
                                    onChange={e => updateFiscal({ nextInvoiceNumber: Number(e.target.value) })} 
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-blue-200">
                            <div>
                                <label className="block text-[10px] font-bold text-blue-600 mb-1 uppercase">IVA Padrão (%)</label>
                                <input 
                                    type="number" 
                                    className="w-full border border-blue-200 rounded-lg p-2.5 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={settings.defaultTaxRate} 
                                    onChange={e => updateGeneral('defaultTaxRate', Number(e.target.value))} 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-blue-600 mb-1 uppercase">Retenção IR (%)</label>
                                <input 
                                    type="number" 
                                    className="w-full border border-blue-200 rounded-lg p-2.5 text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={settings.defaultRetentionRate} 
                                    onChange={e => updateGeneral('defaultRetentionRate', Number(e.target.value))} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-yellow-50 text-yellow-800 text-xs rounded-xl border border-yellow-200">
                <ShieldCheck size={20} className="shrink-0 mt-0.5"/>
                <div>
                    <strong>Nota de Segurança:</strong> Alterações na série documental ou código LED podem invalidar o envio de faturas para a DNRE. 
                    Certifique-se de que os dados correspondem ao registo oficial do software.
                </div>
            </div>
        </div>
    );
};
