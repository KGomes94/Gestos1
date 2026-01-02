
import { driveService } from './googleDriveService';
import { Transaction, Client, Employee, Proposal, Appointment, Material, SystemSettings, BankTransaction, DocumentTemplate, GeneratedDocument, User, Invoice, Account, RecurringContract, DevNote, StockMovement, Purchase, RecurringPurchase } from '../types';

// GLOBAL IN-MEMORY STATE (Aggregates all modules)
let GLOBAL_DB = {
    // Config Module
    settings: {} as SystemSettings,
    users: [] as User[],
    categories: [] as Account[],
    templates: [] as DocumentTemplate[],
    devNotes: [] as DevNote[],
    
    // CRM Module
    clients: [] as Client[],
    employees: [] as Employee[],
    
    // Finance Module (Heavy)
    transactions: [] as Transaction[],
    bankTransactions: [] as BankTransaction[],
    invoices: [] as Invoice[],
    purchases: [] as Purchase[],
    recurringPurchases: [] as RecurringPurchase[],
    recurringContracts: [] as RecurringContract[],
    
    // Operations Module
    proposals: [] as Proposal[],
    materials: [] as Material[],
    stockMovements: [] as StockMovement[],
    appointments: [] as Appointment[],
    documents: [] as GeneratedDocument[],
    
    lastSync: 0
};

// --- FILE MAPPING STRATEGY ---
const FILES = {
    CONFIG: 'config.json',      // Settings, Users, Categories, Templates, DevNotes
    CRM: 'crm.json',            // Clients, Employees
    FINANCE: 'finance.json',    // Transactions, Bank, Invoices, Purchases, Contracts
    OPERATIONS: 'operations.json' // Proposals, Materials, Stock, Appointments, Docs
};

// Map each DB key to a specific file
const KEY_TO_FILE_MAP: Record<string, string> = {
    settings: FILES.CONFIG, users: FILES.CONFIG, categories: FILES.CONFIG, templates: FILES.CONFIG, devNotes: FILES.CONFIG,
    clients: FILES.CRM, employees: FILES.CRM,
    transactions: FILES.FINANCE, bankTransactions: FILES.FINANCE, invoices: FILES.FINANCE, purchases: FILES.FINANCE, recurringPurchases: FILES.FINANCE, recurringContracts: FILES.FINANCE,
    proposals: FILES.OPERATIONS, materials: FILES.OPERATIONS, stockMovements: FILES.OPERATIONS, appointments: FILES.OPERATIONS, documents: FILES.OPERATIONS
};

// Stores Drive File IDs for each module
let FILE_IDS: Record<string, string | null> = {
    [FILES.CONFIG]: null,
    [FILES.CRM]: null,
    [FILES.FINANCE]: null,
    [FILES.OPERATIONS]: null
};

// PLANO DE CONTAS PADRÃO
const DEFAULT_ACCOUNTS: Account[] = [
    { id: '1.1', code: '1.1', name: 'Serviços de Avença', type: 'Receita Operacional' },
    { id: '1.2', code: '1.2', name: 'Serviços Pontuais', type: 'Receita Operacional' },
    { id: '1.3', code: '1.3', name: 'Venda de Peças', type: 'Receita Operacional' },
    { id: '2.1', code: '2.1', name: 'Custo das Mercadorias (CMV)', type: 'Custo Direto' },
    { id: '2.2', code: '2.2', name: 'Custos de Importação', type: 'Custo Direto' },
    { id: '2.3', code: '2.3', name: 'Consumíveis de Obra', type: 'Custo Direto' },
    { id: '2.4', code: '2.4', name: 'Transportes Operacionais', type: 'Custo Direto' },
    { id: '2.5', code: '2.5', name: 'Manutenção de Veículos', type: 'Custo Direto' },
    { id: '3.1', code: '3.1', name: 'Salários e Remunerações', type: 'Custo Fixo' },
    { id: '3.2', code: '3.2', name: 'Encargos Sociais', type: 'Custo Fixo' },
    { id: '3.3', code: '3.3', name: 'Serviços Especializados', type: 'Custo Fixo' },
    { id: '3.4', code: '3.4', name: 'Comunicações e Tecnologia', type: 'Custo Fixo' },
    { id: '3.5', code: '3.5', name: 'Instalações (Rendas/Água/Luz)', type: 'Custo Fixo' },
    { id: '3.6', code: '3.6', name: 'Material de Escritório/Geral', type: 'Custo Fixo' },
    { id: '4.1', code: '4.1', name: 'Juros e Despesas Bancárias', type: 'Despesa Financeira' },
    { id: '4.2', code: '4.2', name: 'Multas e Coimas', type: 'Despesa Financeira' },
    { id: '5.1', code: '5.1', name: 'Entrada de Empréstimos', type: 'Movimento de Balanço' },
    { id: '5.2', code: '5.2', name: 'Amortização de Capital', type: 'Movimento de Balanço' },
    { id: '5.3', code: '5.3', name: 'Investimento em Ativos', type: 'Movimento de Balanço' },
    { id: '5.4', code: '5.4', name: 'Transferências Internas', type: 'Movimento de Balanço' }
];

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
    enableTreasuryHardDelete: false,
    allowNegativeStock: true,
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

