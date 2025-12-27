
import { driveService } from './googleDriveService';
import { Transaction, Client, Employee, Proposal, Appointment, Material, SystemSettings, BankTransaction, DocumentTemplate, GeneratedDocument, User, Invoice, Account, RecurringContract } from '../types';

// O estado global da base de dados (In-Memory após carregar do Drive)
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
    lastSync: 0
};

// Configurações Padrão
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

// IDs do Drive (armazenados em memória durante a sessão)
let DRIVE_FOLDER_ID: string | null = null;
let DRIVE_FILE_ID: string | null = null;

// Debounce save (para não spammar o Google Drive a cada letra digitada)
let saveTimeout: any = null;

const saveToDrive = async () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
        if (DRIVE_FILE_ID) {
            console.log("A guardar no Google Drive...");
            GLOBAL_DB.lastSync = Date.now();
            try {
                await driveService.updateFile(DRIVE_FILE_ID, GLOBAL_DB);
                console.log("Guardado com sucesso.");
            } catch (e) {
                console.error("Erro ao guardar no Drive:", e);
            }
        }
    }, 2000); // Aguarda 2 segundos de inatividade antes de enviar
};

export const db = {
    // Inicialização (Chamada no Login)
    init: async () => {
        try {
            console.log("A conectar ao Google Drive...");
            let folder = await driveService.findFolder();
            if (!folder) {
                console.log("Pasta não encontrada. A criar...");
                folder = await driveService.createFolder();
            }
            DRIVE_FOLDER_ID = folder.id;

            let file = await driveService.findFile(DRIVE_FOLDER_ID!);
            if (!file) {
                console.log("Base de dados não encontrada. A criar nova...");
                // Inicializa com defaults
                GLOBAL_DB.settings = DEFAULT_SETTINGS;
                // Cria ficheiro
                const newFile = await driveService.createFile(DRIVE_FOLDER_ID!, GLOBAL_DB);
                DRIVE_FILE_ID = newFile.id;
            } else {
                console.log("A carregar dados...");
                DRIVE_FILE_ID = file.id;
                const content = await driveService.readFile(DRIVE_FILE_ID!);
                GLOBAL_DB = { ...GLOBAL_DB, ...content };
                // Garantir merge com defaults caso haja novos campos
                GLOBAL_DB.settings = { ...DEFAULT_SETTINGS, ...GLOBAL_DB.settings };
            }
            return true;
        } catch (e) {
            console.error("Falha Crítica DB:", e);
            return false;
        }
    },

    // Cache Helpers (para compatibilidade com componentes)
    cache: {
        get: (k: string, fb: any) => fb
    },
    keys: { SETTINGS: 's', ACCOUNTS: 'a' }, // Dummy keys

    // --- DATA ACCESS LAYERS ---
    
    settings: {
        get: async () => GLOBAL_DB.settings,
        save: async (s: SystemSettings) => { GLOBAL_DB.settings = s; saveToDrive(); },
        reset: async () => { GLOBAL_DB.settings = DEFAULT_SETTINGS; saveToDrive(); }
    },

    transactions: {
        getAll: async () => GLOBAL_DB.transactions || [],
        save: async (data: Transaction[]) => { GLOBAL_DB.transactions = data; saveToDrive(); },
        saveOne: async () => {} // Deprecated internal
    },

    clients: {
        getAll: async () => GLOBAL_DB.clients || [],
        save: async (data: Client[]) => { GLOBAL_DB.clients = data; saveToDrive(); },
        saveOne: async (c: Client) => {
            const list = GLOBAL_DB.clients || [];
            const idx = list.findIndex(x => x.id === c.id);
            if(idx >= 0) list[idx] = c; else list.push(c);
            GLOBAL_DB.clients = list;
            saveToDrive();
        }
    },

    employees: {
        getAll: async () => GLOBAL_DB.employees || [],
        save: async (data: Employee[]) => { GLOBAL_DB.employees = data; saveToDrive(); }
    },

    proposals: {
        getAll: async () => GLOBAL_DB.proposals || [],
        save: async (data: Proposal[]) => { GLOBAL_DB.proposals = data; saveToDrive(); },
        getNextId: (existing: Proposal[]) => {
            const year = new Date().getFullYear();
            const seq = existing.length + 1;
            return { id: `PROP-${year}/${seq.toString().padStart(3, '0')}`, sequence: seq };
        }
    },

    materials: {
        getAll: async () => GLOBAL_DB.materials || [],
        save: async (data: Material[]) => { GLOBAL_DB.materials = data; saveToDrive(); }
    },

    appointments: {
        getAll: async () => GLOBAL_DB.appointments || [],
        save: async (data: Appointment[]) => { GLOBAL_DB.appointments = data; saveToDrive(); },
        getNextCode: (existing: Appointment[]) => {
            const year = new Date().getFullYear();
            const seq = existing.filter(a => a.code?.startsWith(`AG-${year}`)).length + 1;
            return `AG-${year}/${seq.toString().padStart(3, '0')}`;
        }
    },

    invoices: {
        getAll: async () => GLOBAL_DB.invoices || [],
        save: async (data: Invoice[]) => { GLOBAL_DB.invoices = data; saveToDrive(); },
        getNextNumber: (series: string) => {
            // Conta quantas faturas existem com esta série no ano atual
            // Simplificado: usar o length ou um contador nas settings
            return (GLOBAL_DB.invoices.filter(i => i.series === series).length) + 1;
        }
    },

    bankTransactions: {
        getAll: async () => GLOBAL_DB.bankTransactions || [],
        save: async (data: BankTransaction[]) => { GLOBAL_DB.bankTransactions = data; saveToDrive(); }
    },

    categories: {
        getAll: async () => {
            if (!GLOBAL_DB.categories || GLOBAL_DB.categories.length === 0) {
                return [
                    { id: '1', code: '1.1', name: 'Serviços de Avença', type: 'Receita Operacional' },
                    { id: '2', code: '1.2', name: 'Serviços Pontuais', type: 'Receita Operacional' },
                    { id: '4', code: '2.1', name: 'Custo das Mercadorias (CMV)', type: 'Custo Direto' },
                    { id: '8', code: '3.1', name: 'Salários e Remunerações', type: 'Custo Fixo' },
                    { id: '12', code: '3.5', name: 'Instalações (Rendas/Água/Luz)', type: 'Custo Fixo' }
                ] as Account[];
            }
            return GLOBAL_DB.categories;
        },
        save: async (data: Account[]) => { GLOBAL_DB.categories = data; saveToDrive(); }
    },

    recurringContracts: {
        getAll: () => GLOBAL_DB.recurringContracts || [],
        save: (data: RecurringContract[]) => { GLOBAL_DB.recurringContracts = data; saveToDrive(); }
    },

    templates: {
        getAll: () => GLOBAL_DB.templates || [],
        save: (data: DocumentTemplate[]) => { GLOBAL_DB.templates = data; saveToDrive(); }
    },

    documents: {
        getAll: () => GLOBAL_DB.documents || [],
        save: (data: GeneratedDocument[]) => { GLOBAL_DB.documents = data; saveToDrive(); }
    },

    users: {
        getAll: async () => GLOBAL_DB.users || [],
        save: (data: User[]) => { GLOBAL_DB.users = data; saveToDrive(); },
        create: async (u: any) => { 
            GLOBAL_DB.users.push({...u, id: Date.now().toString()}); 
            saveToDrive(); 
            return {success: true, error: undefined as string | undefined}; 
        },
        update: async (u: User) => { 
            GLOBAL_DB.users = GLOBAL_DB.users.map(x => x.id === u.id ? u : x);
            saveToDrive();
            return {success: true, error: undefined as string | undefined}; 
        },
        delete: async (id: string) => {
            GLOBAL_DB.users = GLOBAL_DB.users.filter(x => x.id !== id);
            saveToDrive();
        },
        getSession: () => null,
        setSession: () => {}
    },

    // Filtros (Manter local storage apenas para UI preferences, não dados críticos)
    filters: {
        getDashboard: () => JSON.parse(localStorage.getItem('f_dash') || '{}') || { month: 0, year: new Date().getFullYear() },
        saveDashboard: (v: any) => localStorage.setItem('f_dash', JSON.stringify(v)),
        getRegistry: () => JSON.parse(localStorage.getItem('f_reg') || '{}') || { month: 0 },
        saveRegistry: (v: any) => localStorage.setItem('f_reg', JSON.stringify(v)),
        getAgenda: () => JSON.parse(localStorage.getItem('f_agd') || '{}') || { status: 'Todos' },
        saveAgenda: (v: any) => localStorage.setItem('f_agd', JSON.stringify(v)),
    },

    cloud: {
        pull: async () => true,
        push: async () => {},
        pushSettings: async () => {}
    }
};
