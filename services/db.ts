
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

// Local Storage Wrappers (Mantido apenas para Cache/Fallback)
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

// Database Service Definition - SUPABASE TOTAL
export const db = {
  // Helpers de Cache
  cache: storage,
  keys: KEYS,

  // Transações
  transactions: {
    getAll: async (limit = 1000): Promise<Transaction[]> => {
        if (!isSupabaseConfigured()) return storage.get<Transaction[]>(KEYS.TRANSACTIONS, []);
        const { data, error } = await supabase.from('transactions')
            .select('*')
            .order('date', { ascending: false })
            .limit(limit);
            
        if (error) { console.error('DB Error:', error); return []; }
        const mapped = data.map((t: any) => ({
            ...t,
            id: Number(t.id),
            amount: Number(t.amount),
            income: t.income ? Number(t.income) : null,
            expense: t.expense ? Number(t.expense) : null,
            clientId: t.client_id ? Number(t.client_id) : undefined,
            clientName: t.client_name 
        })) as Transaction[];
        // Cache update (optional for heavy data, good for offline)
        // storage.set(KEYS.TRANSACTIONS, mapped); 
        return mapped;
    },
    save: async (data: Transaction[]) => { /* Bulk save deprecated via API */ },
    saveOne: async (t: Transaction) => {
        if (!isSupabaseConfigured()) return;
        const payload = {
            date: t.date,
            description: t.description,
            amount: (t.income || 0) + (t.expense || 0),
            income: t.income,
            expense: t.expense,
            type: t.type,
            category: t.category,
            status: t.status,
            client_id: t.clientId,
            client_name: t.clientName,
            is_voided: t.isVoided,
            invoice_id: t.invoiceId
        };
        if (t.id > 1000000000) await supabase.from('transactions').insert(payload);
        else await supabase.from('transactions').update(payload).eq('id', t.id);
    }
  },

  // Clientes
  clients: {
    getAll: async (): Promise<Client[]> => {
        if (!isSupabaseConfigured()) return storage.get<Client[]>(KEYS.CLIENTS, []);
        const { data, error } = await supabase.from('clients').select('*').order('name');
        if (error) return [];
        const mapped = data.map((c: any) => ({
            ...c,
            id: Number(c.id),
            history: c.data?.history || [] 
        })) as Client[];
        storage.set(KEYS.CLIENTS, mapped); // Keep cache warm
        return mapped;
    },
    save: (data: Client[]) => {}, 
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
            active: c.active,
            data: { history: c.history }
        };
        if (c.id > 1000000000) await supabase.from('clients').insert(payload);
        else await supabase.from('clients').update(payload).eq('id', c.id);
    }
  },

  // Definições do Sistema
  settings: {
    get: async (): Promise<SystemSettings> => {
        if (!isSupabaseConfigured()) return storage.get<SystemSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
        const { data, error } = await supabase.from('system_settings').select('data').eq('id', 1).single();
        if (error || !data) return DEFAULT_SETTINGS;
        const merged = { ...DEFAULT_SETTINGS, ...data.data };
        storage.set(KEYS.SETTINGS, merged); // Important: Update cache
        return merged;
    },
    save: async (settings: SystemSettings) => {
        storage.set(KEYS.SETTINGS, settings); // Optimistic save
        if (!isSupabaseConfigured()) return;
        await supabase.from('system_settings').upsert({ id: 1, data: settings });
    },
    reset: async () => {
        storage.set(KEYS.SETTINGS, DEFAULT_SETTINGS);
        if (!isSupabaseConfigured()) return;
        await supabase.from('system_settings').upsert({ id: 1, data: DEFAULT_SETTINGS });
    }
  },

  // Recursos Humanos
  employees: {
      getAll: async (): Promise<Employee[]> => {
          if (!isSupabaseConfigured()) return storage.get<Employee[]>(KEYS.EMPLOYEES, []);
          const { data } = await supabase.from('employees').select('*');
          const mapped = (data || []).map((e: any) => ({ ...e, id: Number(e.id) }));
          storage.set(KEYS.EMPLOYEES, mapped);
          return mapped;
      },
      save: async (data: Employee[]) => {
          storage.set(KEYS.EMPLOYEES, data);
          if (!isSupabaseConfigured()) return;
          const payload = data.map(e => ({
              id: e.id > 1000000000 ? undefined : e.id,
              name: e.name,
              role: e.role,
              department: e.department,
              email: e.email,
              status: e.status,
              nif: e.nif,
              admission_date: e.admissionDate
          }));
          for(const p of payload) {
             if(p.id) await supabase.from('employees').upsert(p);
             else await supabase.from('employees').insert(p);
          }
      },
  },

  // Materiais
  materials: {
      getAll: async (): Promise<Material[]> => {
          if (!isSupabaseConfigured()) return storage.get<Material[]>(KEYS.MATERIALS, []);
          const { data } = await supabase.from('materials').select('*');
          const mapped = (data || []).map((m: any) => ({ 
              ...m, 
              id: Number(m.id),
              internalCode: m.internal_code || m.internalCode
          }));
          storage.set(KEYS.MATERIALS, mapped);
          return mapped;
      },
      save: async (data: Material[]) => {
          storage.set(KEYS.MATERIALS, data);
          if (!isSupabaseConfigured()) return;
          const payload = data.map(m => ({
              id: m.id > 1000000000 ? undefined : m.id,
              name: m.name,
              unit: m.unit,
              price: m.price,
              category: m.category,
              internal_code: m.internalCode
          }));
          for(const p of payload) {
             if(p.id) await supabase.from('materials').upsert(p);
             else await supabase.from('materials').insert(p);
          }
      },
  },

  // Propostas
  proposals: {
      getAll: async (): Promise<Proposal[]> => {
          if (!isSupabaseConfigured()) return storage.get<Proposal[]>(KEYS.PROPOSALS, []);
          const { data } = await supabase.from('proposals').select('*').order('date', {ascending: false}).limit(500);
          return (data || []).map((p: any) => ({
              ...p,
              clientName: p.client_name || p.data?.clientName,
              clientId: p.client_id || p.data?.clientId,
              items: p.data?.items || [],
              logs: p.data?.logs || [],
              ...p.data 
          }));
      },
      save: async (data: Proposal[]) => {
          storage.set(KEYS.PROPOSALS, data); // Backup cache
          if (!isSupabaseConfigured()) return;
          for(const p of data) {
              const payload = {
                  id: p.id,
                  client_id: p.clientId,
                  client_name: p.clientName,
                  status: p.status,
                  total: p.total,
                  date: p.date,
                  data: p
              };
              await supabase.from('proposals').upsert(payload);
          }
      },
      getNextId: (existing: Proposal[]) => {
          const year = new Date().getFullYear();
          const seq = existing.length + 1;
          return { id: `PROP-${year}/${seq.toString().padStart(3, '0')}`, sequence: seq };
      }
  },

  // Agendamentos
  appointments: {
      getAll: async (): Promise<Appointment[]> => {
          if (!isSupabaseConfigured()) return storage.get<Appointment[]>(KEYS.APPOINTMENTS, []);
          const { data } = await supabase.from('appointments').select('*').limit(500);
          return (data || []).map((a: any) => ({
              ...a,
              id: Number(a.id),
              items: a.data?.items || [],
              logs: a.data?.logs || [],
              ...a.data
          }));
      },
      save: async (data: Appointment[]) => {
          storage.set(KEYS.APPOINTMENTS, data);
          if (!isSupabaseConfigured()) return;
          for(const a of data) {
              const payload = {
                  id: a.id > 1000000000 ? undefined : a.id,
                  code: a.code,
                  client_id: a.clientId,
                  client: a.client, 
                  date: a.date,
                  status: a.status,
                  technician: a.technician,
                  data: a 
              };
              if (a.id > 1000000000) await supabase.from('appointments').insert(payload);
              else await supabase.from('appointments').upsert(payload);
          }
      },
      getNextCode: (existing: Appointment[]) => {
          const year = new Date().getFullYear();
          const seq = existing.filter(a => a.code?.startsWith(`AG-${year}`)).length + 1;
          return `AG-${year}/${seq.toString().padStart(3, '0')}`;
      }
  },

  // Faturas
  invoices: {
      getAll: async (): Promise<Invoice[]> => {
          if (!isSupabaseConfigured()) return storage.get<Invoice[]>(KEYS.INVOICES, []);
          const { data } = await supabase.from('invoices').select('*').order('date', {ascending: false}).limit(500);
          return (data || []).map((i: any) => ({
              ...i,
              items: i.data?.items || [],
              ...i.data
          }));
      },
      save: async (data: Invoice[]) => {
          storage.set(KEYS.INVOICES, data);
          if (!isSupabaseConfigured()) return;
          for(const i of data) {
              const payload = {
                  id: i.id,
                  date: i.date,
                  client_id: i.clientId,
                  client_name: i.clientName,
                  total: i.total,
                  status: i.status,
                  type: i.type,
                  iud: i.iud,
                  data: i
              };
              await supabase.from('invoices').upsert(payload);
          }
      },
      getNextNumber: (series: string) => {
          return 0; // Handled in component
      }
  },

  // Transações Bancárias
  bankTransactions: {
      getAll: async (): Promise<BankTransaction[]> => {
          if (!isSupabaseConfigured()) return storage.get<BankTransaction[]>(KEYS.BANK_TRANSACTIONS, []);
          const { data } = await supabase.from('bank_transactions').select('*').order('date', {ascending: false}).limit(500);
          return (data || []).map((b: any) => ({
              ...b,
              systemMatchIds: b.data?.systemMatchIds || []
          }));
      },
      save: async (data: BankTransaction[]) => {
          storage.set(KEYS.BANK_TRANSACTIONS, data);
          if (!isSupabaseConfigured()) return;
          for(const b of data) {
              await supabase.from('bank_transactions').upsert({
                  id: b.id,
                  date: b.date,
                  description: b.description,
                  amount: b.amount,
                  reconciled: b.reconciled,
                  data: { systemMatchIds: b.systemMatchIds }
              });
          }
      },
  },

  // Users (Already Migrated)
  users: {
      getAll: async (): Promise<User[]> => {
          if (!isSupabaseConfigured()) return storage.get<User[]>(KEYS.USERS, []);
          const { data, error } = await supabase.from('profiles').select('*');
          if (error) return [];
          const mapped = data.map((p: any) => ({
              id: p.id,
              username: p.email,
              email: p.email,
              name: p.full_name || p.email,
              role: p.role,
              active: p.active !== false
          })) as User[];
          storage.set(KEYS.USERS, mapped); // Cache Update
          return mapped;
      },
      create: async (user: Partial<User>) => {
          if (!isSupabaseConfigured()) return { success: false };
          if (!user.email || !user.password) return { success: false, error: 'Dados em falta' };
          
          try {
              const tempClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
              const { data, error } = await tempClient.auth.signUp({ email: user.email, password: user.password, options: { data: { name: user.name } } });
              if (error) throw error;
              if (data.user) {
                  await new Promise(r => setTimeout(r, 1000));
                  await supabase.from('profiles').update({ role: user.role, full_name: user.name, active: true }).eq('id', data.user.id);
                  return { success: true };
              }
          } catch (e: any) { return { success: false, error: e.message }; }
          return { success: false };
      },
      update: async (user: User) => {
          if (!isSupabaseConfigured()) return { success: false };
          const { error } = await supabase.from('profiles').update({ role: user.role, full_name: user.name, active: user.active }).eq('id', user.id);
          return { success: !error, error: error?.message };
      },
      delete: async (id: string) => {
          if (!isSupabaseConfigured()) return;
          await supabase.from('profiles').update({ active: false }).eq('id', id);
      },
      save: (data: User[]) => { storage.set(KEYS.USERS, data); }, // Allow explicit cache set
      getSession: () => storage.get<User | null>(KEYS.SESSION, null),
      setSession: (user: User | null) => storage.set(KEYS.SESSION, user)
  },

  // Auxiliares (Ainda Locais ou Híbridos)
  categories: {
    getAll: async () => {
        if (!isSupabaseConfigured()) return storage.get<any>(KEYS.ACCOUNTS, null) || [];
        const { data } = await supabase.from('chart_of_accounts').select('*');
        if (!data || data.length === 0) {
            const defaults = [
                { id: '1', code: '1.1', name: 'Serviços de Avença', type: 'Receita Operacional' },
                { id: '2', code: '1.2', name: 'Serviços Pontuais', type: 'Receita Operacional' },
                { id: '4', code: '2.1', name: 'Custo das Mercadorias (CMV)', type: 'Custo Direto' },
                { id: '8', code: '3.1', name: 'Salários e Remunerações', type: 'Custo Fixo' },
                { id: '12', code: '3.5', name: 'Instalações (Rendas/Água/Luz)', type: 'Custo Fixo' }
            ];
            return defaults;
        }
        storage.set(KEYS.ACCOUNTS, data); // Cache warm
        return data;
    },
    save: async (data: Account[]) => {
        storage.set(KEYS.ACCOUNTS, data);
        if (!isSupabaseConfigured()) return;
        for(const c of data) {
            await supabase.from('chart_of_accounts').upsert(c);
        }
    },
  },
  recurringContracts: {
      getAll: () => storage.get<RecurringContract[]>(KEYS.RECURRING_CONTRACTS, []), 
      save: (data: RecurringContract[]) => storage.set(KEYS.RECURRING_CONTRACTS, data),
  },
  templates: {
      getAll: () => storage.get<DocumentTemplate[]>(KEYS.TEMPLATES, []), 
      save: (data: DocumentTemplate[]) => storage.set(KEYS.TEMPLATES, data),
  },
  documents: {
      getAll: () => storage.get<GeneratedDocument[]>(KEYS.DOCUMENTS, []), 
      save: (data: GeneratedDocument[]) => storage.set(KEYS.DOCUMENTS, data),
  },
  
  // Filtros Locais
  filters: {
    getDashboard: () => storage.get(KEYS.FILTERS_FIN_DASHBOARD, { month: new Date().getMonth() + 1, year: new Date().getFullYear() }),
    saveDashboard: (filters: any) => storage.set(KEYS.FILTERS_FIN_DASHBOARD, filters),
    getRegistry: () => storage.get(KEYS.FILTERS_FIN_REGISTRY, { month: 0, year: new Date().getFullYear(), category: 'Todas', status: 'Todos' }),
    saveRegistry: (filters: any) => storage.set(KEYS.FILTERS_FIN_REGISTRY, filters),
    getAgenda: () => storage.get(KEYS.FILTERS_AGENDA, { month: 0, year: new Date().getFullYear(), service: 'Todos', status: 'Todos' }),
    saveAgenda: (filters: any) => storage.set(KEYS.FILTERS_AGENDA, filters),
  },
  
  cloud: {
      pull: async () => { return true; },
      push: async (entity: string, data: any[]) => { return; },
      pushSettings: async (settings: SystemSettings) => {
          if (!isSupabaseConfigured() || settings.trainingMode) return;
          await supabase.from('system_settings').upsert({ id: 1, data: settings });
      }
  },

  seed: async () => { /* ... */ }
};
