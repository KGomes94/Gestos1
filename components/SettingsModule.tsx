
import React, { useState, useEffect, useRef } from 'react';
import { SystemSettings, Transaction, Client, Material, Proposal, ServiceType, User, UserRole, ProposalLayoutConfig, FiscalConfig } from '../types';
import { Save, Building2, Wallet, List, Database, RotateCcw, Download, Upload, Trash2, Plus, AlertTriangle, AlertCircle, Link, LayoutDashboard, Calendar, Edit2, X, Check, Users as UsersIcon, ShieldCheck, FileText, Palette, Layout, CreditCard, Lock, Server, FileDown, FileUp } from 'lucide-react';
import { db } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

interface SettingsModuleProps {
    settings: SystemSettings;
    setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
    categories: string[];
    setCategories: React.Dispatch<React.SetStateAction<string[]>>;
    
    transactions: Transaction[];
    clients: Client[];
    materials: Material[];
    proposals: Proposal[];
    setTransactions: any;
    setClients: any;
    setMaterials: any;
    setProposals: any;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ 
    settings, setSettings, categories, setCategories,
    transactions, clients, materials, proposals,
    setTransactions, setClients, setMaterials, setProposals
}) => {
    const { canManageUsers } = useAuth();
    const { notify } = useNotification();
    const [activeTab, setActiveTab] = useState<'company' | 'financial' | 'categories' | 'system' | 'dashboard' | 'calendar' | 'users' | 'proposal_layout' | 'fiscal'>('company');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = (e?: React.FormEvent) => {
        if(e) e.preventDefault();
        db.settings.save(settings);
        db.categories.save(categories);
        notify('success', 'Definições atualizadas com sucesso!');
    };

    const updateFiscalConfig = (updates: Partial<FiscalConfig>) => {
        setSettings(prev => ({
            ...prev,
            fiscalConfig: { ...prev.fiscalConfig, ...updates }
        }));
    };

    const handleExportData = () => {
        const data = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            transactions: db.transactions.getAll(),
            bankTransactions: db.bankTransactions.getAll(),
            categories: db.categories.getAll(),
            settings: db.settings.get(),
            clients: db.clients.getAll(),
            employees: db.employees.getAll(),
            proposals: db.proposals.getAll(),
            materials: db.materials.getAll(),
            appointments: db.appointments.getAll(),
            templates: db.templates.getAll(),
            documents: db.documents.getAll(),
            invoices: db.invoices.getAll(),
            users: db.users.getAll(),
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gestos_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify('success', 'Backup descarregado com sucesso.');
    };

    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm("ATENÇÃO: Importar um backup irá substituir TODOS os dados atuais. Deseja continuar?")) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                
                // Basic Validation
                if (!data.timestamp || !data.settings) throw new Error("Ficheiro inválido");

                // Restore Data
                if(data.transactions) db.transactions.save(data.transactions);
                if(data.bankTransactions) db.bankTransactions.save(data.bankTransactions);
                if(data.categories) db.categories.save(data.categories);
                if(data.settings) db.settings.save(data.settings);
                if(data.clients) db.clients.save(data.clients);
                if(data.employees) db.employees.save(data.employees);
                if(data.proposals) db.proposals.save(data.proposals);
                if(data.materials) db.materials.save(data.materials);
                if(data.appointments) db.appointments.save(data.appointments);
                if(data.templates) db.templates.save(data.templates);
                if(data.documents) db.documents.save(data.documents);
                if(data.invoices) db.invoices.save(data.invoices);
                if(data.users) db.users.save(data.users);

                notify('success', 'Dados restaurados. O sistema será reiniciado.');
                setTimeout(() => window.location.reload(), 1500);

            } catch (err) {
                console.error(err);
                notify('error', 'Erro ao ler ficheiro de backup.');
            }
        };
        reader.readAsText(file);
    };

    const TabButton = ({ id, label, icon: Icon, visible = true }: any) => {
        if (!visible) return null;
        return (
            <button 
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === id 
                    ? 'border-green-600 text-green-700 bg-green-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
                <Icon size={18} />
                {label}
            </button>
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                   <h2 className="text-2xl font-bold text-gray-800">Definições GestOs</h2>
                   <p className="text-gray-500 text-sm">Gestão de Parâmetros e Conformidade v1.9.1</p>
                </div>
                <button onClick={() => handleSave()} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all font-bold">
                    <Save size={18} /> Guardar Alterações
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide bg-gray-50/50">
                    <TabButton id="company" label="Empresa" icon={Building2} />
                    <TabButton id="financial" label="Financeiro" icon={Wallet} />
                    <TabButton id="fiscal" label="E-fatura.cv v10.0" icon={CreditCard} />
                    <TabButton id="proposal_layout" label="Layout Proposta" icon={FileText} />
                    <TabButton id="users" label="Utilizadores" icon={UsersIcon} visible={canManageUsers()} />
                    <TabButton id="system" label="Sistema" icon={Database} />
                </div>

                <div className="p-8">
                    {activeTab === 'company' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-3"><Building2 size={20} className="text-green-600"/> Identidade Fiscal</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">Nome da Empresa</label><input type="text" className="w-full border rounded-xl p-3 text-sm" value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})} /></div>
                                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">NIF (Obrigatório 9 Dig.)</label><input type="text" maxLength={9} className="w-full border rounded-xl p-3 text-sm font-mono" value={settings.companyNif} onChange={e => setSettings({...settings, companyNif: e.target.value})} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fiscal' && (
                        <div className="space-y-8 animate-fade-in-up">
                            <div className="flex justify-between items-center border-b pb-3">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><CreditCard size={20} className="text-green-600"/> Parâmetros de Integração DNRE</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={settings.fiscalConfig.enabled} onChange={e => updateFiscalConfig({ enabled: e.target.checked })} />
                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="bg-gray-50 p-4 rounded-xl border">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase mb-3 flex items-center gap-1"><Server size={12}/> Configuração de IUD</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1">REPOSITÓRIO (Pág 41)</label>
                                                <select className="w-full border rounded-lg p-2 text-sm bg-white" value={settings.fiscalConfig.repositoryCode} onChange={e => updateFiscalConfig({ repositoryCode: e.target.value as any })}>
                                                    <option value="1">1 - Repositório Principal (Válido)</option>
                                                    <option value="2">2 - Homologação</option>
                                                    <option value="3">3 - Teste</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1">CÓDIGO DE LED (Pág 19)</label>
                                                <input type="text" maxLength={5} placeholder="Ex: 00001" className="w-full border rounded-lg p-2 text-sm font-mono" value={settings.fiscalConfig.ledCode} onChange={e => updateFiscalConfig({ ledCode: e.target.value })} />
                                                <p className="text-[9px] text-gray-400 mt-1">Identifica o ponto de venda/máquina emissora.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <h4 className="text-[10px] font-black text-blue-800 uppercase mb-3">Séries e Numeração</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="block text-[10px] font-bold text-blue-600 mb-1">Série</label><input type="text" className="w-full border p-2 text-xs text-center font-black" value={settings.fiscalConfig.invoiceSeries} onChange={e => updateFiscalConfig({ invoiceSeries: e.target.value })} /></div>
                                            <div><label className="block text-[10px] font-bold text-blue-600 mb-1">Próximo Nº</label><input type="number" className="w-full border p-2 text-xs text-center font-black" value={settings.fiscalConfig.nextInvoiceNumber} onChange={e => updateFiscalConfig({ nextInvoiceNumber: Number(e.target.value) })} /></div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100 text-[10px] text-yellow-800 italic">
                                        Nota: O sistema GestOs v1.9.1 calcula automaticamente o Dígito Verificador (DV) do IUD usando a fórmula de Luhn exigida pela DNRE Cabo Verde.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'financial' && (
                        <div className="space-y-8 animate-fade-in-up">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-3"><Wallet size={20} className="text-green-600"/> Parâmetros Financeiros</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">Meta Mensal</label><input type="number" className="w-full border rounded-xl p-3 text-sm font-bold text-green-700" value={settings.monthlyTarget} onChange={e => setSettings({...settings, monthlyTarget: Number(e.target.value)})} /></div>
                                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">Moeda</label><input type="text" className="w-full border rounded-xl p-3 text-sm" value={settings.currency} onChange={e => setSettings({...settings, currency: e.target.value})} /></div>
                                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">IVA Padrão (%)</label><input type="number" className="w-full border rounded-xl p-3 text-sm" value={settings.defaultTaxRate} onChange={e => setSettings({...settings, defaultTaxRate: Number(e.target.value)})} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'system' && (
                        <div className="space-y-8 animate-fade-in-up">
                            <div className="flex justify-between items-center border-b pb-3">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Database size={20} className="text-green-600"/> Gestão de Dados</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl">
                                    <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-2"><FileDown size={18}/> Backup de Segurança</h4>
                                    <p className="text-xs text-blue-600 mb-4">Descarregue uma cópia completa de todos os dados do sistema (Clientes, Faturas, Configurações) para o seu computador.</p>
                                    <button onClick={handleExportData} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">Exportar Dados (JSON)</button>
                                </div>

                                <div className="p-6 bg-green-50 border border-green-100 rounded-2xl">
                                    <h4 className="font-bold text-green-800 flex items-center gap-2 mb-2"><FileUp size={18}/> Restaurar Dados</h4>
                                    <p className="text-xs text-green-600 mb-4">Restaure o sistema a partir de um ficheiro de backup anterior. Cuidado: Isto substituirá os dados atuais.</p>
                                    <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImportData} />
                                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors shadow-sm">Importar Backup</button>
                                </div>
                            </div>

                            <div className="mt-8 border-t pt-6">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><AlertTriangle size={20} className="text-red-500"/> Zona de Perigo</h3>
                                <div className="p-6 bg-red-50 border border-red-100 rounded-2xl">
                                    <h4 className="font-bold text-red-800 flex items-center gap-2 mb-3"><RotateCcw size={18}/> Reiniciar Configurações</h4>
                                    <p className="text-xs text-red-600 mb-4">Restaura apenas as definições do sistema para os padrões de fábrica. Os dados de clientes e transações são mantidos.</p>
                                    <button onClick={() => { if(confirm('Restaurar padrões de configuração?')) { db.settings.reset(); window.location.reload(); } }} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors">Restaurar Padrões de Fábrica</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsModule;
