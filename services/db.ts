
import { Transaction, Client, Employee, Proposal, Appointment, Material, BaseRecord, SystemSettings, BankTransaction, DocumentTemplate, GeneratedDocument, User, Invoice } from '../types';

/*
HISTÓRICO DE VERSÕES:
- 1.5.0: Sistema de Autenticação e RBAC.
- 1.6.0: Implementação de Hitbox interna (margem de segurança) nos cards.
- 1.7.0: Agenda com altura adaptativa total (No-Scroll).
- 1.8.0: Personalização de layout de Propostas/Orçamentos.
- 1.9.0: Módulo de Faturação com integração e-fatura.cv.
- 1.9.1: Conformidade IUD 45 chars e Luhn DV (Manual DNRE v10.0).
*/

const KEYS = {
  TRANSACTIONS: 'gestos_db_transactions',
  BANK_TRANSACTIONS: 'gestos_db_bank_transactions',
  CATEGORIES: 'gestos_db_categories',
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
        repositoryCode: '2' // Homologação por defeito
    }
};

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
  bankTransactions: {
      getAll: () => storage.get<BankTransaction[]>(KEYS.BANK_TRANSACTIONS, []),
      save: (data: BankTransaction[]) => storage.set(KEYS.BANK_TRANSACTIONS, data),
  },
  categories: {
    getAll: () => storage.get<string[]>(KEYS.CATEGORIES, ['Serviços', 'Materiais', 'Rendas', 'Salários', 'Impostos']),
    save: (data: string[]) => storage.set(KEYS.CATEGORIES, data),
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
