
import React, { useState } from 'react';
import { SystemSettings, Transaction, Client, Material, Proposal, User, Account, BankTransaction, Employee, Appointment, Invoice } from '../types';
import { Save, Building2, Wallet, Database, Users as UsersIcon, FileText, CreditCard, Calendar, Wrench, LayoutTemplate } from 'lucide-react';
import { db } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

// Import New Modular Components
import { CompanySettings } from './settings/CompanySettings';
import { FiscalSettings } from './settings/FiscalSettings';
import { FinancialSettings } from './settings/FinancialSettings';
import { AccessControlSettings } from './settings/AccessControlSettings';
import { AdvancedSettings } from './settings/AdvancedSettings';
import { ProposalSettings } from './settings/ProposalSettings';
import { SchedulingSettings } from './settings/SchedulingSettings';
import { FormCustomizationSettings } from './settings/FormCustomizationSettings';

interface SettingsModuleProps {
    settings: SystemSettings;
    setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
    categories: Account[];
    setCategories: React.Dispatch<React.SetStateAction<Account[]>>;
    
    // Data Props for Export/Backup inside AdvancedSettings
    transactions: Transaction[];
    clients: Client[];
    materials: Material[];
    proposals: Proposal[];
    usersList?: User[];
    
    // New Props for Advanced Settings (Full Backup/Maintenance)
    bankTransactions?: BankTransaction[];
    setBankTransactions?: React.Dispatch<React.SetStateAction<BankTransaction[]>>; // Added setter for deduplication
    employees?: Employee[];
    appointments?: Appointment[];
    invoices?: Invoice[];

    // Setters required by original props signature, kept for compatibility if needed upstream
    setTransactions: any;
    setClients: any;
    setMaterials: any;
    setProposals: any;
    setUsersList?: React.Dispatch<React.SetStateAction<User[]>>;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ 
    settings, setSettings, categories, setCategories,
    transactions, clients, materials, proposals, usersList = [],
    bankTransactions = [], setBankTransactions, employees = [], appointments = [], invoices = [],
    setUsersList
}) => {
    const { canManageUsers } = useAuth();
    const { notify } = useNotification();
    const [activeTab, setActiveTab] = useState<'company' | 'financial' | 'fiscal' | 'proposal' | 'users' | 'system' | 'scheduling' | 'forms'>('company');

    const handleGlobalSave = () => {
        db.settings.save(settings);
        db.categories.save(categories);
        // Note: Users are saved within their specific component actions usually, but we can ensure sync here if needed.
        // db.users.save(usersList) is called inside AccessControlSettings when modifying.
        notify('success', 'Definições globais guardadas com sucesso!');
    };

    const TabButton = ({ id, label, icon: Icon, visible = true }: any) => {
        if (!visible) return null;
        return (
            <button 
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-bold border-l-4 transition-all w-full text-left ${
                    activeTab === id 
                    ? 'border-green-600 text-green-800 bg-green-50 shadow-sm' 
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
            >
                <Icon size={18} className={activeTab === id ? "text-green-600" : "text-gray-400"} />
                {label}
            </button>
        );
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)]">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                   <h2 className="text-2xl font-bold text-gray-800">Definições do Sistema</h2>
                   <p className="text-gray-500 text-sm">Configuração centralizada do ERP.</p>
                </div>
                <button onClick={handleGlobalSave} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all font-bold uppercase text-xs tracking-wider">
                    <Save size={18} /> Guardar Alterações
                </button>
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Sidebar Navigation */}
                <div className="w-64 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col py-4 shrink-0 overflow-y-auto">
                    <div className="px-6 pb-4 mb-2 border-b border-gray-100">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Navegação</span>
                    </div>
                    <nav className="space-y-1">
                        <TabButton id="company" label="Empresa" icon={Building2} />
                        <TabButton id="fiscal" label="Fiscalidade" icon={CreditCard} />
                        <TabButton id="financial" label="Financeiro" icon={Wallet} />
                        <TabButton id="scheduling" label="Agenda" icon={Calendar} />
                        <TabButton id="proposal" label="Propostas" icon={FileText} />
                        <TabButton id="forms" label="Personalização" icon={LayoutTemplate} />
                        <TabButton id="users" label="Utilizadores" icon={UsersIcon} visible={canManageUsers()} />
                        <div className="my-2 border-t border-gray-100 mx-4"></div>
                        <TabButton id="system" label="Avançado (Manutenção)" icon={Wrench} />
                    </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-y-auto p-8 relative">
                    {activeTab === 'company' && <CompanySettings settings={settings} onChange={setSettings} />}
                    
                    {activeTab === 'fiscal' && <FiscalSettings settings={settings} onChange={setSettings} />}
                    
                    {activeTab === 'financial' && <FinancialSettings settings={settings} setSettings={setSettings} categories={categories} setCategories={setCategories} />}
                    
                    {activeTab === 'scheduling' && <SchedulingSettings settings={settings} onChange={setSettings} />}

                    {activeTab === 'proposal' && <ProposalSettings settings={settings} onChange={setSettings} />}

                    {activeTab === 'forms' && <FormCustomizationSettings settings={settings} onChange={setSettings} />}
                    
                    {activeTab === 'users' && usersList && setUsersList && <AccessControlSettings users={usersList} setUsers={setUsersList} />}
                    
                    {activeTab === 'system' && (
                        <AdvancedSettings 
                            settings={settings} 
                            onSettingsChange={setSettings}
                            // Data for backups
                            transactions={transactions}
                            bankTransactions={bankTransactions}
                            setBankTransactions={setBankTransactions || (() => {})} // Safe setter
                            categories={categories}
                            clients={clients}
                            employees={employees}
                            proposals={proposals}
                            materials={materials}
                            appointments={appointments}
                            templates={[]}
                            documents={[]}
                            invoices={invoices}
                            usersList={usersList}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsModule;
