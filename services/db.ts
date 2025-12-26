
import { Transaction, Client, Employee, Proposal, Appointment, Material, SystemSettings, BankTransaction, DocumentTemplate, GeneratedDocument, User, Invoice, Account, RecurringContract } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { createClient } from '@supabase/supabase-js';

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
  RECURRING_CONTRACTS: 'gestos_db_recurring_contracts',
  SESSION: 'gestos_active_session',
  FILTERS_FIN_DASHBOARD: 'gestos_filters_fin_dashboard',
  FILTERS_FIN_REGISTRY: 'gestos_filters_fin_registry',
  FILTERS_AGENDA: 'gestos_filters_agenda_list',
};

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

// Database Service Definition - AGORA HÍBRIDO (SUPABASE FIRST)
export const db = {
  // Transações: Supabase First
  transactions: {
    getAll: async (): Promise<Transaction[]> => {
        if (!isSupabaseConfigured()) return storage.get<Transaction[]>(KEYS.TRANSACTIONS, []);
        
        const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
        if (error) { console.error('Erro DB:', error); return []; }
        
        // Mapeamento DB -> App
        return data.map((t: any) => ({
            ...t,
            id: Number(t.id), // Garantir numero
            date: t.date,
            description: t.description,
            amount: Number(t.amount),
            income: t.income ? Number(t.income) : null,
            expense: t.expense ? Number(t.expense) : null,
            clientId: t.client_id ? Number(t.client_id) : undefined
        })) as Transaction[];
    },
    save: async (data: Transaction[]) => {
        storage.set(KEYS.TRANSACTIONS, data); // Backup Local
        // No Cloud Sync for bulk save yet
    },
    saveOne: async (t: Transaction) => {
        if (!isSupabaseConfigured()) return;
        const payload = {
            date: t.date,
            description: t.description,
            amount: (t.income || 0) + (t.expense || 0), // Valor absoluto ou liquido
            income: t.income,
            expense: t.expense,
            type: t.type,
            category: t.category,
            status: t.status,
            client_id: t.clientId,
            is_voided: t.isVoided
        };
        if (t.id && t.id > 1000000000) { // ID gerado por timestamp (local)
             await supabase.from('transactions').insert(payload);
        } else {
             await supabase.from('transactions').update(payload).eq('id', t.id);
        }
    }
  },

  // Clientes: Supabase First
  clients: {
    getAll: async (): Promise<Client[]> => {
        if (!isSupabaseConfigured()) return storage.get<Client[]>(KEYS.CLIENTS, []);
        
        const { data, error } = await supabase.from('clients').select('*').order('name');
        if (error) return [];
        return data.map((c: any) => ({
            ...c,
            id: Number(c.id),
            history: c.data?.history || [] // Recuperar histórico do JSONB
        })) as Client[];
    },
    save: (data: Client[]) => storage.set(KEYS.CLIENTS, data),
    saveOne: async (c: Client) => {
        if (!isSupabaseConfigured()) return;
        const payload = {
            type: c.type,
            name: c.name,
            company: c.company,
            nif: c.nif,
            email: c.email,
            phone: c.phone,
            address: c.address,
            notes: c.notes,
            data: { history: c.history } // Guardar histórico complexo no JSONB
        };
        // Se ID for timestamp (local), insert. Se for pequeno (serial), update.
        if (c.id > 1000000000) {
            await supabase.from('clients').insert(payload);
        } else {
            await supabase.from('clients').update(payload).eq('id', c.id);
        }
    }
  },

  // Utilizadores: Supabase Real
  users: {
      getAll: async (): Promise<User[]> => {
          if (!isSupabaseConfigured()) return storage.get<User[]>(KEYS.USERS, []);
          
          const { data, error } = await supabase.from('profiles').select('*');
          if (error) return [];
          
          return data.map((p: any) => ({
              id: p.id,
              username: p.email,
              email: p.email,
              name: p.full_name || p.email,
              role: p.role,
              active: p.active !== false
          })) as User[];
      },
      
      // Criação de utilizador REAL usando um cliente temporário para não deslogar o admin
      create: async (user: Partial<User>) => {
          if (!isSupabaseConfigured()) {
              const current = storage.get<User[]>(KEYS.USERS, []);
              const newUser = { ...user, id: Date.now().toString() } as User;
              storage.set(KEYS.USERS, [...current, newUser]);
              return { success: true };
          }

          if (!user.email || !user.password) return { success: false, error: 'Email e Password obrigatórios' };

          try {
              // 1. Criar cliente temporário sem persistência de sessão
              const tempClient = createClient(
                  process.env.VITE_SUPABASE_URL,
                  process.env.VITE_SUPABASE_ANON_KEY,
                  { auth: { persistSession: false } }
              );

              // 2. Registar utilizador na Auth
              const { data, error } = await tempClient.auth.signUp({
                  email: user.email,
                  password: user.password,
                  options: {
                      data: { name: user.name }
                  }
              });

              if (error) throw error;
              if (!data.user) throw new Error("Erro ao criar utilizador");

              // 3. Atualizar o perfil com o cargo correto (o trigger cria como TECNICO por defeito)
              // Pequeno delay para garantir que o trigger correu
              await new Promise(r => setTimeout(r, 1000));

              const { error: profileError } = await supabase
                  .from('profiles')
                  .update({ 
                      role: user.role || 'TECNICO',
                      full_name: user.name,
                      active: true
                  })
                  .eq('id', data.user.id);

              if (profileError) throw profileError;

              return { success: true };
          } catch (e: any) {
              console.error("Erro criação user:", e);
              return { success: false, error: e.message || 'Erro desconhecido' };
          }
      },

      update: async (user: User) => {
          if (!isSupabaseConfigured()) {
              const current = storage.get<User[]>(KEYS.USERS, []);
              const updated = current.map(u => u.id === user.id ? user : u);
              storage.set(KEYS.USERS, updated);
              return { success: true };
          }

          const { error } = await supabase
              .from('profiles')
              .update({
                  role: user.role,
                  full_name: user.name,
                  active: user.active
              })
              .eq('id', user.id);
          
          if (error) return { success: false, error: error.message };
          return { success: true };
      },

      delete: async (id: string) => {
          // Soft Delete (Desativar) pois não podemos apagar Auth ID do cliente
          if (!isSupabaseConfigured()) {
              const current = storage.get<User[]>(KEYS.USERS, []);
              storage.set(KEYS.USERS, current.filter(u => u.id !== id));
              return;
          }

          await supabase.from('profiles').update({ active: false }).eq('id', id);
      },

      // Fallback para storage antigo
      save: (data: User[]) => storage.set(KEYS.USERS, data),
      getSession: () => storage.get<User | null>(KEYS.SESSION, null),
      setSession: (user: User | null) => storage.set(KEYS.SESSION, user)
  },

  // Outros módulos (Mantidos em LocalStorage na Fase 1 para evitar refatoração massiva)
  invoices: {
      getAll: () => storage.get<Invoice[]>(KEYS.INVOICES, []),
      save: (data: Invoice[]) => storage.set(KEYS.INVOICES, data),
      getNextNumber: (series: string) => {
          const invoices = storage.get<Invoice[]>(KEYS.INVOICES, []);
          const seriesInvoices = invoices.filter(i => i.id.includes(series));
          return seriesInvoices.length + 1;
      }
  },
  recurringContracts: {
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
        return data || [
            { id: '1', code: '1.1', name: 'Serviços de Avença', type: 'Receita Operacional' },
            { id: '2', code: '1.2', name: 'Serviços Pontuais', type: 'Receita Operacional' },
            { id: '4', code: '2.1', name: 'Custo das Mercadorias (CMV)', type: 'Custo Direto' },
            { id: '8', code: '3.1', name: 'Salários e Remunerações', type: 'Custo Fixo' },
            { id: '12', code: '3.5', name: 'Instalações (Rendas/Água/Luz)', type: 'Custo Fixo' }
        ];
    },
    save: (data: Account[]) => storage.set(KEYS.ACCOUNTS, data),
  },
  settings: {
    get: () => storage.get<SystemSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS),
    save: (data: SystemSettings) => storage.set(KEYS.SETTINGS, data),
    reset: () => storage.set(KEYS.SETTINGS, DEFAULT_SETTINGS)
  },
  employees: {
      getAll: () => storage.get<Employee[]>(KEYS.EMPLOYEES, []),
      save: (data: Employee[]) => storage.set(KEYS.EMPLOYEES, data),
  },
  materials: {
      getAll: () => storage.get<Material[]>(KEYS.MATERIALS, []),
      save: (data: Material[]) => storage.set(KEYS.MATERIALS, data),
  },
  proposals: {
      getAll: () => storage.get<Proposal[]>(KEYS.PROPOSALS, []),
      save: (data: Proposal[]) => storage.set(KEYS.PROPOSALS, data),
      getNextId: (existing: Proposal[]) => {
          const year = new Date().getFullYear();
          const seq = existing.length + 1;
          return { id: `PROP-${year}/${seq.toString().padStart(3, '0')}`, sequence: seq };
      }
  },
  appointments: {
      getAll: () => storage.get<Appointment[]>(KEYS.APPOINTMENTS, []),
      save: (data: Appointment[]) => storage.set(KEYS.APPOINTMENTS, data),
      getNextCode: (existing: Appointment[]) => {
          const year = new Date().getFullYear();
          const seq = existing.filter(a => a.code?.startsWith(`AG-${year}`)).length + 1;
          return `AG-${year}/${seq.toString().padStart(3, '0')}`;
      }
  },
  templates: {
      getAll: () => storage.get<DocumentTemplate[]>(KEYS.TEMPLATES, []),
      save: (data: DocumentTemplate[]) => storage.set(KEYS.TEMPLATES, data),
  },
  documents: {
      getAll: () => storage.get<GeneratedDocument[]>(KEYS.DOCUMENTS, []),
      save: (data: GeneratedDocument[]) => storage.set(KEYS.DOCUMENTS, data),
  },
  filters: {
    getDashboard: () => storage.get(KEYS.FILTERS_FIN_DASHBOARD, { month: new Date().getMonth() + 1, year: new Date().getFullYear() }),
    saveDashboard: (filters: any) => storage.set(KEYS.FILTERS_FIN_DASHBOARD, filters),
    getRegistry: () => storage.get(KEYS.FILTERS_FIN_REGISTRY, { month: 0, year: new Date().getFullYear(), category: 'Todas', status: 'Todos' }),
    saveRegistry: (filters: any) => storage.set(KEYS.FILTERS_FIN_REGISTRY, filters),
    getAgenda: () => storage.get(KEYS.FILTERS_AGENDA, { month: 0, year: new Date().getFullYear(), service: 'Todos', status: 'Todos' }),
    saveAgenda: (filters: any) => storage.set(KEYS.FILTERS_AGENDA, filters),
  },
  
  // Legacy Cloud Sync (Mantido para módulos não migrados ainda)
  cloud: {
      pull: async () => { return true; },
      push: async (entity: string, data: any[]) => { return; },
      pushSettings: async (settings: SystemSettings) => {
          if (!isSupabaseConfigured() || settings.trainingMode) return;
          await supabase.from('system_settings').upsert({ id: 1, data: settings });
      }
  },

  seed: async () => {
    const users = await db.users.getAll();
    if (users.length === 0) { // Fallback local logic
        // ...
    }
  }
};
