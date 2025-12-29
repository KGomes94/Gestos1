
import { Invoice, InvoiceType, DraftInvoice } from '../../types';
import { fiscalService } from '../../services/fiscalService';

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
     * Valida se uma fatura pode ser emitida.
     * Aplica regras rigorosas para FTE/FRE e permissivas para TVE.
     */
    validateForEmission: (invoice: DraftInvoice): string[] => {
        const errors: string[] = [];
        
        if (!invoice.clientId) {
            errors.push("O cliente é obrigatório.");
        }
        if (!invoice.items || invoice.items.length === 0) {
            errors.push("O documento deve ter pelo menos um item.");
        }
        
        // Validação de NIF (TVE permite sem NIF ou com Consumidor Final)
        if (invoice.type === 'TVE') {
            // Para TVE, NIF é opcional, mas se preenchido, deve ser válido
            if (invoice.clientNif && invoice.clientNif.trim() !== '' && !fiscalService.isValidNIF(invoice.clientNif)) {
                errors.push("NIF inserido é inválido (deixe vazio para Consumidor Final).");
            }
        } else {
            // Para FTE, FRE, NCE, etc., NIF é OBRIGATÓRIO e deve ser VÁLIDO
            if (!invoice.clientNif) {
                errors.push(`NIF do cliente é obrigatório para documentos do tipo ${invoice.type}.`);
            } else if (!fiscalService.isValidNIF(invoice.clientNif)) {
                errors.push("NIF do cliente inválido (Algoritmo Mod 11 falhou).");
            }

            if (!invoice.clientAddress || invoice.clientAddress.trim().length < 3) {
                errors.push("Morada do cliente é obrigatória para este tipo de documento.");
            }
        }

        // Regras Específicas de NC
        if (invoice.type === 'NCE') {
            if (!invoice.relatedInvoiceId) {
                errors.push("Notas de Crédito devem referenciar uma fatura original.");
            }
            if (!invoice.reason) {
                errors.push("Motivo obrigatório para Nota de Crédito.");
            }
        }

        return errors;
    }
};
