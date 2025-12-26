
import { Transaction, Client, Employee, Proposal, Appointment, Material, SystemSettings, BankTransaction, DocumentTemplate, GeneratedDocument, User, Invoice, Account, RecurringContract } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const KEYS = {
  TRANSACTIONS: 'gestos_db_transactions',
  BANK_TRANSACTIONS: 'gestos_db_bank_transactions',
  ACCOUNTS: 'gestos_db_accounts', 
  SETTINGS: 'gestos_db_settings_v2',
  CLIENTS: 'gestos_db_clients',
  EMPLOYEES: 'gestos_db_employees',
  PROPOSALS: 'gestos_db_proposals',
  MATERIALS: 'gestos_db_materials',
  APPOINTMENTS: 'gestos_db_appointments',
  TEMPLATES: 'gestos_db_templates',
  DOCUMENTS: 'gestos_db_documents',
  USERS: 'gestos_db_users',
  INVOICES: 'gestos_db_invoices',
  RECURRING_CONTRACTS: 'gestos_db_recurring_contracts', // NEW
  SESSION: 'gestos_active_session',
  FILTERS_FIN_DASHBOARD: 'gestos_filters_fin_dashboard',
  FILTERS_FIN_REGISTRY: 'gestos_filters_fin_registry',
  FILTERS_AGENDA: 'gestos_filters_agenda_list',
};

const DEFAULT_ACCOUNTS: Account[] = [
    { id: '1', code: '1.1', name: 'Serviços de Avença', type: 'Receita Operacional' },
    { id: '2', code: '1.2', name: 'Serviços Pontuais', type: 'Receita Operacional' },
    { id: '3', code: '1.3', name: 'Venda de Peças', type: 'Receita Operacional' },
    { id: '4', code: '2.1', name: 'Custo das Mercadorias (CMV)', type: 'Custo Direto' },
    { id: '5', code: '2.2', name: 'Custos de Importação', type: 'Custo Direto' },
    { id: '6', code: '2.3', name: 'Consumíveis de Obra', type: 'Custo Direto' },
    { id: '7', code: '2.4', name: 'Transportes Operacionais', type: 'Custo Direto' },
    { id: '8', code: '3.1', name: 'Salários e Remunerações', type: 'Custo Fixo' },
    { id: '9', code: '3.2', name: 'Encargos Sociais', type: 'Custo Fixo' },
    { id: '10', code: '3.3', name: 'Serviços Especializados', type: 'Custo Fixo' },
    { id: '11', code: '3.4', name: 'Comunicações e Tecnologia', type: 'Custo Fixo' },
    { id: '12', code: '3.5', name: 'Instalações (Rendas/Água/Luz)', type: 'Custo Fixo' },
    { id: '13', code: '3.6', name: 'Material de Escritório/Geral', type: 'Custo Fixo' },
    { id: '14', code: '4.1', name: 'Juros e Despesas Bancárias', type: 'Despesa Financeira' },
    { id: '15', code: '4.2', name: 'Multas e Coimas', type: 'Despesa Financeira' },
    { id: '16', code: '5.1', name: 'Entrada de Empréstimos', type: 'Movimento de Balanço' },
    { id: '17', code: '5.2', name: 'Amortização de Capital', type: 'Movimento de Balanço' },
    { id: '18', code: '5.3', name: 'Investimento em Ativos', type: 'Movimento de Balanço' },
    { id: '19', code: '5.4', name: 'Transferências Internas', type: 'Movimento de Balanço' },
];