let DRIVE_FOLDER_ID: string | null = null;
let notifyUser: ((type: 'success' | 'error' | 'info', message: string) => void) | null = null;
let isSyncing = false;
let pendingSaves = new Set<string>(); // Tracks which files need saving
let hasSyncError = false;
let syncStatusListener: ((status: 'saved' | 'saving' | 'error') => void) | null = null;

// --- HELPERS ---
const updateCollectionWithTimestamp = <T extends { id: string | number }>(currentCollection: T[], newData: T[]): T[] => {
    const now = new Date().toISOString();
    const currentMap = new Map(currentCollection.map(i => [i.id, i]));
    return newData.map(newItem => {
        const oldItem = currentMap.get(newItem.id);
        if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
            return { ...newItem, updatedAt: now };
        }
        return oldItem;
    });
};

// --- CORE FUNCTIONS ---

const initDatabase = async () => {
    try {
        console.log("🚀 [DB] Inicializando sistema de ficheiros fragmentado...");
        let folder = await driveService.findFolder();
        if (!folder) { 
            console.log("📂 Pasta não encontrada. Criando..."); 
            folder = await driveService.createFolder(); 
        }
        DRIVE_FOLDER_ID = folder.id;

        // 1. Verificar ficheiros existentes
        const files = await driveService.listFilesInFolder(DRIVE_FOLDER_ID!);
        
        // Mapear IDs encontrados
        Object.values(FILES).forEach(fileName => {
            const found = files.find((f: any) => f.name === fileName);
            if (found) FILE_IDS[fileName] = found.id;
        });

        // 2. Verificar Migração (Se existe database.json antigo mas não os novos)
        const oldDbFile = files.find((f: any) => f.name === 'database.json');
        const needsMigration = oldDbFile && (!FILE_IDS[FILES.FINANCE]);

        if (needsMigration) {
            await performMigration(oldDbFile.id);
        } else {
            await loadAllFiles();
        }

        // 3. Executar Backup Automático Diário
        await performDailyBackup();

        return true;
    } catch (e) {
        console.error("🔥 ERRO CRÍTICO DB:", e);
        if (notifyUser) notifyUser('error', 'Falha crítica ao carregar base de dados. Verifique a consola.');
        throw e;
    }
};

