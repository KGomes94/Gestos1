
import { driveService } from './googleDriveService';
import { Transaction, Client, Employee, Proposal, Appointment, Material, SystemSettings, BankTransaction, DocumentTemplate, GeneratedDocument, User, Invoice, Account, RecurringContract, DevNote } from '../types';

// O estado global da base de dados (In-Memory)
// Inicializa vazio para garantir que a UI espera pelo carregamento
let GLOBAL_DB = {
    settings: {} as SystemSettings,
    transactions: [] as Transaction[],
    clients: [] as Client[],
    employees: [] as Employee[],
    proposals: [] as Proposal[],
    materials: [] as Material[],
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

// Defaults
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
        repositoryCode: '2'
    },
    trainingMode: false
};

// IDs do Drive
let DRIVE_FOLDER_ID: string | null = null;
let DRIVE_FILE_ID: string | null = null;

// Flag de bloqueio para evitar múltiplas gravações simultâneas na mesma instância
let isSyncing = false;
let pendingSave = false;

// --- ROBUST SYNC STRATEGY ---
// 1. Fetch Latest Cloud DB
// 2. Merge Local Changes (Priority to local if conflict, or smart merge lists)
// 3. Upload Merged DB
const performSmartSave = async () => {
    if (!DRIVE_FILE_ID) return;
    if (isSyncing) {
        pendingSave = true;
        return;
    }

    isSyncing = true;
    console.log("🔄 [DB] A iniciar sincronização segura...");

    try {
        // 1. Obter a versão mais recente da Cloud (Critical: Evita overwrite de outros users)
        const cloudData = await driveService.readFile(DRIVE_FILE_ID);
        
        // 2. MERGE STRATEGY
        // Mantemos os dados locais que o utilizador acabou de editar, 
        // mas preservamos registos da nuvem que não existem localmente (adicionados por outros)
        
        // Exemplo Genérico de Merge de Arrays por ID
        const mergeArrays = (localArr: any[], cloudArr: any[]) => {
            const localMap = new Map(localArr.map(i => [i.id, i]));
            const cloudMap = new Map((cloudArr || []).map(i => [i.id, i]));
            
            // Todos os do Cloud
            const mergedMap = new Map(cloudMap);
            
            // Sobrepor com os locais (A "minha" edição ganha sobre a nuvem no conflito direto)
            // Isto permite editar sem perder o que outros fizeram em *outros* registos
            localArr.forEach(item => {
                mergedMap.set(item.id, item);
            });
            
            return Array.from(mergedMap.values());
        };

        const mergedDB = {
            ...cloudData,
            settings: { ...cloudData.settings, ...GLOBAL_DB.settings }, // Settings merge simples
            transactions: mergeArrays(GLOBAL_DB.transactions, cloudData.transactions),
            clients: mergeArrays(GLOBAL_DB.clients, cloudData.clients),
            employees: mergeArrays(GLOBAL_DB.employees, cloudData.employees),
            proposals: mergeArrays(GLOBAL_DB.proposals, cloudData.proposals),
            materials: mergeArrays(GLOBAL_DB.materials, cloudData.materials),
            appointments: mergeArrays(GLOBAL_DB.appointments, cloudData.appointments),
            invoices: mergeArrays(GLOBAL_DB.invoices, cloudData.invoices),
            bankTransactions: mergeArrays(GLOBAL_DB.bankTransactions, cloudData.bankTransactions),
            devNotes: mergeArrays(GLOBAL_DB.devNotes, cloudData.devNotes),
            // ... outros arrays
            lastSync: Date.now()
        };

        // 3. Upload
        await driveService.updateFile(DRIVE_FILE_ID, mergedDB);
        
        // 4. Atualizar memória local com o resultado do merge (para ver alterações de outros)
        GLOBAL_DB = mergedDB;
        
        console.log("✅ [DB] Sincronização concluída com sucesso.");

    } catch (e) {
        console.error("❌ [DB] Falha na sincronização:", e);
        // Não lançamos erro para não bloquear a UI, mas a flag pending garante nova tentativa
    } finally {
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
            }
            
            return true;
        } catch (e) {
            console.error("🔥 ERRO CRÍTICO DB:", e);
            throw e; // Propagar para o AuthContext lidar (alertar user)
        }
    },

    // Acesso direto para UI (Read)
    // Nota: Como é single-page app, a leitura é síncrona da memória. 
    // A sincronização (escrita/leitura cloud) é gerida pelo scheduleSave.
    
    settings: {
        get: async () => GLOBAL_DB.settings,
        save: async (s: SystemSettings) => { GLOBAL_DB.settings = s; scheduleSave(); },
        reset: async () => { GLOBAL_DB.settings = DEFAULT_SETTINGS; scheduleSave(); }
    },

    // Generic Helper para todas as coleções
    // Padrão: getAll retorna da memória (instantâneo), save atualiza memória e agendar sync cloud
    
    transactions: {
        getAll: async () => GLOBAL_DB.transactions || [],
        save: async (data: Transaction[]) => { GLOBAL_DB.transactions = data; scheduleSave(); }
    },
    clients: {
        getAll: async () => GLOBAL_DB.clients || [],
        save: async (data: Client[]) => { GLOBAL_DB.clients = data; scheduleSave(); }
    },
    employees: {
        getAll: async () => GLOBAL_DB.employees || [],
        save: async (data: Employee[]) => { GLOBAL_DB.employees = data; scheduleSave(); }
    },
    proposals: {
        getAll: async () => GLOBAL_DB.proposals || [],
        save: async (data: Proposal[]) => { GLOBAL_DB.proposals = data; scheduleSave(); },
        getNextId: (existing: Proposal[]) => {
            const year = new Date().getFullYear();
            const seq = existing.length + 1;
            return { id: `PROP-${year}/${seq.toString().padStart(3, '0')}`, sequence: seq };
        }
    },
    materials: {
        getAll: async () => GLOBAL_DB.materials || [],
        save: async (data: Material[]) => { GLOBAL_DB.materials = data; scheduleSave(); }
    },
    appointments: {
        getAll: async () => GLOBAL_DB.appointments || [],
        save: async (data: Appointment[]) => { GLOBAL_DB.appointments = data; scheduleSave(); },
        getNextCode: (existing: Appointment[]) => {
            const year = new Date().getFullYear();
            const seq = existing.filter(a => a.code?.startsWith(`AG-${year}`)).length + 1;
            return `AG-${year}/${seq.toString().padStart(3, '0')}`;
        }
    },
    invoices: {
        getAll: async () => GLOBAL_DB.invoices || [],
        save: async (data: Invoice[]) => { GLOBAL_DB.invoices = data; scheduleSave(); },
        getNextNumber: (series: string) => {
            return (GLOBAL_DB.invoices.filter(i => i.series === series).length) + 1;
        }
    },
    bankTransactions: {
        getAll: async () => GLOBAL_DB.bankTransactions || [],
        save: async (data: BankTransaction[]) => { GLOBAL_DB.bankTransactions = data; scheduleSave(); }
    },
    categories: {
        getAll: async () => GLOBAL_DB.categories || [],
        save: async (data: Account[]) => { GLOBAL_DB.categories = data; scheduleSave(); }
    },
    recurringContracts: {
        getAll: () => GLOBAL_DB.recurringContracts || [],
        save: (data: RecurringContract[]) => { GLOBAL_DB.recurringContracts = data; scheduleSave(); }
    },
    templates: {
        getAll: () => GLOBAL_DB.templates || [],
        save: (data: DocumentTemplate[]) => { GLOBAL_DB.templates = data; scheduleSave(); }
    },
    documents: {
        getAll: () => GLOBAL_DB.documents || [],
        save: (data: GeneratedDocument[]) => { GLOBAL_DB.documents = data; scheduleSave(); }
    },
    devNotes: {
        getAll: async () => GLOBAL_DB.devNotes || [],
        save: async (data: DevNote[]) => { GLOBAL_DB.devNotes = data; scheduleSave(); }
    },
    users: {
        getAll: async () => GLOBAL_DB.users || [],
        save: (data: User[]) => { GLOBAL_DB.users = data; scheduleSave(); },
        create: async (u: any) => { 
            const newUser = {...u, id: Date.now().toString()};
            GLOBAL_DB.users = [...(GLOBAL_DB.users || []), newUser];
            scheduleSave(); 
            return {success: true, error: undefined}; 
        },
        update: async (u: User) => { 
            GLOBAL_DB.users = (GLOBAL_DB.users || []).map(x => x.id === u.id ? u : x);
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
