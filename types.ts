
export type ViewState = 'dashboard' | 'financeiro' | 'relatorios' | 'rh' | 'clientes' | 'propostas' | 'agenda' | 'materiais' | 'configuracoes' | 'documentos' | 'faturacao';

export type UserRole = 'ADMIN' | 'GESTOR' | 'FINANCEIRO' | 'TECNICO';

export interface UserPermissions {
    allowedViews: ViewState[];
    canEditFinancial: boolean;
    canManageUsers: boolean;
}

export interface User extends BaseRecord {
    id: string;
    username: string;
    name: string;
    password?: string;
    role: UserRole;
    active: boolean;
}

export interface HistoryLog {
    timestamp: string;
    action: string;
    details: string;
    user?: string;
}

export interface BaseRecord {
    createdAt?: string;
    updatedAt?: string;
}

export interface DashboardConfig {
    visibleCards: string[];
    visibleQuickLinks: string[];
}

export interface ServiceType {
    id: number;
    name: string;
    color: string;
}

export interface ProposalLayoutConfig {
    primaryColor: string;
    secondaryColor: string;
    backgroundStyle: 'clean' | 'modern' | 'corporate';
    headerShape: 'square' | 'rounded' | 'accent';
    showClientNif: boolean;
    showClientAddress: boolean;
    showTerms: boolean;
    showSignature: boolean;
    showValidity: boolean;
    customTerms?: string;
}

export interface FiscalConfig {
    enabled: boolean;
    environment: 'sandbox' | 'production';
    apiKey: string;
    clientId: string;
    clientSecret: string;
    invoiceSeries: string;
    nextInvoiceNumber: number;
    issuerNif: string;
    ledCode: string; // Lógica de Emissão (LED) - 5 dígitos
    repositoryCode: '1' | '2' | '3'; // 1-Principal, 2-Homologação, 3-Teste
}

export interface SystemSettings {
    companyName: string;
    companyNif: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    companyLogoUrl?: string;

    currency: string;
    defaultTaxRate: number;
    defaultRetentionRate: number;
    monthlyTarget: number;

    reconciliationDateMargin: number;
    reconciliationValueMargin: number;
    
    paymentMethods: string[];

    defaultProposalValidityDays: number;
    defaultProposalNotes: string;

    dashboard?: DashboardConfig;
    serviceTypes: ServiceType[];

    calendarStartHour: number;
    calendarEndHour: number;
    calendarInterval: number;
    
    proposalLayout: ProposalLayoutConfig;
    fiscalConfig: FiscalConfig;
}

// --- NOVO PLANO DE CONTAS ---
export type AccountType = 'Receita Operacional' | 'Custo Direto' | 'Custo Fixo' | 'Despesa Financeira' | 'Movimento de Balanço';

export interface Account {
    id: string;     // UUID ou identificador único
    code: string;   // Ex: "1.1", "2.1"
    name: string;   // Ex: "Serviços de Avença"
    type: AccountType;
}
// ----------------------------

export interface BankTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    reconciled: boolean;
    systemMatchIds?: number[];
}

export interface Transaction extends BaseRecord {
  id: number;
  date: string;
  description: string;
  reference: string;
  type: 'Dinheiro' | 'Cheque' | 'Transferência' | 'Vinti4';
  category: string; // Mantemos string para compatibilidade, mas deve corresponder a Account.name
  income: number | null;
  expense: number | null;
  status: 'Pago' | 'Pendente';
  notes?: string;
  clientId?: number;
  clientName?: string;
  proposalId?: string;
  invoiceId?: string;
  isReconciled?: boolean;
  relatedTransactionId?: number;
  isVoided?: boolean; 
}

export interface Employee extends BaseRecord {
  id: number;
  name: string;
  role: string;
  department: string;
  status: 'Ativo' | 'Férias' | 'Inativo';
  email: string;
  nif?: string;
  admissionDate?: string;
}

