
import { Proposal, ProposalItem, ProposalStatus, SystemSettings, HistoryLog } from '../types';
import { currency } from '../utils/currency';

export const proposalService = {
    /**
     * Calcula os totais de uma proposta (Subtotal, Descontos, Impostos, Retenção, Total Final)
     */
    calculateTotals: (items: ProposalItem[], globalDiscountPerc: number, globalRetentionPerc: number, defaultTaxRate: number) => {
        // 1. Soma dos itens (Quantidade * Preço Unitário)
        const subtotal = items.reduce((acc, item) => {
            return currency.add(acc, currency.mul(item.quantity, item.unitPrice));
        }, 0);

        // 2. Desconto Global (aplicado sobre o subtotal)
        const discountAmount = currency.mul(subtotal, globalDiscountPerc / 100);
        const taxableBase = currency.sub(subtotal, discountAmount);

        // 3. Impostos (IVA)
        // Se os itens não tiverem taxa específica, usa a global/default. 
        const taxTotal = items.reduce((acc, item) => {
            const lineTotal = currency.mul(item.quantity, item.unitPrice);
            // Aplica desconto proporcional à linha para base de imposto correta
            const discountedLineTotal = currency.mul(lineTotal, 1 - (globalDiscountPerc / 100));
            const rate = item.taxRate ?? defaultTaxRate;
            const itemTax = currency.mul(discountedLineTotal, rate / 100);
            return currency.add(acc, itemTax);
        }, 0);

        // 4. Retenção na Fonte (aplicada sobre a base tributável)
        const retentionAmount = currency.mul(taxableBase, globalRetentionPerc / 100);

        // 5. Total Final
        const total = currency.sub(currency.add(taxableBase, taxTotal), retentionAmount);

        return {
            subtotal,
            discountAmount,
            taxableBase,
            taxTotal,
            retentionAmount,
            total
        };
    },

    /**
     * Valida se uma proposta pode transitar para um novo estado
     */
    canChangeStatus: (currentStatus: ProposalStatus, newStatus: ProposalStatus): boolean => {
        if (currentStatus === 'Convertida' || currentStatus === 'Executada') return false; // Estado final
        if (currentStatus === 'Rejeitada' && newStatus === 'Aceite') return true; // Reabertura
        if (currentStatus === 'Aceite' && newStatus === 'Rascunho') return false; // Não volta a rascunho
        return true;
    },

    /**
     * Verifica se a proposta é editável
     */
    isEditable: (proposal: Proposal, settings: SystemSettings): boolean => {
        if (proposal.status === 'Rascunho' || proposal.status === 'Criada') return true;
        if (proposal.status === 'Enviada' && settings.proposalConfig?.allowEditAfterSent) return true;
        return false; // Aceite, Rejeitada, Convertida, Expirada são read-only
    },

    /**
     * Validação de Dados para Gravação
     */
    validate: (proposal: Partial<Proposal>): { isValid: boolean, errors: string[] } => {
        const errors: string[] = [];

        if (!proposal.clientId) errors.push("Cliente é obrigatório.");
        if (!proposal.items || proposal.items.length === 0) errors.push("Adicione pelo menos um item à proposta.");
        if (!proposal.validUntil) errors.push("Data de validade é obrigatória.");
        if (!proposal.date) errors.push("Data de emissão é obrigatória.");
        
        // Validar items
        proposal.items?.forEach((item, idx) => {
            if (item.quantity <= 0) errors.push(`Item ${idx + 1}: Quantidade deve ser maior que zero.`);
            if (item.unitPrice < 0) errors.push(`Item ${idx + 1}: Preço não pode ser negativo.`);
            if (!item.description) errors.push(`Item ${idx + 1}: Descrição obrigatória.`);
        });

        return { isValid: errors.length === 0, errors };
    },

    /**
     * Gera log de auditoria
     */
    createLog: (action: string, details: string, userName?: string): HistoryLog => {
        return {
            timestamp: new Date().toISOString(),
            action,
            details,
            user: userName || 'Sistema'
        };
    },

    /**
     * Verifica se a proposta expirou
     */
    checkExpiration: (proposal: Proposal): boolean => {
        if (proposal.status === 'Convertida' || proposal.status === 'Aceite' || proposal.status === 'Rejeitada') return false;
        const today = new Date().toISOString().split('T')[0];
        return proposal.validUntil < today;
    }
};
