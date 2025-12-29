
import { driveService } from './googleDriveService';
import { Transaction, Client, Employee, Proposal, Appointment, Material, SystemSettings, BankTransaction, DocumentTemplate, GeneratedDocument, User, Invoice, Account, RecurringContract, DevNote, BaseRecord, StockMovement } from '../types';

// O estado global da base de dados (In-Memory)
// Inicializa vazio para garantir que a UI espera pelo carregamento
let GLOBAL_DB = {
    settings: {} as SystemSettings,
    transactions: [] as Transaction[],
    clients: [] as Client[],
    employees: [] as Employee[],
    proposals: [] as Proposal[],
    materials: [] as Material[],
    stockMovements: [] as StockMovement[], // NEW
    appointments: [] as Appointment[],
    invoices: [] as Invoice[],
    recurringContracts: [] as RecurringContract[],
    bankTransactions: [] as BankTransaction[],
    categories: [] as Account[],
    users: [] as User[],
    templates: [] as DocumentTemplate[],
    documents: [] as GeneratedDocument[],
    devNotes: [] as DevNote[],
    lastSync: 0
};

// PLANO DE CONTAS PADRÃO (MGA REALIDADE)
const DEFAULT_ACCOUNTS: Account[] = [
    // 1. Receitas
    { id: '1.1', code: '1.1', name: 'Serviços de Avença', type: 'Receita Operacional' },
    { id: '1.2', code: '1.2', name: 'Serviços Pontuais', type: 'Receita Operacional' },
    { id: '1.3', code: '1.3', name: 'Venda de Peças', type: 'Receita Operacional' },
    
    // 2. Custos Diretos (Variáveis)
    { id: '2.1', code: '2.1', name: 'Custo das Mercadorias (CMV)', type: 'Custo Direto' },
    { id: '2.2', code: '2.2', name: 'Custos de Importação', type: 'Custo Direto' },
    { id: '2.3', code: '2.3', name: 'Consumíveis de Obra', type: 'Custo Direto' },
    { id: '2.4', code: '2.4', name: 'Transportes Operacionais', type: 'Custo Direto' },
    { id: '2.5', code: '2.5', name: 'Manutenção de Veículos', type: 'Custo Direto' },

    // 3. Custos Fixos (Estrutura)
    { id: '3.1', code: '3.1', name: 'Salários e Remunerações', type: 'Custo Fixo' },
    { id: '3.2', code: '3.2', name: 'Encargos Sociais', type: 'Custo Fixo' },
    { id: '3.3', code: '3.3', name: 'Serviços Especializados', type: 'Custo Fixo' },
    { id: '3.4', code: '3.4', name: 'Comunicações e Tecnologia', type: 'Custo Fixo' },
    { id: '3.5', code: '3.5', name: 'Instalações (Rendas/Água/Luz)', type: 'Custo Fixo' },
    { id: '3.6', code: '3.6', name: 'Material de Escritório/Geral', type: 'Custo Fixo' },

    // 4. Despesas Financeiras
    { id: '4.1', code: '4.1', name: 'Juros e Despesas Bancárias', type: 'Despesa Financeira' },
    { id: '4.2', code: '4.2', name: 'Multas e Coimas', type: 'Despesa Financeira' },

    // 5. Movimentos de Balanço
    { id: '5.1', code: '5.1', name: 'Entrada de Empréstimos', type: 'Movimento de Balanço' },
    { id: '5.2', code: '5.2', name: 'Amortização de Capital', type: 'Movimento de Balanço' },
    { id: '5.3', code: '5.3', name: 'Investimento em Ativos', type: 'Movimento de Balanço' },
    { id: '5.4', code: '5.4', name: 'Transferências Internas', type: 'Movimento de Balanço' }
];

