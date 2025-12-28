
import React, { useState, useRef } from 'react';
import { DraftInvoice, Invoice, Client, SystemSettings, Material } from '../../types';
import { invoiceImportService } from '../services/invoiceImportService';
import { ValidationError } from '../services/invoiceImportValidators';
import { useNotification } from '../../contexts/NotificationContext';
import { fiscalService } from '../../services/fiscalService';
import { db } from '../../services/db';

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

    const confirmImport = (emitImmediately: boolean = false) => {
        if (previewDrafts.length === 0) return;

        const series = settings.fiscalConfig.invoiceSeries || 'A';
        
        // Se for emitir, precisamos saber o próximo número sequencial da BD
        // Nota: db.invoices.getNextNumber é síncrono no contexto atual (memory), 
        // mas num cenário real async, teríamos que ter cuidado.
        let nextSequence = emitImmediately ? db.invoices.getNextNumber(series) : 0;

        const newInvoices: Invoice[] = previewDrafts.map((draft, index) => {
            // Base da fatura
            let invoice: Invoice = {
                ...draft as Invoice,
                internalId: 0,
                series: series,
                typeCode: fiscalService.getTypeCode(draft.type),
                status: 'Rascunho',
                fiscalStatus: 'Não Comunicado',
                iud: ''
            };

            if (emitImmediately) {
                // Atribuir número sequencial para este item do lote
                const currentInternalId = nextSequence + index;
                
                // Preparar objeto para finalização
                const invoiceToEmit = {
                    ...invoice,
                    internalId: currentInternalId,
                    status: 'Emitida' as const
                };

                // Gerar IUD e Hash (Emissão Fiscal)
                const finalized = fiscalService.finalizeDocument(invoiceToEmit, settings);
                return finalized;
            }

            return invoice;
        });

        setInvoices(prev => [...newInvoices, ...prev]);
        
        if (emitImmediately) {
            notify('success', `${newInvoices.length} faturas importadas e EMITIDAS com sucesso.`);
        } else {
            notify('success', `${newInvoices.length} faturas importadas como Rascunho.`);
            notify('info', 'Nota: Faturas em rascunho não afetam os indicadores do dashboard até serem emitidas.');
        }
        
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
