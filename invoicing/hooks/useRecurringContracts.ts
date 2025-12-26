
import React, { useState, useCallback } from 'react';
import { RecurringContract, Invoice, SystemSettings, Material, InvoiceItem } from '../../types';
import { recurringProcessor } from '../services/recurringProcessor';
import { invoicingCalculations } from '../services/invoicingCalculations';
import { useNotification } from '../../contexts/NotificationContext';

export const useRecurringContracts = (
    contracts: RecurringContract[],
    setContracts: React.Dispatch<React.SetStateAction<RecurringContract[]>>,
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>,
    settings: SystemSettings
) => {
    const { notify } = useNotification();
    const [editingContract, setEditingContract] = useState<Partial<RecurringContract>>({
        frequency: 'Mensal',
        active: true,
        items: [],
        nextRun: new Date().toISOString().split('T')[0]
    });

    const initContract = (contract?: RecurringContract) => {
        if (contract) {
            setEditingContract(contract);
        } else {
            setEditingContract({
                frequency: 'Mensal',
                active: true,
                items: [],
                nextRun: new Date().toISOString().split('T')[0]
            });
        }
    };

    const addContractItem = (material: Material, quantity: number) => {
        const item = invoicingCalculations.createItem(material, quantity, settings.defaultTaxRate, false);
        setEditingContract(prev => ({ ...prev, items: [...(prev.items || []), item] }));
    };

    const removeContractItem = (idx: number) => {
        setEditingContract(prev => ({
            ...prev,
            items: prev.items?.filter((_, i) => i !== idx)
        }));
    };

    const saveContract = () => {
        if (!editingContract.clientId || (editingContract.items || []).length === 0) {
            notify('error', 'Cliente e Itens são obrigatórios.');
            return false;
        }

        const amount = (editingContract.items || []).reduce((a, b) => a + b.total, 0);
        const contract: RecurringContract = {
            ...editingContract as RecurringContract,
            id: editingContract.id || `AV-${Date.now()}`,
            amount,
            active: editingContract.active ?? true
        };

        if (editingContract.id) {
            setContracts(prev => prev.map(c => c.id === contract.id ? contract : c));
            notify('success', 'Avença atualizada.');
        } else {
            setContracts(prev => [...prev, contract]);
            notify('success', 'Avença criada.');
        }
        return true;
    };

    const processContractsNow = (existingInvoices: Invoice[]) => {
        const result = recurringProcessor.processContracts(contracts, settings, existingInvoices);
        
        if (result.newInvoices.length > 0) {
            setInvoices(prev => [...result.newInvoices, ...prev]);
            setContracts(result.updatedContracts); // Atualiza as datas de próxima execução
            notify('success', `${result.newInvoices.length} faturas de avença geradas (Rascunho).`);
        } else {
            notify('info', 'Nenhuma avença por processar hoje.');
        }
    };

    return {
        editingContract,
        setEditingContract, // Para campos simples
        initContract,
        addContractItem,
        removeContractItem,
        saveContract,
        processContractsNow
    };
};
