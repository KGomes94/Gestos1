
import React from 'react';
import { SystemSettings } from '../../types';
import { Building2, MapPin, Phone, Mail, Hash, Package } from 'lucide-react';

interface CompanySettingsProps {
    settings: SystemSettings;
    onChange: (newSettings: SystemSettings) => void;
}

export const CompanySettings: React.FC<CompanySettingsProps> = ({ settings, onChange }) => {
    const update = (field: keyof SystemSettings, value: any) => {
        onChange({ ...settings, [field]: value });
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Building2 size={20} className="text-green-600"/> Identidade Corporativa
                </h3>
                <p className="text-sm text-gray-500">Dados utilizados em documentos oficiais e cabeçalhos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1">Nome Legal da Empresa</label>
                    <div className="relative">
                        <Building2 size={16} className="absolute left-3 top-3 text-gray-400"/>
                        <input 
                            type="text" 
                            className="w-full border rounded-xl pl-10 p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                            value={settings.companyName} 
                            onChange={e => update('companyName', e.target.value)} 
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1">NIF (Obrigatório 9 Dígitos)</label>
                    <div className="relative">
                        <Hash size={16} className="absolute left-3 top-3 text-gray-400"/>
                        <input 
                            type="text" 
                            maxLength={9} 
                            className="w-full border rounded-xl pl-10 p-3 text-sm font-mono tracking-widest focus:ring-2 focus:ring-green-500 outline-none" 
                            value={settings.companyNif} 
                            onChange={e => update('companyNif', e.target.value)} 
                        />
                    </div>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1">Morada Fiscal Completa</label>
                    <div className="relative">
                        <MapPin size={16} className="absolute left-3 top-3 text-gray-400"/>
                        <input 
                            type="text" 
                            className="w-full border rounded-xl pl-10 p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                            value={settings.companyAddress} 
                            onChange={e => update('companyAddress', e.target.value)} 
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1">Email Oficial</label>
                    <div className="relative">
                        <Mail size={16} className="absolute left-3 top-3 text-gray-400"/>
                        <input 
                            type="email" 
                            className="w-full border rounded-xl pl-10 p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                            value={settings.companyEmail} 
                            onChange={e => update('companyEmail', e.target.value)} 
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1">Telefone Principal</label>
                    <div className="relative">
                        <Phone size={16} className="absolute left-3 top-3 text-gray-400"/>
                        <input 
                            type="tel" 
                            className="w-full border rounded-xl pl-10 p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                            value={settings.companyPhone} 
                            onChange={e => update('companyPhone', e.target.value)} 
                        />
                    </div>
                </div>
            </div>

            {/* Configurações de Regra de Negócio / Stock */}
            <div className="pt-6 mt-4 border-t border-gray-100">
                <h4 className="text-sm font-black text-gray-500 uppercase mb-3 flex items-center gap-2"><Package size={14}/> Regras de Stock</h4>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                            checked={settings.allowNegativeStock !== false} 
                            onChange={e => update('allowNegativeStock', e.target.checked)} 
                        />
                        <div>
                            <span className="text-sm font-bold text-gray-800">Permitir Stock Negativo</span>
                            <p className="text-xs text-gray-500">
                                Se desativado, impede a emissão de faturas/vendas caso a quantidade solicitada exceda o stock atual.
                            </p>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
};