// Defaults Settings
const DEFAULT_SETTINGS: SystemSettings = {
    companyName: 'Minha Empresa',
    companyNif: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    currency: 'CVE',
    defaultTaxRate: 15,
    defaultRetentionRate: 0,
    monthlyTarget: 1000000,
    reconciliationDateMargin: 3,
    reconciliationValueMargin: 0.1,
    enableTreasuryHardDelete: false, // Default: Hard Delete is Disabled
    paymentMethods: ['Dinheiro', 'Cheque', 'Transferência'],
    defaultProposalValidityDays: 15,
    defaultProposalNotes: '',
    serviceTypes: [],
    calendarStartHour: 8,
    calendarEndHour: 18,
    calendarInterval: 30,
    proposalLayout: {
        primaryColor: '#16a34a',
        secondaryColor: '#f0fdf4',
        backgroundStyle: 'clean',
        headerShape: 'rounded',
        showClientNif: true,
        showClientAddress: true,
        showTerms: true,
        showSignature: true,
        showValidity: true
    },
    fiscalConfig: {
        enabled: false,
        environment: 'sandbox',
        apiKey: '',
        clientId: '',
        clientSecret: '',
        invoiceSeries: 'A',
        nextInvoiceNumber: 1,
        issuerNif: '',
        ledCode: '',
        repositoryCode: '2',
        allowManualInvoiceDate: false
    },
    trainingMode: false
};

// IDs do Drive
let DRIVE_FOLDER_ID: string | null = null;
let DRIVE_FILE_ID: string | null = null;

// Callbacks da UI
let notifyUser: ((type: 'success' | 'error' | 'info', message: string) => void) | null = null;

// Flag de bloqueio para evitar múltiplas gravações simultâneas na mesma instância
let isSyncing = false;
let pendingSave = false;

// Configuração do Lock
const LOCK_TIMEOUT_MS = 60000; // 60 segundos para considerar um lock abandonado (Stale Lock)
const RETRY_DELAY_MS = 3000;   // Tentar novamente a cada 3 segundos
const MAX_RETRIES = 5;

// --- LOGIC: TIMESTAMP & MERGE ---

/**
 * Compare two items and merge them based on `updatedAt`.
 * Last Write Wins strategy.
 */
const mergeArrays = (localArr: any[], cloudArr: any[]) => {
    const mergedMap = new Map();

    // 1. Add all Cloud items first
    (cloudArr || []).forEach(item => {
        if (item && item.id) {
            mergedMap.set(item.id, item);
        }
    });

    // 2. Merge Local items
    (localArr || []).forEach(localItem => {
        if (!localItem || !localItem.id) return;

        const cloudItem = mergedMap.get(localItem.id);

        if (!cloudItem) {
            // New item created locally
            mergedMap.set(localItem.id, localItem);
        } else {
            // Conflict resolution: Compare timestamps
            const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
            const cloudTime = cloudItem.updatedAt ? new Date(cloudItem.updatedAt).getTime() : 0;

            // If Local is newer (or equal), Local wins.
            // If Cloud is newer, Cloud wins (Local state was stale).
            if (localTime >= cloudTime) {
                mergedMap.set(localItem.id, localItem);
            } else {
                // Cloud wins, do nothing (keep cloudItem in map)
                // console.log(`[Sync] Cloud version newer for ${localItem.id}. Reverting local change.`);
            }
        }
    });

    return Array.from(mergedMap.values());
};

/**
 * Updates the local collection by comparing new data with current DB state.
 * If a record has changed, update its `updatedAt` timestamp.
 */
const updateCollectionWithTimestamp = <T extends { id: string | number }>(
    currentCollection: T[], 
    newData: T[]
): T[] => {
    const now = new Date().toISOString();
    const currentMap = new Map(currentCollection.map(i => [i.id, i]));

    return newData.map(newItem => {
        const oldItem = currentMap.get(newItem.id);
        
        // If new item or content changed, update timestamp
        // We use JSON stringify for deep comparison (simple and effective for this scale)
        if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
            return { ...newItem, updatedAt: now };
        }
        
        // No change, keep existing item (preserves old timestamp)
        return oldItem;
    });
};

// --- LOCKING SYSTEM ---