const DEFAULT_SETTINGS: SystemSettings = {
    companyName: 'GestOs Solutions Lda',
    companyNif: '254123658',
    companyAddress: 'Av. Cidade de Lisboa, Praia',
    companyPhone: '2610000',
    companyEmail: 'geral@gestos.cv',
    currency: 'CVE',
    defaultTaxRate: 15,
    defaultRetentionRate: 0,
    monthlyTarget: 1500000,
    reconciliationDateMargin: 3,
    reconciliationValueMargin: 0.1,
    paymentMethods: ['Dinheiro', 'Cheque', 'Transferência', 'Vinti4'],
    defaultProposalValidityDays: 15,
    defaultProposalNotes: 'Pagamento: 50% na adjudicação, 50% na entrega. Orçamento válido por 15 dias.',
    dashboard: {
        visibleCards: ['financial', 'hr', 'system'],
        visibleQuickLinks: ['financeiro', 'clientes', 'propostas', 'agenda', 'faturacao']
    },
    serviceTypes: [
        { id: 1, name: 'Manutenção', color: '#3b82f6' },
        { id: 2, name: 'Instalação', color: '#10b981' },
        { id: 3, name: 'Reparação', color: '#ef4444' }
    ],
    calendarStartHour: 8,
    calendarEndHour: 19,
    calendarInterval: 30,
    proposalLayout: {
        primaryColor: '#15803d',
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
        issuerNif: '254123658',
        ledCode: '00001',
        repositoryCode: '2'
    },
    trainingMode: false
};

// Local Storage Wrappers
const storage = {
  get: <T>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return fallback;
      return JSON.parse(item);
    } catch (e) { return fallback; }
  },
  set: <T>(key: string, value: T): void => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
};

