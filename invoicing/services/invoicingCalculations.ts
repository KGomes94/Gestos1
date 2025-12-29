
import { InvoiceItem, DraftInvoice, Invoice, SystemSettings } from '../../types';
import { currency } from '../../utils/currency';

export const invoicingCalculations = {
    /**
     * Calcula os totais de uma lista de itens com base na taxa de retenção
     */
    calculateTotals: (items: InvoiceItem[], applyRetention: boolean, retentionRate: number = 4) => {
        // Subtotal = Soma (Preço * Quantidade)
        const subtotal = items.reduce((acc, item) => {
            const lineTotal = currency.mul(item.unitPrice, item.quantity);
            return currency.add(acc, lineTotal);
        }, 0);
        
        // Calcula IVA linha a linha para maior precisão
        const taxTotal = items.reduce((acc, item) => {
            const itemTotal = currency.mul(item.unitPrice, item.quantity);
            const itemTax = currency.mul(itemTotal, item.taxRate / 100);
            return currency.add(acc, itemTax);
        }, 0);

        const withholdingTotal = applyRetention ? currency.mul(subtotal, retentionRate / 100) : 0;
        
        // Total = Subtotal + IVA - Retenção
        const total = currency.sub(currency.add(subtotal, taxTotal), withholdingTotal);

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
            unitPrice: currency.mul(Math.abs(item.unitPrice), -1), // Garante negativo
            total: currency.mul(Math.abs(item.total), -1)
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
        const price = isCreditNote ? currency.mul(Math.abs(material.price), -1) : Math.abs(material.price);
        return {
            id: invoicingCalculations.generateItemId(),
            description: material.name,
            itemCode: material.internalCode || 'N/A',
            quantity: quantity,
            unitPrice: price,
            taxRate: taxRate,
            total: currency.mul(price, quantity)
        };
    }
};