const performMigration = async (oldFileId: string) => {
    if (notifyUser) notifyUser('info', 'A otimizar base de dados (Migração v2)...');
    console.log("📦 [MIGRATION] A dividir base de dados antiga...");
    
    // Ler DB antiga
    const oldContent = await driveService.readFile(oldFileId);
    
    // Distribuir dados
    const configData = {
        settings: oldContent.settings || DEFAULT_SETTINGS,
        users: oldContent.users || [],
        categories: oldContent.categories || DEFAULT_ACCOUNTS,
        templates: oldContent.templates || [],
        devNotes: oldContent.devNotes || []
    };
    
    const crmData = {
        clients: oldContent.clients || [],
        employees: oldContent.employees || []
    };
    
    const financeData = {
        transactions: oldContent.transactions || [],
        bankTransactions: oldContent.bankTransactions || [],
        invoices: oldContent.invoices || [],
        purchases: oldContent.purchases || [],
        recurringPurchases: oldContent.recurringPurchases || [],
        recurringContracts: oldContent.recurringContracts || []
    };
    
    const opsData = {
        proposals: oldContent.proposals || [],
        materials: oldContent.materials || [],
        stockMovements: oldContent.stockMovements || [],
        appointments: oldContent.appointments || [],
        documents: oldContent.documents || []
    };

    // Criar novos ficheiros
    if (DRIVE_FOLDER_ID) {
        const f1 = await driveService.createFile(DRIVE_FOLDER_ID, configData, FILES.CONFIG);
        const f2 = await driveService.createFile(DRIVE_FOLDER_ID, crmData, FILES.CRM);
        const f3 = await driveService.createFile(DRIVE_FOLDER_ID, financeData, FILES.FINANCE);
        const f4 = await driveService.createFile(DRIVE_FOLDER_ID, opsData, FILES.OPERATIONS);
        
        FILE_IDS[FILES.CONFIG] = f1.id;
        FILE_IDS[FILES.CRM] = f2.id;
        FILE_IDS[FILES.FINANCE] = f3.id;
        FILE_IDS[FILES.OPERATIONS] = f4.id;

        // Renomear antigo para backup
        await driveService.renameFile(oldFileId, `database_backup_migrated_${Date.now()}.json`);
        
        // Atualizar memória global
        GLOBAL_DB = { ...GLOBAL_DB, ...oldContent };
        console.log("✅ [MIGRATION] Sucesso!");
        if (notifyUser) notifyUser('success', 'Base de dados otimizada com sucesso.');
    }
};

const loadAllFiles = async () => {
    const promises = [];
    
    // Carregar ficheiros que existem
    if (FILE_IDS[FILES.CONFIG]) promises.push(driveService.readFile(FILE_IDS[FILES.CONFIG]!).then(d => Object.assign(GLOBAL_DB, d)));
    else createEmptyFile(FILES.CONFIG, { settings: DEFAULT_SETTINGS, categories: DEFAULT_ACCOUNTS });

    if (FILE_IDS[FILES.CRM]) promises.push(driveService.readFile(FILE_IDS[FILES.CRM]!).then(d => Object.assign(GLOBAL_DB, d)));
    else createEmptyFile(FILES.CRM, { clients: [], employees: [] });

    if (FILE_IDS[FILES.FINANCE]) promises.push(driveService.readFile(FILE_IDS[FILES.FINANCE]!).then(d => Object.assign(GLOBAL_DB, d)));
    else createEmptyFile(FILES.FINANCE, { transactions: [], invoices: [], purchases: [] });

    if (FILE_IDS[FILES.OPERATIONS]) promises.push(driveService.readFile(FILE_IDS[FILES.OPERATIONS]!).then(d => Object.assign(GLOBAL_DB, d)));
    else createEmptyFile(FILES.OPERATIONS, { proposals: [], materials: [], appointments: [] });

    await Promise.all(promises);
    console.log("✅ [DB] Todos os módulos carregados.");
};

const createEmptyFile = async (fileName: string, initialContent: any) => {
    if (DRIVE_FOLDER_ID) {
        const f = await driveService.createFile(DRIVE_FOLDER_ID, initialContent, fileName);
        FILE_IDS[fileName] = f.id;
        Object.assign(GLOBAL_DB, initialContent);
    }
};

const performDailyBackup = async () => {
    if (!DRIVE_FOLDER_ID) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Encontrar ou criar pasta de backups
    let backupFolder = await driveService.findFolder('Backups', DRIVE_FOLDER_ID);
    if (!backupFolder) {
        backupFolder = await driveService.createFolder('Backups', DRIVE_FOLDER_ID);
    }

    // 2. Verificar se já existe backup de hoje
    const existing = await driveService.findFile(backupFolder.id, `${FILES.FINANCE}_${today}`); // Check one file as proxy
    
    if (!existing) {
        console.log("💾 [BACKUP] A criar backup diário...");
        if (notifyUser) notifyUser('info', 'A criar backup de segurança diário...');
        
        // Copiar todos os ficheiros ativos
        const promises = Object.entries(FILE_IDS).map(async ([name, id]) => {
            if (id) {
                await driveService.copyFile(id, backupFolder.id, `${name}_${today}`);
            }
        });
        
        await Promise.all(promises);
        console.log("✅ [BACKUP] Backup diário concluído.");
        if (notifyUser) notifyUser('success', 'Backup de segurança criado.');
    }
};