// Database Service Definition
export const db = {
  transactions: {
    getAll: () => storage.get<Transaction[]>(KEYS.TRANSACTIONS, []),
    save: (data: Transaction[]) => storage.set(KEYS.TRANSACTIONS, data),
    clear: () => storage.set(KEYS.TRANSACTIONS, []),
  },
  invoices: {
      getAll: () => storage.get<Invoice[]>(KEYS.INVOICES, []),
      save: (data: Invoice[]) => storage.set(KEYS.INVOICES, data),
      getNextNumber: (series: string) => {
          const invoices = db.invoices.getAll();
          const seriesInvoices = invoices.filter(i => i.id.includes(series));
          return seriesInvoices.length + 1;
      }
  },
  recurringContracts: { // NEW
      getAll: () => storage.get<RecurringContract[]>(KEYS.RECURRING_CONTRACTS, []),
      save: (data: RecurringContract[]) => storage.set(KEYS.RECURRING_CONTRACTS, data),
  },
  bankTransactions: {
      getAll: () => storage.get<BankTransaction[]>(KEYS.BANK_TRANSACTIONS, []),
      save: (data: BankTransaction[]) => storage.set(KEYS.BANK_TRANSACTIONS, data),
  },
  categories: {
    getAll: () => {
        const data = storage.get<any>(KEYS.ACCOUNTS, null);
        if (data && Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
            return data as Account[];
        }
        return DEFAULT_ACCOUNTS;
    },
    save: (data: Account[]) => storage.set(KEYS.ACCOUNTS, data),
  },
  settings: {
    get: () => storage.get<SystemSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS),
    save: (data: SystemSettings) => storage.set(KEYS.SETTINGS, data),
    reset: () => storage.set(KEYS.SETTINGS, DEFAULT_SETTINGS)
  },
  clients: {
    getAll: () => storage.get<Client[]>(KEYS.CLIENTS, []),
    save: (data: Client[]) => storage.set(KEYS.CLIENTS, data),
    clear: () => storage.set(KEYS.CLIENTS, []),
  },
  employees: {
      getAll: () => storage.get<Employee[]>(KEYS.EMPLOYEES, []),
      save: (data: Employee[]) => storage.set(KEYS.EMPLOYEES, data),
      clear: () => storage.set(KEYS.EMPLOYEES, []),
  },
  materials: {
      getAll: () => storage.get<Material[]>(KEYS.MATERIALS, []),
      save: (data: Material[]) => storage.set(KEYS.MATERIALS, data),
      clear: () => storage.set(KEYS.MATERIALS, []),
  },
  proposals: {
      getAll: () => storage.get<Proposal[]>(KEYS.PROPOSALS, []),
      save: (data: Proposal[]) => storage.set(KEYS.PROPOSALS, data),
      clear: () => storage.set(KEYS.PROPOSALS, []),
      getNextId: (existing: Proposal[]) => {
          const year = new Date().getFullYear();
          const seq = existing.length + 1;
          return { id: `PROP-${year}/${seq.toString().padStart(3, '0')}`, sequence: seq };
      }
  },
  appointments: {
      getAll: () => storage.get<Appointment[]>(KEYS.APPOINTMENTS, []),
      save: (data: Appointment[]) => storage.set(KEYS.APPOINTMENTS, data),
      clear: () => storage.set(KEYS.APPOINTMENTS, []),
      getNextCode: (existing: Appointment[]) => {
          const year = new Date().getFullYear();
          const seq = existing.filter(a => a.code?.startsWith(`AG-${year}`)).length + 1;
          return `AG-${year}/${seq.toString().padStart(3, '0')}`;
      }
  },
  templates: {
      getAll: () => storage.get<DocumentTemplate[]>(KEYS.TEMPLATES, []),
      save: (data: DocumentTemplate[]) => storage.set(KEYS.TEMPLATES, data),
      clear: () => storage.set(KEYS.TEMPLATES, []),
  },
  documents: {
      getAll: () => storage.get<GeneratedDocument[]>(KEYS.DOCUMENTS, []),
      save: (data: GeneratedDocument[]) => storage.set(KEYS.DOCUMENTS, data),
      clear: () => storage.set(KEYS.DOCUMENTS, []),
  },
  users: {
      getAll: () => storage.get<User[]>(KEYS.USERS, []),
      save: (data: User[]) => storage.set(KEYS.USERS, data),
      getSession: () => storage.get<User | null>(KEYS.SESSION, null),
      setSession: (user: User | null) => storage.set(KEYS.SESSION, user)
  },
  filters: {
    getDashboard: () => storage.get(KEYS.FILTERS_FIN_DASHBOARD, { month: new Date().getMonth() + 1, year: new Date().getFullYear() }),
    saveDashboard: (filters: any) => storage.set(KEYS.FILTERS_FIN_DASHBOARD, filters),
    getRegistry: () => storage.get(KEYS.FILTERS_FIN_REGISTRY, { month: 0, year: new Date().getFullYear(), category: 'Todas', status: 'Todos' }),
    saveRegistry: (filters: any) => storage.set(KEYS.FILTERS_FIN_REGISTRY, filters),
    getAgenda: () => storage.get(KEYS.FILTERS_AGENDA, { month: 0, year: new Date().getFullYear(), service: 'Todos', status: 'Todos' }),
    saveAgenda: (filters: any) => storage.set(KEYS.FILTERS_AGENDA, filters),
  },
  
  // Cloud Sync Logic
  cloud: {
      pull: async () => {
          if (!isSupabaseConfigured()) return false;
          try {
              // Transactions
              const { data: txs } = await supabase.from('transactions').select('*');
              if (txs) {
                  const sanitizedTxs = txs.map(t => ({
                      ...t.data,
                      income: t.data.income ? Number(t.data.income) : null,
                      expense: t.data.expense ? Number(t.data.expense) : null
                  }));
                  storage.set(KEYS.TRANSACTIONS, sanitizedTxs);
              }

              // Chart of Accounts
              const { data: accs } = await supabase.from('chart_of_accounts').select('*');
              if (accs && accs.length > 0) {
                  storage.set(KEYS.ACCOUNTS, accs.map(a => a.data));
              }

              // Bank Transactions
              const { data: bkTxs } = await supabase.from('bank_transactions').select('*');
              if (bkTxs) {
                  storage.set(KEYS.BANK_TRANSACTIONS, bkTxs.map(b => b.data));
              }

              // Clients
              const { data: cls } = await supabase.from('clients').select('*');
              if (cls) storage.set(KEYS.CLIENTS, cls.map(c => c.data));

              // Invoices
              const { data: invs } = await supabase.from('invoices').select('*');
              if (invs) storage.set(KEYS.INVOICES, invs.map(i => i.data));

              // Recurring Contracts
              const { data: recur } = await supabase.from('recurring_contracts').select('*');
              if (recur) storage.set(KEYS.RECURRING_CONTRACTS, recur.map(r => r.data));

              // Employees
              const { data: emps } = await supabase.from('employees').select('*');
              if (emps) storage.set(KEYS.EMPLOYEES, emps.map(e => e.data));

              // Appointments
              const { data: apps } = await supabase.from('appointments').select('*');
              if (apps) storage.set(KEYS.APPOINTMENTS, apps.map(a => a.data));

              // Proposals
              const { data: props } = await supabase.from('proposals').select('*');
              if (props) storage.set(KEYS.PROPOSALS, props.map(p => p.data));

              // Materials
              const { data: mats } = await supabase.from('materials').select('*');
              if (mats) storage.set(KEYS.MATERIALS, mats.map(m => m.data));

              // Users
              const { data: users } = await supabase.from('app_users').select('*');
              if (users) storage.set(KEYS.USERS, users.map(u => u.data));

              // Settings
              const { data: settings } = await supabase.from('system_settings').select('*').limit(1);
              if (settings && settings[0]) storage.set(KEYS.SETTINGS, settings[0].data);

              return true;
          } catch (e) {
              console.error("Supabase Pull Error:", e);
              return false;
          }
      },
      push: async (entity: string, data: any[]) => {
          if (!isSupabaseConfigured()) return;
          // BLOCK PUSH IF TRAINING MODE IS ON
          if (db.settings.get().trainingMode) {
              console.debug("Training Mode active: Cloud Push blocked.");
              return;
          }
          
          try {
              const tableMap: Record<string, string> = {
                  [KEYS.TRANSACTIONS]: 'transactions',
                  [KEYS.CLIENTS]: 'clients',
                  [KEYS.INVOICES]: 'invoices',
                  [KEYS.RECURRING_CONTRACTS]: 'recurring_contracts',
                  [KEYS.EMPLOYEES]: 'employees',
                  [KEYS.APPOINTMENTS]: 'appointments',
                  [KEYS.PROPOSALS]: 'proposals',
                  [KEYS.MATERIALS]: 'materials',
                  [KEYS.USERS]: 'app_users',
                  [KEYS.BANK_TRANSACTIONS]: 'bank_transactions',
                  [KEYS.ACCOUNTS]: 'chart_of_accounts' 
              };

              const table = tableMap[entity];
              if (!table) return;

              // Helper para calcular total da proposta no backend
              const calcProposalTotal = (p: any) => {
                  if(!p.items) return 0;
                  const sub = (p.items || []).reduce((a:number, b:any) => a + b.total, 0);
                  const disc = sub * ((p.discount || 0) / 100);
                  const tax = (sub - disc) * ((p.taxRate || 15) / 100);
                  const ret = (sub - disc) * ((p.retention || 0) / 100);
                  return (sub - disc) + tax - ret;
              };

              // Upsert (Insert or Update) logic
              const rows = data.map(item => ({
                  id: item.id,
                  data: item,
                  // Map specific columns for SQL querying if defined in schema
                  ...(entity === KEYS.CLIENTS ? { name: item.name, company: item.company } : {}),
                  ...(entity === KEYS.INVOICES ? { client_name: item.clientName, total: item.total } : {}),
                  ...(entity === KEYS.PROPOSALS ? { client_name: item.clientName, total: calcProposalTotal(item), status: item.status } : {}),
                  ...(entity === KEYS.ACCOUNTS ? { code: item.code, name: item.name } : {}),
              }));

              const { error } = await supabase.from(table).upsert(rows);
              if (error) console.error(`Error pushing to ${table}:`, error);

          } catch (e) {
              console.error("Supabase Push Error:", e);
          }
      },
      pushSettings: async (settings: SystemSettings) => {
          if (!isSupabaseConfigured()) return;
          // BLOCK PUSH IF TRAINING MODE IS ON
          // Note: This prevents syncing the "Training Mode" status itself to the cloud if toggled on locally.
          // This matches the requirement to prevent database alterations.
          if (settings.trainingMode) {
              console.debug("Training Mode active: Settings Push blocked.");
              return;
          }
          await supabase.from('system_settings').upsert({ id: 1, data: settings });
      }
  },

  seed: () => {
    if (db.users.getAll().length === 0) {
        const initialUsers: User[] = [
            { id: '1', username: 'admin', name: 'Administrador', password: 'admin123', role: 'ADMIN', active: true },
            { id: '2', username: 'nelson', name: 'Nelson Semedo', password: 'tec123', role: 'TECNICO', active: true }
        ];
        db.users.save(initialUsers);
    }
  }
};
db.seed();
