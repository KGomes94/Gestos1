
import React, { useState } from 'react';
import { 
    SystemSettings, Account, Transaction, Client, Material, 
    Proposal, User, BankTransaction, Employee, Appointment, Invoice 
} from '../types';
import { 
    Save, Building2, CreditCard, Wallet, Calendar, FileText, 
    LayoutTemplate, Users as UsersIcon, Wrench 
} from 'lucide-react';
import { CompanySettings } from './settings/CompanySettings';
import { FiscalSettings } from './settings/FiscalSettings';
import { FinancialSettings } from './settings/FinancialSettings';
import { SchedulingSettings } from './settings/SchedulingSettings';
import { ProposalSettings } from './settings/ProposalSettings';
import { FormCustomizationSettings } from './settings/FormCustomizationSettings';
import { AccessControlSettings } from './settings/AccessControlSettings';
import { AdvancedSettings } from './settings/AdvancedSettings';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/db';

interface SettingsModuleProps {
    settings: SystemSettings;
    setSettings: (newSettings: SystemSettings) => void;
    categories: Account[];
    setCategories: React.Dispatch<React.SetStateAction<Account[]>>;
    transactions: Transaction[];
    clients: Client[];
    materials: Material[];
    proposals: Proposal[];
    usersList: User[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
    setProposals: React.Dispatch<React.SetStateAction<Proposal[]>>;
    setUsersList: React.Dispatch<React.SetStateAction<User[]>>;
    bankTransactions: BankTransaction[];
    setBankTransactions: React.Dispatch<React.SetStateAction<BankTransaction[]>>;
    employees: Employee[];
    appointments: Appointment[];
    invoices: Invoice[];
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({ 
    settings, setSettings, categories, setCategories,
    transactions, clients, materials, proposals, usersList = [],
    bankTransactions = [], setBankTransactions, employees = [], appointments = [], invoices = [],
    setUsersList
}) => {
    const { notify } = useNotification();
    const { canManageUsers } = useAuth();
    const [activeTab, setActiveTab] = useState('company');

    const handleGlobalSave = async () => {
        try {
            await db.settings.save(settings);
            notify('success', 'Configurações guardadas com sucesso.');
        } catch (error) {
            notify('error', 'Erro ao guardar configurações.');
        }
    };

    const TabButton = ({ id, label, icon: Icon, visible = true }: any) => {
        if (!visible) return null;
        return (
            <button 
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-3 px-4 py-3 w-full text-sm font-medium rounded-xl transition-all ${
                    activeTab === id 
                    ? 'bg-green-50 text-green-700 font-bold' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
            >
                <Icon size={18} />
                {label}
            </button>
        );
    };

    return (
        <div className="flex flex-col h-full">
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
                    <nav className="space-y-1 px-2">
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
