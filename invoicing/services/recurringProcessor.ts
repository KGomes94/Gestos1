
import { RecurringContract, Invoice, SystemSettings } from '../../types';
import { db } from '../../services/db';
import { invoicingCalculations } from './invoicingCalculations';

export const recurringProcessor = {
    /**
     * Calcula a próxima data de execução baseada na frequência
     */
    calculateNextRun: (currentRun: string, frequency: RecurringContract['frequency']): string => {
        const date = new Date(currentRun);
        switch (frequency) {
            case 'Mensal': date.setMonth(date.getMonth() + 1); break;
            case 'Trimestral': date.setMonth(date.getMonth() + 3); break;
            case 'Semestral': date.setMonth(date.getMonth() + 6); break;
            case 'Anual': date.setFullYear(date.getFullYear() + 1); break;
        }
        return date.toISOString().split('T')[0];
    },

    /**
     * Processa contratos ativos que venceram hoje ou antes
     */
    processContracts: (
        contracts: RecurringContract[], 
        settings: SystemSettings,
        existingInvoices: Invoice[] // Necessário para gerar numeração temporária única
    ): { newInvoices: Invoice[], updatedContracts: RecurringContract[] } => {
        
        const today = new Date().toISOString().split('T')[0];
        const newInvoices: Invoice[] = [];
        const updatedContracts: RecurringContract[] = [];
        let tempSequence = existingInvoices.filter(i => i.id.startsWith('DRAFT-AV')).length;

        contracts.forEach(contract => {
            if (contract.active && contract.nextRun <= today) {
                // Calcular totais reais para garantir precisão
                const { subtotal, taxTotal, total } = invoicingCalculations.calculateTotals(contract.items, false);

                // Gerar Fatura Rascunho
                const tempId = `DRAFT-AV-${Date.now()}-${tempSequence++}`;
                const newInvoice: Invoice = {
                    id: tempId,
                    internalId: 0,
                    series: settings.fiscalConfig.invoiceSeries || 'A',
                    type: 'FTE',
                    typeCode: '01',
                    date: today,
                    dueDate: today, // Simplificação
                    clientId: contract.clientId,
                    clientName: contract.clientName,
                    clientNif: '', // Deveria vir do cliente, mas aqui assumimos que será validado no final
                    clientAddress: '',
                    items: contract.items.map(i => ({...i, id: invoicingCalculations.generateItemId()})), // Clonar itens com novos IDs
                    subtotal,
                    taxTotal,
                    withholdingTotal: 0,
                    total,
                    status: 'Rascunho',
                    fiscalStatus: 'Não Comunicado',
                    iud: '',
                    isRecurring: true,
                    notes: `Avença ${contract.description} processada automaticamente.`
                };

                newInvoices.push(newInvoice);
                
                updatedContracts.push({
                    ...contract,
                    nextRun: recurringProcessor.calculateNextRun(contract.nextRun, contract.frequency)
                });
            } else {
                updatedContracts.push(contract);
            }
        });

        return { newInvoices, updatedContracts };
    }
};
