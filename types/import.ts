/**
 * Tipos unificados para o sistema de importação de dados
 * Utilizados por todos os módulos: Invoice, Material, Client, Purchase
 */

/**
 * Resultado de uma linha processada durante importação
 */
export interface ImportedRow<T> {
  id: string;
  rowNumber: number;
  data: T;
  status: 'success' | 'warning' | 'error';
  errors: ImportError[];
}

/**
 * Erro durante o processamento de importação
 */
export interface ImportError {
  field: string;
  message: string;
  value?: unknown;
  code?: string;
}

/**
 * Resumo da importação completa
 */
export interface ImportSummary {
  totalRows: number;
  successCount: number;
  warningCount: number;
  errorCount: number;
  duration: number; // em ms
  timestamp: Date;
  fileName: string;
}

/**
 * Resultado completo de uma importação
 */
export interface ImportResult<T> {
  success: boolean;
  data: ImportedRow<T>[];
  summary: ImportSummary;
  errors: ImportError[];
}

/**
 * Opções de importação configuráveis
 */
export interface ImportOptions {
  skipEmpty?: boolean;
  validateRequired?: boolean;
  validateDates?: boolean;
  validateNumbers?: boolean;
  matchMode?: 'strict' | 'flexible';
  defaultValues?: Record<string, unknown>;
  customValidators?: Record<string, (value: unknown) => boolean>;
}

/**
 * Estado de um modal de importação
 */
export interface ImportModalState<T> {
  isOpen: boolean;
  file: File | null;
  isLoading: boolean;
  results: ImportResult<T> | null;
  activeTab: 'upload' | 'preview' | 'results';
  error: string | null;
  successMessage: string | null;
}

/**
 * Props base para modais de importação
 */
export interface BaseImportModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: ImportedRow<T>[]) => Promise<void>;
  title: string;
  description?: string;
  acceptedFormats?: string[];
  maxFileSize?: number; // em bytes
  columnMapping?: Record<string, string[]>; // field -> [possíveis nomes de coluna]
}

/**
 * Configuração de coluna para mapeamento
 */
export interface ColumnConfig {
  key: string;
  label: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'boolean';
  aliases?: string[]; // nomes alternativos para esta coluna
  description?: string;
}

/**
 * Configuração completa para importação de um tipo de dados
 */
export interface ImportConfig<T> {
  title: string;
  description: string;
  columns: ColumnConfig[];
  defaultValues?: Partial<T>;
  requiredFields?: (keyof T)[];
  validators?: Record<keyof T, (value: unknown) => boolean | string>;
}

/**
 * Dados brutos lidos de um ficheiro
 */
export interface RawImportData {
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
  fileSize: number;
  sheetName?: string;
}

/**
 * Estatísticas de importação para exibição
 */
export interface ImportStats {
  totalRows: number;
  successRows: number;
  warningRows: number;
  errorRows: number;
  successPercentage: number;
  estimatedTime: string;
}

/**
 * Callback para progresso de importação (em tempo real)
 */
export type ImportProgressCallback = (progress: {
  processed: number;
  total: number;
  currentRow?: number;
  status?: string;
}) => void;

/**
 * Tipos específicos para cada módulo
 */

/**
 * Dados de fatura a importar
 */
export interface ImportedInvoice {
  invoiceNumber: string;
  clientName: string;
  clientNif?: string;
  invoiceDate: Date;
  dueDate?: Date;
  amount: number;
  vat?: number;
  description?: string;
  status?: 'draft' | 'sent' | 'paid' | 'overdue';
  reference?: string;
}

/**
 * Dados de material a importar
 */
export interface ImportedMaterial {
  code: string;
  name: string;
  category: string;
  description?: string;
  unitPrice: number;
  quantity: number;
  unit?: string;
  supplier?: string;
  sku?: string;
  status?: 'active' | 'inactive';
}

/**
 * Dados de cliente a importar
 */
export interface ImportedClient {
  name: string;
  nif: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  type?: 'individual' | 'company';
  status?: 'active' | 'inactive';
}

/**
 * Dados de compra a importar
 */
export interface ImportedPurchase {
  purchaseNumber: string;
  supplierName: string;
  supplierNif?: string;
  purchaseDate: Date;
  dueDate?: Date;
  amount: number;
  vat?: number;
  description?: string;
  status?: 'draft' | 'pending' | 'received' | 'invoiced';
  reference?: string;
}

/**
 * Mapeamento entre tipos específicos e a interface genérica
 */
export type SpecificImportType = ImportedInvoice | ImportedMaterial | ImportedClient | ImportedPurchase;
