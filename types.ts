
export type ViewState = 'dashboard' | 'financeiro' | 'relatorios' | 'rh' | 'entidades' | 'propostas' | 'agenda' | 'materiais' | 'configuracoes' | 'documentos' | 'faturacao' | 'compras';

export type UserRole = 'ADMIN' | 'GESTOR' | 'FINANCEIRO' | 'TECNICO';

// ... (User, UserPermissions, HistoryLog, BaseRecord kept as is) ...
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
    email?: string;
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
    _deleted?: boolean; 
}

// ... (DashboardConfig, ServiceType kept as is) ...
export interface DashboardConfig {
    visibleCards: string[];
    visibleQuickLinks: string[];
}

export interface ServiceType {
    id: number;
    name: string;
    color: string;
}

// ... (Layout Configs kept as is) ...
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

export interface InvoiceLayoutConfig {
    showQrCode: boolean;
    showBankInfo: boolean;
    customFooterText: string;
    showSalesman: boolean;
    bankInfoText?: string;
}

export interface ServiceOrderLayoutConfig {
    showPrices: boolean;
    showTechnicianName: boolean;
    disclaimerText: string;
    showClientSignature: boolean;
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
    ledCode: string; 
    repositoryCode: '1' | '2' | '3'; 
    allowManualInvoiceDate?: boolean; 
}

export interface ProposalSettingsConfig {
    defaultValidityDays: number;
    defaultPaymentTerms: string;
    allowEditAfterSent: boolean;
    autoConvert: boolean;
    proposalSequence: number;
    activeTypes: string[];
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
    
    enableTreasuryHardDelete?: boolean; 
    allowNegativeStock?: boolean; 

    paymentMethods: string[];

    defaultProposalValidityDays: number;
    defaultProposalNotes: string;

    dashboard?: DashboardConfig;
    serviceTypes: ServiceType[];

    calendarStartHour: number;
    calendarEndHour: number;
    calendarInterval: number;
    
    proposalLayout: ProposalLayoutConfig;
    invoiceLayout?: InvoiceLayoutConfig;
    serviceOrderLayout?: ServiceOrderLayoutConfig;
    
    proposalConfig?: ProposalSettingsConfig;
    fiscalConfig: FiscalConfig;
    
    trainingMode?: boolean; 
}

export type AccountType = 'Receita Operacional' | 'Custo Direto' | 'Custo Fixo' | 'Despesa Financeira' | 'Movimento de Balanço';

export interface Account {
    id: string;     
    code: string;   
    name: string;   
    type: AccountType;
}

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
  category: string; 
  income: number | null;
  expense: number | null;
  status: 'Pago' | 'Pendente';
  notes?: string;
  clientId?: number;
  clientName?: string;
  proposalId?: string;
  invoiceId?: string;
  purchaseId?: string; // NEW: Link to Purchase
  isReconciled?: boolean;
  relatedTransactionId?: number;
  isVoided?: boolean; 
}

// ... (Employee kept as is) ...
export interface Employee extends BaseRecord {
  id: number;
  name: string;
  email: string;
  phone?: string;
  nif?: string;
  address?: string;
  birthDate?: string;
  idDocument?: {
      type: 'CNI' | 'Passaporte' | 'Residência';
      number: string;
      validUntil: string;
  };
  role: string;
  department: string;
  status: 'Ativo' | 'Férias' | 'Inativo' | 'Licença';
  admissionDate: string;
  monthlySalary?: number;
  hourlyRate?: number;
  bankInfo?: {
      bankName: string;
      iban: string;
      swift?: string;
  };
  contractType: 'Sem Termo' | 'Termo Certo' | 'Prestação Serviços' | 'Estágio';
  contractStart: string;
  contractEnd?: string;
  notes?: string;
}

export interface Material extends BaseRecord {
  id: number;
  name: string;
  unit: string;
  price: number;
  type: 'Material' | 'Serviço';
  internalCode: string;
  observations?: string;
  stock?: number;
  minStock?: number;
  avgCost?: number; 
}

export type StockMovementType = 'ENTRADA' | 'SAIDA' | 'AJUSTE';

export interface StockMovement extends BaseRecord {
    id: string;
    materialId: number;
    materialName: string;
    date: string;
    type: StockMovementType;
    quantity: number;
    reason: string;
    documentRef?: string;
    user?: string;
    stockAfter: number;
}

// --- CLIENTS / ENTITIES ---
export type EntityType = 'Cliente' | 'Fornecedor' | 'Ambos';
export type ClientType = 'Doméstico' | 'Empresarial'; // Legacy sub-type for Clients

export interface Client extends BaseRecord {
  id: number;
  entityType?: EntityType; // NEW: Discriminator
  type: ClientType; // Doméstico vs Empresarial (aplica-se a clientes)
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  nif?: string;
  notes?: string;
  history: ClientInteraction[];
  active?: boolean;
}