export interface Material extends BaseRecord {
  id: number;
  name: string;
  unit: string;
  price: number;
  category: string;
  internalCode?: string;
}

// Mapeamento DNRE (Manual Técnico v10.0)
export type InvoiceType = 'FTE' | 'FRE' | 'TVE' | 'RCE' | 'NCE' | 'NDE' | 'DTE' | 'DVE' | 'NLE';
export type InvoiceStatus = 'Rascunho' | 'Emitida' | 'Anulada' | 'Paga'; // Added 'Paga'
export type FiscalStatus = 'Pendente' | 'Transmitido' | 'Erro';

export interface InvoiceItem {
    id: number;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
    itemCode?: string; // EmitterIdentification
}

export interface Invoice extends BaseRecord {
    id: string; // Ex: FT 2024/001
    internalId: number;
    type: InvoiceType;
    typeCode: string; 
    date: string;
    dueDate: string;
    clientId: number;
    clientName: string;
    clientNif: string;
    clientAddress: string;
    items: InvoiceItem[];
    subtotal: number;
    taxTotal: number;
    withholdingTotal: number; // WithholdingTaxTotalAmount
    total: number; // PayableAmount
    status: InvoiceStatus;
    fiscalStatus: FiscalStatus;
    iud: string; 
    fiscalHash?: string;
    fiscalQrCode?: string;
    notes?: string;
    originAppointmentId?: number; // Link to Appointment
    isRecurring?: boolean;
}

// --- RECURRING CONTRACTS (AVENÇAS) ---
export interface RecurringContract extends BaseRecord {
    id: string;
    clientId: number;
    clientName: string;
    description: string;
    amount: number;
    frequency: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';
    nextRun: string; // YYYY-MM-DD
    active: boolean;
    items: InvoiceItem[]; // Items to generate in invoice
}
// -------------------------------------

export interface ProposalItem {
  id: number;
  type: 'Material' | 'Mão de Obra' | 'Serviço';
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type ProposalStatus = 'Criada' | 'Aprovada' | 'Executada' | 'Rejeitada';
export type ProposalType = string; 

export interface Proposal extends BaseRecord {
  id: string;
  sequence: number;
  clientId: number;
  clientName: string;
  title: string;
  type: ProposalType;
  items: ProposalItem[];
  taxRate: number;
  discount: number;
  retention: number;
  status: ProposalStatus;
  date: string;
  validUntil?: string;
  notes?: string;
  logs: HistoryLog[];
  nif?: string;
  zone?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface ClientInteraction {
  id: number;
  date: string;
  type: 'Email' | 'Telefone' | 'Reunião' | 'Outro';
  notes: string;
}

export type ClientType = 'Doméstico' | 'Empresarial';

export interface Client extends BaseRecord {
  id: number;
  type: ClientType;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  nif?: string;
  notes?: string;
  history: ClientInteraction[];
}

export interface AppointmentItem {
    id: number;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface Appointment extends BaseRecord {
  id: number;
  code: string;
  client: string;
  clientId?: number;
  service: string;
  date: string;
  time: string;
  duration: number;
  technician: string;
  status: 'Agendado' | 'Em Andamento' | 'Concluído' | 'Cancelado';
  notes?: string;
  reportedAnomalies?: string;
  logs: HistoryLog[];
  items: AppointmentItem[];
  totalValue: number;
  proposalId?: string;
  generatedInvoiceId?: string; // Link to Invoice
}

export type DocumentCategory = 'Contrato de Trabalho' | 'Contrato de Serviço' | 'Certificado de Garantia' | 'Acordo de Confidencialidade' | 'Outro';

export interface DocumentTemplate extends BaseRecord {
    id: string;
    name: string;
    category: DocumentCategory;
    content: string; 
}

export interface GeneratedDocument extends BaseRecord {
    id: string;
    name: string;
    templateId: string;
    category: DocumentCategory;
    targetId: string | number; 
    targetName: string;
    date: string;
    content: string; 
    status: 'Emitido' | 'Assinado' | 'Arquivado';
}
