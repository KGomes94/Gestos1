
import React, { useRef } from 'react';
import { SystemSettings } from '../../types';
import { Database, Download, Trash2, AlertTriangle, RotateCcw, FlaskConical, HardDrive, RefreshCw } from 'lucide-react';
import { db } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';

interface AdvancedSettingsProps {
    settings: SystemSettings;
    onSettingsChange: (newSettings: SystemSettings) => void;
    
    // Data Props
    transactions: any[];
    bankTransactions: any[];
    categories: any[];
    clients: any[];
    employees: any[];
    proposals: any[];
    materials: any[];
    appointments: any[];
    templates: any[];
    documents: any[];
    invoices: any[];
    usersList: any[];
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({ 
    settings, onSettingsChange,
    transactions, bankTransactions, categories, clients, employees, proposals, materials, appointments, templates, documents, invoices, usersList
}) => {
    const { notify } = useNotification();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleTrainingModeToggle = (checked: boolean) => {
        if (checked) {
            onSettingsChange({ ...settings, trainingMode: true });
            db.settings.save({ ...settings, trainingMode: true }); 
            notify('success', 'Modo de Treino ativado. Alterações não serão salvas na nuvem.');
        } else {
            if (confirm("ATENÇÃO: Ao desativar o Modo de Treino, o sistema irá recarregar os dados reais. Continuar?")) {
                const newSettings = { ...settings, trainingMode: false };
                db.settings.save(newSettings);
                notify('info', 'A reiniciar sistema...');
                setTimeout(() => window.location.reload(), 1000);
            }
        }
    };

    const handleDownloadTable = (name: string, data: any[]) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gestos_${name.toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify('success', `Tabela ${name} descarregada.`);
    };

    const handleClearTable = (name: string, dbKey: keyof typeof db) => {
        if (confirm(`ATENÇÃO: Tem a certeza que deseja apagar TODOS os registos de ${name}? Esta ação afeta a base de dados local.`)) {
            // @ts-ignore - Dynamic access to db clear functions
            if (db[dbKey] && typeof db[dbKey].save === 'function') {
                // @ts-ignore
                db[dbKey].save([]);
                notify('success', `Tabela ${name} limpa. A reiniciar para atualizar...`);
                setTimeout(() => window.location.reload(), 1500);
            }
        }
    };

    const handleFullImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm("ATENÇÃO: Importar um backup completo irá substituir TODOS os dados atuais. Deseja continuar?")) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (!data.timestamp || !data.settings) throw new Error("Ficheiro inválido");

                // Restore logic
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
                notify('error', 'Erro ao ler backup.');
            }
        };
        reader.readAsText(file);
    };

    const tables = [
        { name: 'Transações', key: 'transactions', data: transactions, icon: '💰' },
        { name: 'Faturas', key: 'invoices', data: invoices, icon: '📄' },
        { name: 'Clientes', key: 'clients', data: clients, icon: '👥' },
        { name: 'Propostas', key: 'proposals', data: proposals, icon: '📝' },
        { name: 'Materiais', key: 'materials', data: materials, icon: '📦' },
        { name: 'Agenda', key: 'appointments', data: appointments, icon: '📅' },
        { name: 'Funcionários', key: 'employees', data: employees, icon: '👔' },
        { name: 'Mov. Bancários', key: 'bankTransactions', data: bankTransactions, icon: '🏦' },
    ];

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Database size={20} className="text-green-600"/> Gestão de Dados
                </h3>
                <p className="text-sm text-gray-500">Controlo direto das tabelas da base de dados e backups.</p>
            </div>

            {/* MODO TREINO */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
                <div>
                    <h4 className="font-black text-amber-800 flex items-center gap-2 text-sm"><FlaskConical size={16}/> Modo de Treino / Sandbox</h4>
                    <p className="text-xs text-amber-700 mt-1">
                        Impede a sincronização com a cloud. Use para testes seguros sem afetar dados reais.
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.trainingMode || false} 
                        onChange={e => handleTrainingModeToggle(e.target.checked)} 
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
            </div>

            {/* TABELA DE GESTÃO DE DADOS */}
            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2"><HardDrive size={16}/> Tabelas do Sistema</h4>
                    <div className="flex gap-2">
                        <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFullImport} />
                        <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-colors">
                            <RefreshCw size={12}/> Restaurar Backup Completo
                        </button>
                    </div>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500">
                        <tr>
                            <th className="px-6 py-3 text-left">Tabela / Entidade</th>
                            <th className="px-6 py-3 text-center">Registos</th>
                            <th className="px-6 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {tables.map((table) => (
                            <tr key={table.key} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-3 font-medium text-gray-700 flex items-center gap-2">
                                    <span className="text-lg">{table.icon}</span> {table.name}
                                </td>
                                <td className="px-6 py-3 text-center">
                                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{table.data?.length || 0}</span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => handleDownloadTable(table.name, table.data)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Descarregar JSON"
                                        >
                                            <Download size={16}/>
                                        </button>
                                        <button 
                                            onClick={() => handleClearTable(table.name, table.key as any)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Limpar Tabela"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ZONA DE PERIGO */}
            <div className="mt-8 pt-6 border-t border-red-100">
                <h4 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-3"><AlertTriangle size={16}/> Reset de Fábrica</h4>
                <div className="flex items-center justify-between bg-red-50 p-4 rounded-xl border border-red-100">
                    <p className="text-xs text-red-600 max-w-lg">
                        Esta ação irá repor apenas as configurações de sistema (empresa, logotipos, regras fiscais) para os valores padrão. Os dados das tabelas acima não serão apagados.
                    </p>
                    <button 
                        onClick={() => { if(confirm('Restaurar definições de fábrica?')) { db.settings.reset(); window.location.reload(); } }} 
                        className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                        <RotateCcw size={14}/> Restaurar Padrões
                    </button>
                </div>
            </div>
        </div>
    );
};
