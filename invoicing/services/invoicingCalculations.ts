
import { InvoiceItem, DraftInvoice, Invoice, SystemSettings } from '../../types';

export const invoicingCalculations = {
    /**
     * Calcula os totais de uma lista de itens com base na taxa de retenção
     */
    calculateTotals: (items: InvoiceItem[], applyRetention: boolean, retentionRate: number = 4) => {
        const subtotal = items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
        
        // Calcula IVA linha a linha para maior precisão (conforme regras fiscais geralmente)
        const taxTotal = items.reduce((acc, item) => {
            const itemTotal = item.unitPrice * item.quantity;
            return acc + (itemTotal * (item.taxRate / 100));
        }, 0);

        const withholdingTotal = applyRetention ? (subtotal * (retentionRate / 100)) : 0;
        
        // Em notas de crédito, os valores são negativos, então a matemática funciona igual
        const total = subtotal + taxTotal - withholdingTotal;

        return { subtotal, taxTotal, withholdingTotal, total };
    },

    /**
     * Gera um ID seguro (pseudo-random) para itens
     */
    generateItemId: (): string => {
        return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    },

    /**
     * Inverte os itens para Nota de Crédito (Valores Negativos)
     */
    reverseItemsForCreditNote: (originalItems: InvoiceItem[]): InvoiceItem[] => {
        return originalItems.map(item => ({
            ...item,
            id: invoicingCalculations.generateItemId(), // Novo ID para o item da NC
            unitPrice: Math.abs(item.unitPrice) * -1, // Garante negativo
            total: Math.abs(item.total) * -1
        }));
    },

    /**
     * Cria um novo item de fatura
     */
    createItem: (
        material: { name: string; internalCode?: string; price: number }, 
        quantity: number, 
        taxRate: number,
        isCreditNote: boolean
    ): InvoiceItem => {
        const price = isCreditNote ? -Math.abs(material.price) : Math.abs(material.price);
        return {
            id: invoicingCalculations.generateItemId(),
            description: material.name,
            itemCode: material.internalCode || 'N/A',
            quantity: quantity,
            unitPrice: price,
            taxRate: taxRate,
            total: price * quantity
        };
    }
};
