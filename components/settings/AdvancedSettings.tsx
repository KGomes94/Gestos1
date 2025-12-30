
import React, { useRef, useState } from 'react';
import { SystemSettings, BankTransaction } from '../../types';
import { Database, Download, Trash2, AlertTriangle, RotateCcw, FlaskConical, HardDrive, RefreshCw, Bomb, Layers, Split, ShieldCheck } from 'lucide-react';
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
    setBankTransactions: React.Dispatch<React.SetStateAction<BankTransaction[]>>; // Added setter
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
    transactions, bankTransactions, setBankTransactions, categories, clients, employees, proposals, materials, appointments, templates, documents, invoices, usersList
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
                onConfirm: async () => {
                    const newSettings = { ...settings, trainingMode: false };
                    
                    // 1. Atualizar Localmente
                    onSettingsChange(newSettings);
                    
                    // 2. Persistir no DB Local
                    await db.settings.save(newSettings);
                    
                    // 3. FORÇAR SYNC COM A NUVEM
                    // Isto é crítico porque o App.tsx pára de sincronizar quando está em modo de treino.
                    // Precisamos garantir que o 'false' chega à nuvem antes do reload.
                    notify('info', 'A guardar preferências na nuvem...');
                    try {
                        await db.forceSync();
                    } catch (e) {
                        console.error("Erro ao sincronizar desativação de modo treino", e);
                    }

                    notify('info', 'A reiniciar sistema...');
                    setTimeout(() => window.location.reload(), 1500);
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

        // 1. Calcular a nova lista
        const newBankTransactions = bankTransactions.filter(tx => !idsToRemove.includes(tx.id));
        
        // 2. Atualizar Estado React (Visual Imediato e sem logout)
        setBankTransactions(newBankTransactions);

        // 3. Gravar na Base de Dados (Sync Background)
        await db.bankTransactions.save(newBankTransactions);
        
        setIsDedupeModalOpen(false);
        notify('success', `${idsToRemove.length} registos duplicados eliminados com sucesso.`);
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
                if (confirm("Último aviso: Esta ação não pode ser desfeita. Deseja realmente limpar a base de dados?")) {
                    executeHardReset();
                }
            }
        });
    };

    const handleFullImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Implementação simplificada: em sistema fragmentado, importação total deve ser feita com cuidado.
        // Por agora, mantemos funcionalidade básica que assume JSON único, mas idealmente pediria por ficheiro.
        notify('info', 'Funcionalidade limitada na versão fragmentada. Contacte suporte para restauro total.');
    };

    const tables = [
        { name: 'Transações', key: 'transactions', data: transactions, icon: '💰', file: 'finance.json' },
        { name: 'Faturas', key: 'invoices', data: invoices, icon: '📄', file: 'finance.json' },
        { name: 'Clientes', key: 'clients', data: clients, icon: '👥', file: 'crm.json' },
        { name: 'Propostas', key: 'proposals', data: proposals, icon: '📝', file: 'operations.json' },
        { name: 'Materiais', key: 'materials', data: materials, icon: '📦', file: 'operations.json' },
        { name: 'Agenda', key: 'appointments', data: appointments, icon: '📅', file: 'operations.json' },
        { name: 'Funcionários', key: 'employees', data: employees, icon: '👔', file: 'crm.json' },
        { name: 'Mov. Bancários', key: 'bankTransactions', data: bankTransactions, icon: '🏦', file: 'finance.json' },
    ];

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Database size={20} className="text-green-600"/> Gestão Avançada de Dados
                </h3>
                <p className="text-sm text-gray-500">Base de Dados Fragmentada v2.0 (Desempenho Otimizado)</p>
            </div>

            {/* STATUS DO SISTEMA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl shadow-sm">
                    <h4 className="font-black text-green-800 flex items-center gap-2 text-sm mb-2"><ShieldCheck size={16}/> Sistema de Backup Automático</h4>
                    <p className="text-xs text-green-700">
                        O sistema realiza um backup automático de todos os ficheiros diariamente ao iniciar.
                        Verifique a pasta <code>GestOs_Data_v2/Backups</code> no seu Google Drive.
                    </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-sm">
                    <h4 className="font-black text-blue-800 flex items-center gap-2 text-sm mb-2"><Layers size={16}/> Estrutura de Ficheiros</h4>
                    <p className="text-xs text-blue-700">
                        Os dados estão divididos em 4 módulos (Config, CRM, Financeiro, Operações) para garantir rapidez no carregamento e segurança na gravação.
                    </p>
                </div>
            </div>

            {/* FERRAMENTAS DE MANUTENÇÃO */}
            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm mt-4">
                <h4 className="font-black text-gray-700 flex items-center gap-2 text-sm mb-3"><Split size={16}/> Ferramentas de Manutenção</h4>
                <div className="flex gap-4">
                    <button 
                        onClick={handleDeduplicateBank}
                        className="bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Split size={14}/> Analisar Duplicados Bancários
                    </button>
                </div>
            </div>

            {/* MODO TREINO */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between shadow-sm mt-4">
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
            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm mt-4">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2"><HardDrive size={16}/> Tabelas do Sistema</h4>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500">
                        <tr>
                            <th className="px-6 py-3 text-left">Tabela</th>
                            <th className="px-6 py-3 text-left">Ficheiro Origem</th>
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
                                <td className="px-6 py-3 text-xs text-gray-500 font-mono">
                                    {table.file}
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
