
import { InvoiceType } from '../../types';
import { fiscalRules } from './fiscalRules';

export interface ImportRow {
    invoice_ref: string;
    type: string;
    date: string;
    client_nif: string;
    client_name: string;
    description: string;
    item_code: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    apply_retention: boolean;
    row_index: number;
}

export interface ValidationError {
    line?: number;
    invoiceRef?: string;
    message: string;
    type: 'error' | 'warning';
}

export const invoiceImportValidators = {
    /**
     * Valida uma única linha do Excel (dados brutos)
     */
    validateRow: (row: ImportRow): ValidationError[] => {
        const errors: ValidationError[] = [];
        const validTypes: InvoiceType[] = ['FTE', 'FRE', 'TVE', 'NCE', 'RCE', 'NDE'];

        // Campos Obrigatórios
        if (!row.invoice_ref) errors.push({ line: row.row_index, message: 'Referência da fatura (invoice_ref) em falta.', type: 'error' });
        if (!row.type) errors.push({ line: row.row_index, message: 'Tipo de documento em falta.', type: 'error' });
        if (!validTypes.includes(row.type as InvoiceType)) errors.push({ line: row.row_index, message: `Tipo de documento inválido: ${row.type}`, type: 'error' });
        
        // Valores Numéricos
        if (row.quantity <= 0) errors.push({ line: row.row_index, message: 'Quantidade deve ser maior que zero.', type: 'error' });
        if (isNaN(row.unit_price)) errors.push({ line: row.row_index, message: 'Preço unitário inválido.', type: 'error' });
        if (row.tax_rate < 0) errors.push({ line: row.row_index, message: 'Taxa de IVA não pode ser negativa.', type: 'error' });

        return errors;
    },

    /**
     * Valida um grupo de linhas que formam uma fatura
     */
    validateInvoiceGroup: (invoiceRef: string, rows: ImportRow[]): ValidationError[] => {
        const errors: ValidationError[] = [];
        const firstRow = rows[0];
        const type = firstRow.type as InvoiceType;

        // Consistência de Cabeçalho
        const inconsistentClient = rows.some(r => r.client_nif !== firstRow.client_nif);
        if (inconsistentClient) {
            errors.push({ invoiceRef, message: 'Inconsistência de cliente (NIF) nas linhas da mesma fatura.', type: 'error' });
        }

        const inconsistentDate = rows.some(r => r.date !== firstRow.date);
        if (inconsistentDate) {
            errors.push({ invoiceRef, message: 'Inconsistência de data nas linhas da mesma fatura.', type: 'error' });
        }

        // Regras Fiscais
        if (rows.some(r => r.apply_retention) && !fiscalRules.canApplyRetention(type)) {
            errors.push({ invoiceRef, message: `Retenção na fonte não permitida para o documento ${type}.`, type: 'error' });
        }

        if (type === 'NCE' && rows.length > 0) {
            // Aviso apenas, pois o sistema irá converter para negativo automaticamente
            // errors.push({ invoiceRef, message: 'Nota de crédito deve ter valores negativos.', type: 'warning' });
        }

        return errors;
    }
};