const acquireLock = async (retryCount = 0): Promise<string | null> => {
    if (!DRIVE_FOLDER_ID) return null;

    try {
        const lockFile = await driveService.getLockFile(DRIVE_FOLDER_ID);
        
        if (lockFile) {
            // Check if lock is stale (older than LOCK_TIMEOUT_MS)
            const content = await driveService.readFile(lockFile.id);
            const lockAge = Date.now() - (content.timestamp || 0);
            
            if (lockAge > LOCK_TIMEOUT_MS) {
                console.warn("[DB] Stale lock detected. Overriding...");
                await driveService.deleteFile(lockFile.id);
            } else {
                // Lock is active
                if (retryCount < MAX_RETRIES) {
                    if (notifyUser && retryCount === 0) {
                        notifyUser('info', `Sistema ocupado por ${content.user || 'outro utilizador'}. A aguardar...`);
                    }
                    console.log(`[DB] Locked by ${content.user}. Retrying in ${RETRY_DELAY_MS}ms...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                    return acquireLock(retryCount + 1);
                } else {
                    if (notifyUser) notifyUser('error', `Tempo limite excedido. O sistema está bloqueado por ${content.user}. Tente novamente.`);
                    throw new Error("Could not acquire lock");
                }
            }
        }

        // Create Lock
        const userProfile = driveService.getUserProfile();
        const userName = userProfile ? userProfile.getName() : 'Utilizador';
        const newLock = await driveService.createLock(DRIVE_FOLDER_ID, { user: userName, action: 'Syncing' });
        return newLock.id;

    } catch (e) {
        console.error("Lock Error:", e);
        return null;
    }
};

const releaseLock = async (lockId: string) => {
    if (lockId) {
        await driveService.deleteFile(lockId);
    }
};


// --- SYNC STRATEGY ---
const performSmartSave = async () => {
    if (!DRIVE_FILE_ID || !DRIVE_FOLDER_ID) return;
    if (isSyncing) {
        pendingSave = true;
        return;
    }

    isSyncing = true;
    let lockId: string | null = null;

    console.log("🔄 [DB] A iniciar sincronização atómica...");

    try {
        // 1. Check-in (Acquire Lock)
        lockId = await acquireLock();
        if (!lockId) {
            isSyncing = false;
            return; // Abort saving if lock failed
        }

        // 2. Obter a versão mais recente da Cloud (Critical Read inside Lock)
        const cloudData = await driveService.readFile(DRIVE_FILE_ID);
        
        // 3. MERGE STRATEGY (Last Write Wins via updatedAt)
        const mergedDB = {
            ...cloudData,
            settings: { ...cloudData.settings, ...GLOBAL_DB.settings }, // Settings merge simples
            transactions: mergeArrays(GLOBAL_DB.transactions, cloudData.transactions),
            clients: mergeArrays(GLOBAL_DB.clients, cloudData.clients),
            employees: mergeArrays(GLOBAL_DB.employees, cloudData.employees),
            proposals: mergeArrays(GLOBAL_DB.proposals, cloudData.proposals),
            materials: mergeArrays(GLOBAL_DB.materials, cloudData.materials),
            stockMovements: mergeArrays(GLOBAL_DB.stockMovements, cloudData.stockMovements), // NEW
            appointments: mergeArrays(GLOBAL_DB.appointments, cloudData.appointments),
            invoices: mergeArrays(GLOBAL_DB.invoices, cloudData.invoices),
            bankTransactions: mergeArrays(GLOBAL_DB.bankTransactions, cloudData.bankTransactions),
            devNotes: mergeArrays(GLOBAL_DB.devNotes, cloudData.devNotes),
            recurringContracts: mergeArrays(GLOBAL_DB.recurringContracts, cloudData.recurringContracts),
            documents: mergeArrays(GLOBAL_DB.documents, cloudData.documents),
            templates: mergeArrays(GLOBAL_DB.templates, cloudData.templates),
            // Se categorias locais tiverem dados, usa elas, senão usa nuvem
            categories: (GLOBAL_DB.categories && GLOBAL_DB.categories.length > 0) ? GLOBAL_DB.categories : cloudData.categories,
            lastSync: Date.now()
        };

        // 4. Upload
        await driveService.updateFile(DRIVE_FILE_ID, mergedDB);
        
        // 5. Atualizar memória local com o resultado do merge (para refletir 'vencedores' da nuvem na UI)
        GLOBAL_DB = mergedDB;
        
        console.log("✅ [DB] Sincronização concluída com sucesso.");

    } catch (e) {
        console.error("❌ [DB] Falha na sincronização:", e);
        if (notifyUser) notifyUser('error', 'Erro ao sincronizar dados. Verifique a conexão.');
    } finally {
        // 6. Check-out (Release Lock)
        if (lockId) await releaseLock(lockId);
        
        isSyncing = false;
        if (pendingSave) {
            pendingSave = false;
            setTimeout(performSmartSave, 1000); // Retry soon
        }
    }
};

// Debounce wrapper
let saveTimeout: any = null;
const scheduleSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(performSmartSave, 2000); // 2s debounce
};

export const db = {
    // Inject notifier
    setNotifier: (fn: (type: 'success' | 'error' | 'info', message: string) => void) => {
        notifyUser = fn;
    },

    init: async () => {
        try {
            console.log("🚀 [DB] A inicializar ligação ao Drive...");
            
            // 1. Encontrar/Criar Pasta
            let folder = await driveService.findFolder();
            if (!folder) {
                console.log("📂 Pasta não encontrada. A criar...");
                folder = await driveService.createFolder();
            }
            DRIVE_FOLDER_ID = folder.id;

            // 2. Encontrar/Criar Ficheiro
            let file = await driveService.findFile(DRIVE_FOLDER_ID!);
            if (!file) {
                console.log("📄 Base de dados nova. A criar ficheiro...");
                GLOBAL_DB.settings = DEFAULT_SETTINGS;
                // Inicializar com categorias padrão
                GLOBAL_DB.categories = DEFAULT_ACCOUNTS;
                
                const newFile = await driveService.createFile(DRIVE_FOLDER_ID!, GLOBAL_DB);
                DRIVE_FILE_ID = newFile.id;
            } else {
                console.log("⬇️ A transferir dados mais recentes...");
                DRIVE_FILE_ID = file.id;
                // Leitura com cache-busting garantido pelo service
                const content = await driveService.readFile(DRIVE_FILE_ID!);
                
                // Reset total do GLOBAL_DB com o que veio da nuvem
                GLOBAL_DB = {
                    ...GLOBAL_DB, // Estrutura base
                    ...content,   // Dados da nuvem
                    settings: { ...DEFAULT_SETTINGS, ...(content.settings || {}) } // Merge settings seguros
                };

                // SEEDING DE RECUPERAÇÃO
                if (!GLOBAL_DB.categories || GLOBAL_DB.categories.length === 0) {
                    GLOBAL_DB.categories = DEFAULT_ACCOUNTS;
                    scheduleSave();
                }
            }
            
            return true;
        } catch (e) {
            console.error("🔥 ERRO CRÍTICO DB:", e);
            throw e;
        }
    },

    settings: {
        get: async () => GLOBAL_DB.settings,
        save: async (s: SystemSettings) => { GLOBAL_DB.settings = s; scheduleSave(); },
        reset: async () => { GLOBAL_DB.settings = DEFAULT_SETTINGS; scheduleSave(); }
    },

    // Collections with Auto-Timestamping
    transactions: {
        getAll: async () => GLOBAL_DB.transactions || [],
        save: async (data: Transaction[]) => { 
            GLOBAL_DB.transactions = updateCollectionWithTimestamp(GLOBAL_DB.transactions, data); 
            scheduleSave(); 
        }
    },
    clients: {
        getAll: async () => GLOBAL_DB.clients || [],
        save: async (data: Client[]) => { 
            GLOBAL_DB.clients = updateCollectionWithTimestamp(GLOBAL_DB.clients, data); 
            scheduleSave(); 
        }
    },
    employees: {
        getAll: async () => GLOBAL_DB.employees || [],
        save: async (data: Employee[]) => { 
            GLOBAL_DB.employees = updateCollectionWithTimestamp(GLOBAL_DB.employees, data); 
            scheduleSave(); 
        }
    },
    proposals: {
        getAll: async () => GLOBAL_DB.proposals || [],
        save: async (data: Proposal[]) => { 
            GLOBAL_DB.proposals = updateCollectionWithTimestamp(GLOBAL_DB.proposals, data); 
            scheduleSave(); 
        },
        getNextId: (existing: Proposal[]) => {
            const year = new Date().getFullYear();
            const seq = existing.length + 1;
            return { id: `PROP-${year}/${seq.toString().padStart(3, '0')}`, sequence: seq };
        }
    },
    materials: {
        getAll: async () => GLOBAL_DB.materials || [],
        save: async (data: Material[]) => { 
            GLOBAL_DB.materials = updateCollectionWithTimestamp(GLOBAL_DB.materials, data); 
            scheduleSave(); 
        },
        getNextCode: (type: 'Material' | 'Serviço') => {
            const prefix = type === 'Material' ? 'M' : 'S';
            const all = GLOBAL_DB.materials || [];
            const relevant = all.filter(m => m.internalCode && m.internalCode.startsWith(prefix));
            const numbers = relevant.map(m => {
                const numPart = m.internalCode.substring(1);
                return parseInt(numPart) || 0;
            });
            const max = numbers.length > 0 ? Math.max(...numbers) : 0;
            return `${prefix}${(max + 1).toString().padStart(6, '0')}`;
        }
    },
    stockMovements: {
        getAll: async () => GLOBAL_DB.stockMovements || [],
        save: async (data: StockMovement[]) => { 
            GLOBAL_DB.stockMovements = updateCollectionWithTimestamp(GLOBAL_DB.stockMovements, data); 
            scheduleSave(); 
        }
    },
    appointments: {
        getAll: async () => GLOBAL_DB.appointments || [],
        save: async (data: Appointment[]) => { 
            GLOBAL_DB.appointments = updateCollectionWithTimestamp(GLOBAL_DB.appointments, data); 
            scheduleSave(); 
        },
        getNextCode: (existing: Appointment[]) => {
            const year = new Date().getFullYear();
            const seq = existing.filter(a => a.code?.startsWith(`AG-${year}`)).length + 1;
            return `AG-${year}/${seq.toString().padStart(3, '0')}`;
        }
    },
    invoices: {
        getAll: async () => GLOBAL_DB.invoices || [],
        save: async (data: Invoice[]) => { 
            // 🛡️ GUARDIÃO DE INTEGRIDADE FISCAL 🛡️
            // Verifica tentativas de alteração em documentos já emitidos/pagos/anulados
            // Apenas mudanças de estado e campos não-fiscais são permitidos.
            
            const currentInvoices = GLOBAL_DB.invoices;
            const protectedStatuses = ['Emitida', 'Paga', 'Anulada'];

            // Filtra e valida apenas as que já existem na BD
            for (const newInv of data) {
                const existing = currentInvoices.find(i => i.id === newInv.id);
                
                if (existing && protectedStatuses.includes(existing.status)) {
                    // Se o documento já está "trancado", verificamos se houve alteração de conteúdo crítico
                    
                    const isContentChanged = 
                        JSON.stringify(existing.items) !== JSON.stringify(newInv.items) ||
                        existing.total !== newInv.total ||
                        existing.clientNif !== newInv.clientNif ||
                        existing.date !== newInv.date ||
                        existing.iud !== newInv.iud;

                    if (isContentChanged) {
                        console.error(`[DB Security] Tentativa de alterar documento fiscal emitido: ${existing.id}`);
                        if (notifyUser) notifyUser('error', `Ação Bloqueada: O documento ${existing.id} já foi emitido e é imutável.`);
                        
                        // REJEITA A ALTERAÇÃO: Mantém o registo original no array 'data' que será salvo
                        // Substitui o 'newInv' pelo 'existing' dentro do array data (mutação local antes do save real)
                        const index = data.findIndex(i => i.id === newInv.id);
                        if (index !== -1) {
                            // Mas permite alteração de status (ex: Emitida -> Paga)
                            if (existing.status !== newInv.status) {
                                // Se for apenas status, permitimos, mas revertemos o conteúdo para o original
                                data[index] = { ...existing, status: newInv.status };
                            } else {
                                // Reverte totalmente
                                data[index] = existing;
                            }
                        }
                    }
                }
            }

            GLOBAL_DB.invoices = updateCollectionWithTimestamp(GLOBAL_DB.invoices, data); 
            scheduleSave(); 
        },
        getNextNumber: (series: string) => {
            return (GLOBAL_DB.invoices.filter(i => i.series === series).length) + 1;
        }
    },
    bankTransactions: {
        getAll: async () => GLOBAL_DB.bankTransactions || [],
        save: async (data: BankTransaction[]) => { 
            GLOBAL_DB.bankTransactions = updateCollectionWithTimestamp(GLOBAL_DB.bankTransactions, data); 
            scheduleSave(); 
        }
    },
    categories: {
        getAll: async () => GLOBAL_DB.categories || [],
        save: async (data: Account[]) => { 
            GLOBAL_DB.categories = updateCollectionWithTimestamp(GLOBAL_DB.categories, data); 
            scheduleSave(); 
        }
    },
    recurringContracts: {
        getAll: () => GLOBAL_DB.recurringContracts || [],
        save: (data: RecurringContract[]) => { 
            GLOBAL_DB.recurringContracts = updateCollectionWithTimestamp(GLOBAL_DB.recurringContracts, data); 
            scheduleSave(); 
        }
    },
    templates: {
        getAll: () => GLOBAL_DB.templates || [],
        save: (data: DocumentTemplate[]) => { 
            GLOBAL_DB.templates = updateCollectionWithTimestamp(GLOBAL_DB.templates, data); 
            scheduleSave(); 
        }
    },
    documents: {
        getAll: () => GLOBAL_DB.documents || [],
        save: (data: GeneratedDocument[]) => { 
            GLOBAL_DB.documents = updateCollectionWithTimestamp(GLOBAL_DB.documents, data); 
            scheduleSave(); 
        }
    },
    devNotes: {
        getAll: async () => GLOBAL_DB.devNotes || [],
        save: async (data: DevNote[]) => { 
            GLOBAL_DB.devNotes = updateCollectionWithTimestamp(GLOBAL_DB.devNotes, data); 
            scheduleSave(); 
        }
    },
    users: {
        getAll: async () => GLOBAL_DB.users || [],
        save: (data: User[]) => { 
            GLOBAL_DB.users = updateCollectionWithTimestamp(GLOBAL_DB.users, data); 
            scheduleSave(); 
        },
        create: async (u: any) => { 
            const newUser = {...u, id: Date.now().toString(), updatedAt: new Date().toISOString()};
            GLOBAL_DB.users = [...(GLOBAL_DB.users || []), newUser];
            scheduleSave(); 
            return {success: true, error: undefined}; 
        },
        update: async (u: User) => { 
            const updatedUser = { ...u, updatedAt: new Date().toISOString() };
            GLOBAL_DB.users = (GLOBAL_DB.users || []).map(x => x.id === u.id ? updatedUser : x);
            scheduleSave();
            return {success: true, error: undefined}; 
        },
        delete: async (id: string) => {
            GLOBAL_DB.users = (GLOBAL_DB.users || []).filter(x => x.id !== id);
            scheduleSave();
        },
        getSession: () => null,
        setSession: () => {}
    },

    // Cache local apenas para UI preferences (filtros), não dados
    cache: {
        get: (k: string, fb: any) => fb // Disable app-level caching for data to force DB usage
    },
    filters: {
        getDashboard: () => JSON.parse(localStorage.getItem('f_dash') || '{}') || { month: 0, year: new Date().getFullYear() },
        saveDashboard: (v: any) => localStorage.setItem('f_dash', JSON.stringify(v)),
        getRegistry: () => JSON.parse(localStorage.getItem('f_reg') || '{}') || { month: 0 },
        saveRegistry: (v: any) => localStorage.setItem('f_reg', JSON.stringify(v)),
        getAgenda: () => JSON.parse(localStorage.getItem('f_agd') || '{}') || { status: 'Todos' },
        saveAgenda: (v: any) => localStorage.setItem('f_agd', JSON.stringify(v)),
    },
    keys: { SETTINGS: 's', ACCOUNTS: 'a' },

    // Force Sync Manual (Botão Refresh)
    forceSync: async () => {
        await performSmartSave();
        return true;
    }
};
