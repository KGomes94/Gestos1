
import { Invoice, InvoiceType, DraftInvoice } from '../../types';

export const fiscalRules = {
    /**
     * Verifica se o documento está em estado somente leitura (Emitido, Pago, Anulado)
     */
    isReadOnly: (invoice: DraftInvoice | Invoice): boolean => {
        return invoice.status !== 'Rascunho';
    },

    /**
     * Determina se o tipo de documento permite retenção na fonte (geralmente apenas FTE)
     */
    canApplyRetention: (type: InvoiceType): boolean => {
        return type === 'FTE';
    },

    /**
     * Verifica se o documento é um documento de pagamento imediato (Recibo)
     */
    isAutoPaid: (type: InvoiceType): boolean => {
        return type === 'FRE' || type === 'TVE';
    },

    /**
     * Verifica se é uma Nota de Crédito
     */
    isCreditNote: (type: InvoiceType): boolean => {
        return type === 'NCE';
    },

    /**
     * Valida se uma fatura pode ser emitida
     */
    validateForEmission: (invoice: DraftInvoice): string[] => {
        const errors: string[] = [];
        
        if (!invoice.clientId) {
            errors.push("O cliente é obrigatório.");
        }
        if (!invoice.items || invoice.items.length === 0) {
            errors.push("O documento deve ter pelo menos um item.");
        }
        if (invoice.type === 'NCE' && !invoice.relatedInvoiceId) {
            errors.push("Notas de Crédito devem referenciar uma fatura original.");
        }
        if (invoice.type === 'NCE' && !invoice.reason) {
            errors.push("Motivo obrigatório para Nota de Crédito.");
        }
        // Validação Fiscal Básica
        if (invoice.type !== 'TVE' && (!invoice.clientNif || invoice.clientNif.length !== 9)) {
            errors.push("NIF do cliente inválido (obrigatório 9 dígitos para faturas).");
        }

        return errors;
    }
};
