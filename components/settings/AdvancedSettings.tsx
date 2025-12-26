
import React, { useRef } from 'react';
import { SystemSettings } from '../../types';
import { Database, FileDown, FileUp, AlertTriangle, RotateCcw, FlaskConical } from 'lucide-react';
import { db } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';

interface AdvancedSettingsProps {
    settings: SystemSettings;
    onSettingsChange: (newSettings: SystemSettings) => void;
    
    // Data Props for Export
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
            if (confirm("ATENÇÃO: Ao desativar o Modo de Treino, todas as alterações locais feitas durante o teste serão descartadas e o sistema recarregará os dados reais da nuvem. Deseja continuar?")) {
                const newSettings = { ...settings, trainingMode: false };
                db.settings.save(newSettings);
                notify('info', 'Reiniciando sistema para sincronizar dados reais...');
                setTimeout(() => window.location.reload(), 1000);
            }
        }
    };

    const handleExportData = () => {
        const data = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            transactions, bankTransactions, categories, settings, clients, employees,
            proposals, materials, appointments, templates, documents, invoices, users: usersList
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
                
                if (!data.timestamp || !data.settings) throw new Error("Ficheiro inválido");

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

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Database size={20} className="text-green-600"/> Sistema & Segurança
                </h3>
                <p className="text-sm text-gray-500">Gestão de dados e modos de operação.</p>
            </div>

            {/* TRAINING MODE TOGGLE */}
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                    <h4 className="font-black text-amber-800 flex items-center gap-2 mb-1"><FlaskConical size={20}/> Modo de Treino / Teste</h4>
                    <p className="text-xs text-amber-700 max-w-md">Quando ativado, o sistema <strong>NÃO</strong> sincroniza alterações com a base de dados na nuvem. Ideal para formação e testes sem risco.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.trainingMode || false} 
                        onChange={e => handleTrainingModeToggle(e.target.checked)} 
                    />
                    <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl">
                    <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-2"><FileDown size={18}/> Backup de Segurança</h4>
                    <p className="text-xs text-blue-600 mb-4">Exportar todos os dados atuais para um ficheiro JSON local.</p>
                    <button onClick={handleExportData} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">Exportar Dados</button>
                </div>
                <div className="p-6 bg-green-50 border border-green-100 rounded-2xl">
                    <h4 className="font-bold text-green-800 flex items-center gap-2 mb-2"><FileUp size={18}/> Restaurar Dados</h4>
                    <p className="text-xs text-green-600 mb-4">Importar backup JSON para substituir os dados atuais.</p>
                    <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImportData} />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors shadow-sm">Importar</button>
                </div>
            </div>

            <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><AlertTriangle size={20} className="text-red-500"/> Zona de Perigo</h3>
                <div className="p-6 bg-red-50 border border-red-100 rounded-2xl">
                    <h4 className="font-bold text-red-800 flex items-center gap-2 mb-3"><RotateCcw size={18}/> Reiniciar Configurações</h4>
                    <p className="text-xs text-red-600 mb-4">Restaura apenas as configurações de fábrica (Empresa, Fiscal, UI). Não apaga registos de faturação ou clientes.</p>
                    <button onClick={() => { if(confirm('Restaurar padrões?')) { db.settings.reset(); window.location.reload(); } }} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors">Restaurar Padrões</button>
                </div>
            </div>
        </div>
    );
};
