
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
    _deleted?: boolean; // Soft delete flag for sync
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
    ledCode: string; // Lógica de Emissão (LED) - 5 dígitos
    repositoryCode: '1' | '2' | '3'; // 1-Principal, 2-Homologação, 3-Teste
    allowManualInvoiceDate?: boolean; // NEW: Allows manual date on invoice creation
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
    
    enableTreasuryHardDelete?: boolean; // Allows hard delete of transactions
    allowNegativeStock?: boolean; // NEW: Controla se permite stock negativo

    paymentMethods: string[];

    defaultProposalValidityDays: number;
    defaultProposalNotes: string;

    dashboard?: DashboardConfig;
    serviceTypes: ServiceType[];

    calendarStartHour: number;
    calendarEndHour: number;
    calendarInterval: number;
    
    proposalLayout: ProposalLayoutConfig;
    invoiceLayout?: InvoiceLayoutConfig; // NEW
    serviceOrderLayout?: ServiceOrderLayoutConfig; // NEW
    
    proposalConfig?: ProposalSettingsConfig; // NEW: Specific settings
    fiscalConfig: FiscalConfig;
    
    trainingMode?: boolean; 
}

// --- NOVO PLANO DE CONTAS ---
export type AccountType = 'Receita Operacional' | 'Custo Direto' | 'Custo Fixo' | 'Despesa Financeira' | 'Movimento de Balanço';

export interface Account {
    id: string;     
    code: string;   
    name: string;   
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
  category: string; 
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
  // Personal
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

  // Professional
  role: string;
  department: string;
  status: 'Ativo' | 'Férias' | 'Inativo' | 'Licença';
  admissionDate: string;

  // Financial
  monthlySalary?: number;
  hourlyRate?: number;
  bankInfo?: {
      bankName: string;
      iban: string;
      swift?: string;
  };

  // Contract
  contractType: 'Sem Termo' | 'Termo Certo' | 'Prestação Serviços' | 'Estágio';
  contractStart: string;
  contractEnd?: string; // Optional for permanent contracts
  notes?: string;
}

export interface Material extends BaseRecord {
  id: number;
  name: string;
  unit: string;
  price: number;
  type: 'Material' | 'Serviço'; // Changed from category
  internalCode: string; // Mandatory for sequence
  observations?: string; // New field
  
  // Stock Management (Preparation)
  stock?: number; // Quantidade atual
  minStock?: number; // Stock mínimo para alerta
  avgCost?: number; // Custo médio (futuro)
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
    documentRef?: string; // Nº Fatura Compra ou Ordem Serviço
    user?: string;
    stockAfter: number;
}

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

export interface ProposalItem {
  id: number;
  type: 'Material' | 'Mão de Obra' | 'Serviço';
  description: string;
  quantity: number;
  unitPrice: number; // Preço de Venda
  costPrice?: number; // NEW: Preço de Custo (Snapshot)
  total: number;
  taxRate?: number; // Added taxRate per item
}

export type ProposalStatus = 'Rascunho' | 'Enviada' | 'Aceite' | 'Rejeitada' | 'Expirada' | 'Convertida' | 'Criada' | 'Aprovada' | 'Executada'; // Kept old statuses for compatibility
export type ProposalOrigin = 'Manual' | 'Agenda' | 'PedidoWeb';

export interface Proposal extends BaseRecord {
  id: string;
  sequence: number;
  version: number; // NEW
  origin: ProposalOrigin; // NEW
  
  // Client Snapshot
  clientId: number;
  clientName: string;
  clientNif?: string; // Snapshot
  clientAddress?: string; // Snapshot
  clientEmail?: string; // Snapshot
  
  title: string;
  items: ProposalItem[];
  
  // Financials
  subtotal: number; // NEW
  taxTotal: number; // NEW
  taxRate: number; // Global tax rate (deprecated in favor of item tax, but kept for UI default)
  discount: number;
  retention: number;
  total: number; // NEW
  currency: string; // NEW

  status: ProposalStatus;
  sentAt?: string; // NEW: Data de envio oficial
  
  // Dates
  date: string;
  validUntil: string;
  executionTerm?: string; // Prazo execução
  paymentTerms?: string; // Condições Pagamento

  notes?: string; // Commercial notes
  technicalNotes?: string; // Internal notes

  // Conversion Flags
  convertedInvoiceId?: string;
  convertedAppointmentId?: number;

  responsible?: string; // Employee Name
  logs: HistoryLog[];
  
  // Legacy fields compatibility
  nif?: string; 
  zone?: string; 
  contactPhone?: string;
  contactEmail?: string;
  type?: string;
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
  active?: boolean;
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
  paymentSkipped?: boolean; // NEW: Indica se foi marcado como "Sem Pagamento"
  
  // NEW: Signature & Validation
  customerSignature?: string; // Base64 signature
  signedBy?: string; // Name of the person who signed
  signedAt?: string; // Timestamp
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
