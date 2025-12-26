
import React, { useState, useRef } from 'react';
import { DraftInvoice, Invoice, Client, SystemSettings, Material } from '../../types';
import { invoiceImportService } from '../services/invoiceImportService';
import { ValidationError } from '../services/invoiceImportValidators';
import { useNotification } from '../../contexts/NotificationContext';

export const useInvoiceImport = (
    clients: Client[],
    setClients: React.Dispatch<React.SetStateAction<Client[]>>,
    materials: Material[],
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>,
    settings: SystemSettings,
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>
) => {
    const { notify } = useNotification();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [previewDrafts, setPreviewDrafts] = useState<DraftInvoice[]>([]);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [summary, setSummary] = useState({ totalRows: 0, validInvoices: 0, invalidInvoices: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const openModal = () => {
        setPreviewDrafts([]);
        setValidationErrors([]);
        setIsModalOpen(true);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const rawData = await invoiceImportService.parseFile(file);
            const result = invoiceImportService.processImport(rawData, clients, settings);
            
            setPreviewDrafts(result.drafts);
            setValidationErrors(result.errors);
            setSummary(result.summary);
        } catch (error) {
            console.error(error);
            notify('error', 'Erro ao ler o ficheiro Excel.');
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmImport = () => {
        if (previewDrafts.length === 0) return;

        // Criar Faturas (Sem criação automática de clientes ou materiais)
        // Se o cliente não existir (clientId === 0), a fatura fica com o nome/nif importado mas sem ligação à base de dados.
        const newInvoices: Invoice[] = previewDrafts.map(draft => ({
            ...draft as Invoice,
            // Garantir que os campos obrigatórios de Invoice estão preenchidos para a persistência
            internalId: 0,
            series: settings.fiscalConfig.invoiceSeries || 'A',
            typeCode: '01', // Será corrigido na emissão
            status: 'Rascunho',
            fiscalStatus: 'Não Comunicado',
            iud: ''
        }));

        setInvoices(prev => [...newInvoices, ...prev]);
        
        notify('success', `${newInvoices.length} faturas importadas com sucesso.`);
        notify('info', 'Nota: Faturas em rascunho não afetam os indicadores do dashboard até serem emitidas.');
        
        setIsModalOpen(false);
    };

    return {
        isModalOpen,
        setIsModalOpen,
        openModal,
        isLoading,
        previewDrafts,
        validationErrors,
        summary,
        handleFileSelect,
        confirmImport,
        fileInputRef
    };
};