// --- SAVING LOGIC ---

// Debounce save per file
let saveTimeouts: Record<string, any> = {};

const notifySync = () => {
    if (syncStatusListener) {
        if (hasSyncError) syncStatusListener('error');
        else syncStatusListener(pendingSaves.size > 0 ? 'saving' : 'saved');
    }
};

const scheduleSave = (dbKey: string) => {
    const fileName = KEY_TO_FILE_MAP[dbKey];
    if (!fileName) return;

    pendingSaves.add(fileName);
    hasSyncError = false; // Reset error on new attempt
    notifySync();

    if (saveTimeouts[fileName]) clearTimeout(saveTimeouts[fileName]);
    
    saveTimeouts[fileName] = setTimeout(() => {
        performSave(fileName);
    }, 2000); // 2 seconds debounce
};

const performSave = async (fileName: string) => {
    if (!FILE_IDS[fileName] || isSyncing) return;
    
    console.log(`💾 [DB] A gravar ${fileName}...`);
    
    // Construir payload apenas com as chaves que pertencem a este ficheiro
    const payload: any = {};
    Object.keys(KEY_TO_FILE_MAP).forEach(key => {
        if (KEY_TO_FILE_MAP[key] === fileName) {
            // @ts-ignore
            payload[key] = GLOBAL_DB[key];
        }
    });
    
    // Adicionar timestamp de sync
    payload.lastSync = Date.now();

    try {
        await driveService.updateFile(FILE_IDS[fileName]!, payload);
        console.log(`✅ [DB] ${fileName} guardado.`);
        pendingSaves.delete(fileName);
        hasSyncError = false;
        notifySync();
    } catch (e) {
        console.error(`❌ [DB] Erro ao gravar ${fileName}`, e);
        if (notifyUser) notifyUser('error', `Erro ao gravar dados (${fileName}). Verifique a net.`);
        hasSyncError = true;
        notifySync();
    }
};

// --- EXPORT ---