export interface ClientInteraction {
  id: number;
  date: string;
  type: 'Email' | 'Telefone' | 'Reunião' | 'Outro';
  notes: string;
}

// --- INVOICING (RECEIVABLES) ---
export type InvoiceType = 'FTE' | 'FRE' | 'TVE' | 'NCE' | 'RCE' | 'NDE' | 'DTE' | 'DVE' | 'NLE';
export type InvoiceStatus = 'Rascunho' | 'Emitida' | 'Anulada' | 'Paga' | 'Pendente Envio'; 
export type FiscalStatus = 'Não Comunicado' | 'Pendente' | 'Transmitido' | 'Erro';

export interface InvoiceItem {
    id: number | string; 
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
    itemCode?: string; 
}

export type DraftInvoice = Omit<
  Invoice,
  'id' | 'internalId' | 'iud' | 'series' | 'typeCode' | 'fiscalStatus' | 'fiscalHash' | 'fiscalQrCode'
> & {
  id?: string;
  internalId?: number;
  iud?: string;
  series?: string;
  typeCode?: string;
  fiscalStatus?: FiscalStatus;
};

export interface Invoice extends BaseRecord {
    id: string; 
    internalId: number;
    series: string; 
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
    withholdingTotal: number; 
    total: number; 
    status: InvoiceStatus;
    fiscalStatus: FiscalStatus;
    iud: string; 
    fiscalHash?: string;
    fiscalQrCode?: string;
    notes?: string;
    originAppointmentId?: number; 
    isRecurring?: boolean;
    relatedInvoiceId?: string; 
    relatedInvoiceIUD?: string; 
    reason?: string;
    paymentMethod?: string; // NEW: To track method for auto-paid invoices
}

// --- PURCHASING (PAYABLES) ---
export type PurchaseStatus = 'Rascunho' | 'Aberta' | 'Paga' | 'Anulada';

export interface Purchase extends BaseRecord {
    id: string; // Internal ID e.g. COMP-2024/001
    supplierId: number;
    supplierName: string;
    supplierNif?: string;
    date: string;
    dueDate: string;
    items: InvoiceItem[]; 
    subtotal: number;
    taxTotal: number;
    total: number;
    status: PurchaseStatus;
    notes?: string;
    referenceDocument?: string; // External Invoice Number from Supplier
    categoryId?: string; // Link to Chart of Accounts
}

export interface RecurringPurchase extends BaseRecord {
    id: string;
    supplierId: number;
    supplierName: string;
    description: string;
    amount: number;
    frequency: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';
    nextRun: string;
    active: boolean;
    categoryId?: string; // Account
    items: InvoiceItem[]; // Reuse structure
}

export interface RecurringContract extends BaseRecord {
    id: string;
    clientId: number;
    clientName: string;
    description: string;
    amount: number;
    frequency: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';
    nextRun: string; 
    active: boolean;
    items: InvoiceItem[]; 
}

// ... (Proposals, Appointments, Documents, DevNote kept as is) ...
export interface ProposalItem {
  id: number;
  type: 'Material' | 'Mão de Obra' | 'Serviço';
  description: string;
  quantity: number;
  unitPrice: number; 
  costPrice?: number; 
  total: number;
  taxRate?: number; 
}

export type ProposalStatus = 'Rascunho' | 'Enviada' | 'Aceite' | 'Rejeitada' | 'Expirada' | 'Convertida' | 'Criada' | 'Aprovada' | 'Executada';
export type ProposalOrigin = 'Manual' | 'Agenda' | 'PedidoWeb';

export interface Proposal extends BaseRecord {
  id: string;
  sequence: number;
  version: number;
  origin: ProposalOrigin;
  clientId: number;
  clientName: string;
  clientNif?: string; 
  clientAddress?: string; 
  clientEmail?: string; 
  title: string;
  items: ProposalItem[];
  subtotal: number; 
  taxTotal: number; 
  taxRate: number; 
  discount: number;
  retention: number;
  total: number; 
  currency: string; 
  status: ProposalStatus;
  sentAt?: string; 
  date: string;
  validUntil: string;
  executionTerm?: string; 
  paymentTerms?: string; 
  notes?: string; 
  technicalNotes?: string; 
  convertedInvoiceId?: string;
  convertedAppointmentId?: number;
  responsible?: string; 
  logs: HistoryLog[];
  nif?: string; 
  zone?: string; 
  contactPhone?: string;
  contactEmail?: string;
  type?: string;
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
  generatedInvoiceId?: string;
  paymentSkipped?: boolean; 
  customerSignature?: string; 
  signedBy?: string; 
  signedAt?: string; 
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

export interface DevNote {
    id: number;
    text: string;
    completed: boolean;
    createdAt: string;
    author: string;
}
