
import React, { useRef, useState } from 'react';
import { SystemSettings, BankTransaction } from '../../types';
import { Database, Download, Trash2, AlertTriangle, RotateCcw, FlaskConical, HardDrive, RefreshCw, Bomb, Layers, Split } from 'lucide-react';
import { db } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { BankDeduplicationModal } from './BankDeduplicationModal';

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
    const { requestConfirmation } = useConfirmation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [isDedupeModalOpen, setIsDedupeModalOpen] = useState(false);

    const handleTrainingModeToggle = (checked: boolean) => {
        if (checked) {
            onSettingsChange({ ...settings, trainingMode: true });
            db.settings.save({ ...settings, trainingMode: true }); 
            notify('success', 'Modo de Treino ativado. Alterações não serão salvas na nuvem.');
        } else {
            requestConfirmation({
                title: "Desativar Modo de Treino",
                message: "Ao desativar o Modo de Treino, o sistema irá recarregar os dados reais da nuvem. Continuar?",
                variant: 'warning',
                confirmText: 'Continuar',
                onConfirm: () => {
                    const newSettings = { ...settings, trainingMode: false };
                    db.settings.save(newSettings);
                    notify('info', 'A reiniciar sistema...');
                    setTimeout(() => window.location.reload(), 1000);
                }
            });
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
        requestConfirmation({
            title: `Limpar Tabela ${name}`,
            message: `Tem a certeza que deseja apagar TODOS os registos de ${name}? Esta ação afeta a base de dados local imediatamente.`,
            variant: 'danger',
            confirmText: 'Apagar Dados',
            onConfirm: () => {
                // @ts-ignore - Dynamic access to db clear functions
                if (db[dbKey] && typeof db[dbKey].save === 'function') {
                    // @ts-ignore
                    db[dbKey].save([]);
                    notify('success', `Tabela ${name} limpa. A reiniciar para atualizar...`);
                    setTimeout(() => window.location.reload(), 1500);
                }
            }
        });
    };

    const handleDeduplicateBank = () => {
        if (bankTransactions.length === 0) return notify('info', 'Não há transações para analisar.');
        setIsDedupeModalOpen(true);
    };

    const confirmDeduplication = async (idsToRemove: string[]) => {
        if (idsToRemove.length === 0) return;

        // Filtrar mantendo apenas os que NÃO estão na lista de remoção
        const newBankTransactions = bankTransactions.filter(tx => !idsToRemove.includes(tx.id));
        
        await db.bankTransactions.save(newBankTransactions);
        
        setIsDedupeModalOpen(false);
        notify('success', `${idsToRemove.length} registos duplicados eliminados com sucesso.`);
        
        // Pequeno delay para permitir save async antes de reload visual se necessário
        setTimeout(() => {
            // Opcional: window.location.reload() se a atualização de estado via props não for imediata
            // Como React é reativo, assumimos que App.tsx vai propagar as mudanças se db.save disparar eventos,
            // mas como db.save é manual, um reload garante a consistência visual total
             window.location.reload(); 
        }, 1000);
    };

    const executeHardReset = async () => {
        setIsResetting(true);
        notify('info', 'A iniciar limpeza total...');

        try {
            // Limpar todas as tabelas exceto Utilizadores (para não bloquear o admin atual)
            await Promise.all([
                db.transactions.save([]),
                db.clients.save([]),
                db.employees.save([]),
                db.proposals.save([]),
                db.materials.save([]),
                db.appointments.save([]),
                db.invoices.save([]),
                db.bankTransactions.save([]),
                db.recurringContracts.save([]),
                db.documents.save([]),
                db.templates.save([]),
                // Reset configurações para padrão
                db.settings.reset()
            ]);

            notify('success', 'Base de dados limpa com sucesso. O sistema irá reiniciar em 3 segundos.');
            
            setTimeout(() => {
                window.location.reload();
            }, 3000);

        } catch (error) {
            console.error(error);
            notify('error', 'Erro ao limpar base de dados. Tente novamente ou use o método manual via Google Drive.');
            setIsResetting(false);
        }
    };

    const handleHardReset = async () => {
        requestConfirmation({
            title: "LIMPEZA TOTAL (PERIGO)",
            message: "Esta ação irá APAGAR TODOS OS DADOS (Clientes, Faturas, Histórico, etc). O sistema voltará ao estado inicial. Tem certeza absoluta?",
            variant: 'danger',
            confirmText: 'APAGAR TUDO',
            onConfirm: () => {
                // Second confirmation level via simpler confirm or nested request (simplified here for UX)
                if (confirm("Último aviso: Esta ação não pode ser desfeita. Deseja realmente limpar a base de dados?")) {
                    executeHardReset();
                }
            }
        });
    };

    const handleFullImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        requestConfirmation({
            title: "Restaurar Backup Completo",
            message: "ATENÇÃO: Importar um backup completo irá substituir TODOS os dados atuais. Deseja continuar?",
            variant: 'warning',
            confirmText: 'Restaurar',
            onCancel: () => {
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
            onConfirm: () => {
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
            }
        });
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

            {/* FERRAMENTAS DE MANUTENÇÃO */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-sm">
                <h4 className="font-black text-blue-800 flex items-center gap-2 text-sm mb-3"><Layers size={16}/> Ferramentas de Manutenção</h4>
                <div className="flex gap-4">
                    <button 
                        onClick={handleDeduplicateBank}
                        className="bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Split size={14}/> Analisar Duplicados Bancários
                    </button>
                </div>
                <p className="text-[10px] text-blue-600/70 mt-2">
                    Abre uma ferramenta visual para identificar e remover transações bancárias duplicadas (Data + Valor + Descrição).
                </p>
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
                <h4 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-3"><AlertTriangle size={16}/> Zona de Perigo</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col justify-between bg-red-50 p-4 rounded-xl border border-red-100">
                        <div>
                            <strong className="text-red-700 text-sm">Reset de Configurações</strong>
                            <p className="text-xs text-red-600 mt-1 mb-3">
                                Repõe definições de fábrica (empresa, impostos). Não apaga dados.
                            </p>
                        </div>
                        <button 
                            onClick={() => { 
                                requestConfirmation({
                                    title: "Restaurar Padrões",
                                    message: "Deseja restaurar as definições de fábrica? As configurações atuais serão perdidas.",
                                    variant: 'warning',
                                    confirmText: 'Restaurar',
                                    onConfirm: () => { db.settings.reset(); window.location.reload(); } 
                                });
                            }} 
                            className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={14}/> Restaurar Padrões
                        </button>
                    </div>

                    <div className="flex flex-col justify-between bg-red-100 p-4 rounded-xl border border-red-200">
                        <div>
                            <strong className="text-red-800 text-sm">Limpeza Total (Hard Reset)</strong>
                            <p className="text-xs text-red-700 mt-1 mb-3">
                                Apaga TODOS os dados (Clientes, Faturas, etc) e reinicia a aplicação.
                            </p>
                        </div>
                        <button 
                            onClick={handleHardReset} 
                            disabled={isResetting}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            <Bomb size={14}/> {isResetting ? 'A limpar...' : 'Apagar TUDO'}
                        </button>
                    </div>
                </div>
            </div>

            <BankDeduplicationModal 
                isOpen={isDedupeModalOpen} 
                onClose={() => setIsDedupeModalOpen(false)}
                transactions={bankTransactions}
                onConfirm={confirmDeduplication}
            />
        </div>
    );
};