export const db = {
    setNotifier: (fn: (type: 'success' | 'error' | 'info', message: string) => void) => { notifyUser = fn; },
    onSyncChange: (cb: (status: 'saved' | 'saving' | 'error') => void) => { syncStatusListener = cb; },
    init: initDatabase,
    forceSync: async () => { 
        await loadAllFiles(); // Force reload from cloud
        return true; 
    },
    
    // Config
    settings: { get: async () => GLOBAL_DB.settings, save: async (s: SystemSettings) => { GLOBAL_DB.settings = s; scheduleSave('settings'); }, reset: async () => { GLOBAL_DB.settings = DEFAULT_SETTINGS; scheduleSave('settings'); } },
    users: { getAll: async () => GLOBAL_DB.users || [], save: (data: User[]) => { GLOBAL_DB.users = updateCollectionWithTimestamp(GLOBAL_DB.users, data); scheduleSave('users'); }, create: async (u: any) => { const newUser = {...u, id: Date.now().toString(), updatedAt: new Date().toISOString()}; GLOBAL_DB.users = [...(GLOBAL_DB.users || []), newUser]; scheduleSave('users'); return {success: true, error: undefined}; }, update: async (u: User) => { const updatedUser = { ...u, updatedAt: new Date().toISOString() }; GLOBAL_DB.users = (GLOBAL_DB.users || []).map(x => x.id === u.id ? updatedUser : x); scheduleSave('users'); return {success: true, error: undefined}; }, delete: async (id: string) => { GLOBAL_DB.users = (GLOBAL_DB.users || []).filter(x => x.id !== id); scheduleSave('users'); }, getSession: () => null, setSession: () => {} },
    categories: { getAll: async () => GLOBAL_DB.categories || [], save: async (data: Account[]) => { GLOBAL_DB.categories = updateCollectionWithTimestamp(GLOBAL_DB.categories, data); scheduleSave('categories'); } },
    templates: { getAll: () => GLOBAL_DB.templates || [], save: (data: DocumentTemplate[]) => { GLOBAL_DB.templates = updateCollectionWithTimestamp(GLOBAL_DB.templates, data); scheduleSave('templates'); } },
    devNotes: { getAll: async () => GLOBAL_DB.devNotes || [], save: async (data: DevNote[]) => { GLOBAL_DB.devNotes = updateCollectionWithTimestamp(GLOBAL_DB.devNotes, data); scheduleSave('devNotes'); } },

    // CRM
    clients: { getAll: async () => GLOBAL_DB.clients || [], save: async (data: Client[]) => { GLOBAL_DB.clients = updateCollectionWithTimestamp(GLOBAL_DB.clients, data); scheduleSave('clients'); } },
    employees: { getAll: async () => GLOBAL_DB.employees || [], save: async (data: Employee[]) => { GLOBAL_DB.employees = updateCollectionWithTimestamp(GLOBAL_DB.employees, data); scheduleSave('employees'); } },

    // Finance
    transactions: { getAll: async () => GLOBAL_DB.transactions || [], save: async (data: Transaction[]) => { GLOBAL_DB.transactions = updateCollectionWithTimestamp(GLOBAL_DB.transactions, data); scheduleSave('transactions'); } },
    bankTransactions: { getAll: async () => GLOBAL_DB.bankTransactions || [], save: async (data: BankTransaction[]) => { GLOBAL_DB.bankTransactions = updateCollectionWithTimestamp(GLOBAL_DB.bankTransactions, data); scheduleSave('bankTransactions'); } },
    invoices: { 
        getAll: async () => GLOBAL_DB.invoices || [], 
        save: async (data: Invoice[]) => { 
            // Security Logic maintained from previous version
            const currentInvoices = GLOBAL_DB.invoices; 
            const protectedStatuses = ['Emitida', 'Paga', 'Anulada']; 
            for (const newInv of data) { 
                const existing = currentInvoices.find(i => i.id === newInv.id); 
                if (existing && protectedStatuses.includes(existing.status)) { 
                    const isContentChanged = JSON.stringify(existing.items) !== JSON.stringify(newInv.items) || existing.total !== newInv.total || existing.clientNif !== newInv.clientNif; 
                    if (isContentChanged) { 
                        console.error(`[DB Security] Tentativa de alterar doc emitido: ${existing.id}`); 
                        if (notifyUser) notifyUser('error', `Bloqueado: Doc ${existing.id} é imutável.`); 
                        const index = data.findIndex(i => i.id === newInv.id); 
                        if (index !== -1) data[index] = existing; 
                    } 
                } 
            } 
            GLOBAL_DB.invoices = updateCollectionWithTimestamp(GLOBAL_DB.invoices, data); 
            scheduleSave('invoices'); 
        }, 
        getNextNumber: (series: string) => { return (GLOBAL_DB.invoices.filter(i => i.series === series).length) + 1; } 
    },
    purchases: {
        getAll: async () => GLOBAL_DB.purchases || [],
        save: async (data: Purchase[]) => { GLOBAL_DB.purchases = updateCollectionWithTimestamp(GLOBAL_DB.purchases, data); scheduleSave('purchases'); },
        getNextId: (year: number) => { const count = GLOBAL_DB.purchases.filter(p => p.id.includes(`COMP-${year}`)).length; return `COMP-${year}/${(count + 1).toString().padStart(3, '0')}`; }
    },
    recurringPurchases: { getAll: () => GLOBAL_DB.recurringPurchases || [], save: (data: RecurringPurchase[]) => { GLOBAL_DB.recurringPurchases = updateCollectionWithTimestamp(GLOBAL_DB.recurringPurchases, data); scheduleSave('recurringPurchases'); } },
    recurringContracts: { getAll: () => GLOBAL_DB.recurringContracts || [], save: (data: RecurringContract[]) => { GLOBAL_DB.recurringContracts = updateCollectionWithTimestamp(GLOBAL_DB.recurringContracts, data); scheduleSave('recurringContracts'); } },

    // Operations
    proposals: { getAll: async () => GLOBAL_DB.proposals || [], save: async (data: Proposal[]) => { GLOBAL_DB.proposals = updateCollectionWithTimestamp(GLOBAL_DB.proposals, data); scheduleSave('proposals'); }, getNextId: (existing: Proposal[]) => { const year = new Date().getFullYear(); const seq = existing.length + 1; return { id: `PROP-${year}/${seq.toString().padStart(3, '0')}`, sequence: seq }; } },
    materials: { getAll: async () => GLOBAL_DB.materials || [], save: async (data: Material[]) => { GLOBAL_DB.materials = updateCollectionWithTimestamp(GLOBAL_DB.materials, data); scheduleSave('materials'); }, getNextCode: (type: 'Material' | 'Serviço') => { const prefix = type === 'Material' ? 'M' : 'S'; const all = GLOBAL_DB.materials || []; const relevant = all.filter(m => m.internalCode && m.internalCode.startsWith(prefix)); const numbers = relevant.map(m => { const numPart = m.internalCode.substring(1); return parseInt(numPart) || 0; }); const max = numbers.length > 0 ? Math.max(...numbers) : 0; return `${prefix}${(max + 1).toString().padStart(6, '0')}`; } },
    stockMovements: { getAll: async () => GLOBAL_DB.stockMovements || [], save: async (data: StockMovement[]) => { GLOBAL_DB.stockMovements = updateCollectionWithTimestamp(GLOBAL_DB.stockMovements, data); scheduleSave('stockMovements'); } },
    appointments: { getAll: async () => GLOBAL_DB.appointments || [], save: async (data: Appointment[]) => { GLOBAL_DB.appointments = updateCollectionWithTimestamp(GLOBAL_DB.appointments, data); scheduleSave('appointments'); }, getNextCode: (existing: Appointment[]) => { const year = new Date().getFullYear(); const seq = existing.filter(a => a.code?.startsWith(`AG-${year}`)).length + 1; return `AG-${year}/${seq.toString().padStart(3, '0')}`; } },
    documents: { getAll: () => GLOBAL_DB.documents || [], save: (data: GeneratedDocument[]) => { GLOBAL_DB.documents = updateCollectionWithTimestamp(GLOBAL_DB.documents, data); scheduleSave('documents'); } },

    // Utils
    cache: { get: (k: string, fb: any) => fb },
    filters: { 
        // Dashboard Filters
        getDashboard: () => JSON.parse(localStorage.getItem('f_dash') || '{}') || { month: 0, year: new Date().getFullYear() }, 
        saveDashboard: (v: any) => localStorage.setItem('f_dash', JSON.stringify(v)), 
        
        // Registry/Financial Filters
        getRegistry: () => JSON.parse(localStorage.getItem('f_reg') || '{}') || { month: 0 }, 
        saveRegistry: (v: any) => localStorage.setItem('f_reg', JSON.stringify(v)), 
        
        // Agenda Filters
        getAgenda: () => JSON.parse(localStorage.getItem('f_agd') || '{}') || { status: 'Todos' }, 
        saveAgenda: (v: any) => localStorage.setItem('f_agd', JSON.stringify(v)), 
        
        // Invoicing Filters (NEW)
        getInvoicing: () => JSON.parse(localStorage.getItem('f_inv') || '{}') || { month: new Date().getMonth() + 1, year: new Date().getFullYear(), status: 'Todos' },
        saveInvoicing: (v: any) => localStorage.setItem('f_inv', JSON.stringify(v)),

        // Purchasing Filters (NEW)
        getPurchasing: () => JSON.parse(localStorage.getItem('f_pur') || '{}') || { month: new Date().getMonth() + 1, year: new Date().getFullYear(), status: 'Todos' },
        savePurchasing: (v: any) => localStorage.setItem('f_pur', JSON.stringify(v)),

        // Reconciliation Filters (Persistência)
        getReconciliation: () => JSON.parse(localStorage.getItem('f_rec') || '{}'),
        saveReconciliation: (v: any) => localStorage.setItem('f_rec', JSON.stringify(v)),

        // NOVO: FILTRO GLOBAL DE DATA
        getGlobalDate: () => {
            const saved = localStorage.getItem('global_date_filters');
            return saved ? JSON.parse(saved) : { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
        },
        saveGlobalDate: (v: { month: number, year: number }) => localStorage.setItem('global_date_filters', JSON.stringify(v)),
    },
    keys: { SETTINGS: 's', ACCOUNTS: 'a' }
};
