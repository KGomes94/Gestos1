
import { useState, useCallback, useEffect } from 'react';
import { DraftInvoice, Invoice, InvoiceType, Client, Material, SystemSettings, Transaction } from '../../types';
import { fiscalRules } from '../services/fiscalRules';
import { invoicingCalculations } from '../services/invoicingCalculations';
import { fiscalService } from '../../services/fiscalService';
import { db } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';

export const useInvoiceDraft = (
    settings: SystemSettings, 
    onSaveSuccess: (invoice: Invoice, originalId?: string) => void,
    onCreateTransaction: (invoice: Invoice) => void
) => {
    const { notify } = useNotification();
    
    // State
    const [draft, setDraft] = useState<DraftInvoice>({
        type: 'FTE',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        items: [],
        subtotal: 0,
        taxTotal: 0,
        withholdingTotal: 0,
        total: 0,
        status: 'Rascunho',
        clientId: 0,
        clientName: '',
        clientNif: '',
        clientAddress: ''
    });
    
    const [applyRetention, setApplyRetention] = useState(false);
    const [isIssuing, setIsIssuing] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    // Recalculate totals when items or retention changes
    useEffect(() => {
        // Evitar recálculo se for read-only para não mutar estado
        if (!fiscalRules.isReadOnly(draft)) {
            const totals = invoicingCalculations.calculateTotals(draft.items || [], applyRetention, settings.defaultRetentionRate);
            setDraft(prev => ({ ...prev, ...totals }));
        }
    }, [draft.items, applyRetention, settings.defaultRetentionRate]);

    // Initialize/Reset Draft
    const initDraft = useCallback((invoice?: Invoice | Partial<DraftInvoice>) => {
        if (invoice) {
            setDraft(invoice as DraftInvoice);
            setApplyRetention((invoice.withholdingTotal || 0) > 0);
        } else {
            setDraft({
                type: 'FTE',
                date: new Date().toISOString().split('T')[0],
                dueDate: new Date().toISOString().split('T')[0],
                items: [],
                subtotal: 0,
                taxTotal: 0,
                withholdingTotal: 0,
                total: 0,
                status: 'Rascunho',
                clientId: 0,
                clientName: '',
                clientNif: '',
                clientAddress: ''
            });
            setApplyRetention(false);
        }
        setErrors([]);
        setIsIssuing(false);
    }, []);

    // Handlers
    const setDate = (date: string) => {
        if (fiscalRules.isReadOnly(draft)) return;
        setDraft(prev => ({ ...prev, date }));
    };

    const setType = (type: InvoiceType) => {
        if (fiscalRules.isReadOnly(draft)) return;
        setDraft(prev => ({ ...prev, type, items: [], relatedInvoiceId: undefined }));
        if (type === 'NCE') setApplyRetention(false);
    };

    const setClient = (client: Client) => {
        if (fiscalRules.isReadOnly(draft)) return;
        setDraft(prev => ({
            ...prev,
            clientId: client.id,
            clientName: client.company,
            clientNif: client.nif || '',
            clientAddress: client.address || ''
        }));
    };

    const setClientNif = (nif: string) => {
        if (fiscalRules.isReadOnly(draft)) return;
        setDraft(prev => ({ ...prev, clientNif: nif }));
    };

    const setClientAddress = (address: string) => {
        if (fiscalRules.isReadOnly(draft)) return;
        setDraft(prev => ({ ...prev, clientAddress: address }));
    };

    const setNotes = (notes: string) => {
        if (fiscalRules.isReadOnly(draft)) return;
        setDraft(prev => ({ ...prev, notes }));
    };

    const addItem = (material: Material, quantity: number, customPrice?: number) => {
        if (fiscalRules.isReadOnly(draft)) return;
        
        // Use custom price if provided, otherwise default to material price
        const effectivePrice = customPrice !== undefined ? customPrice : material.price;
        const materialWithPrice = { 
            name: material.name, 
            internalCode: material.internalCode, 
            price: effectivePrice 
        };

        const newItem = invoicingCalculations.createItem(
            materialWithPrice, 
            quantity, 
            settings.defaultTaxRate, 
            fiscalRules.isCreditNote(draft.type)
        );
        setDraft(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const removeItem = (itemId: string | number) => {
        if (fiscalRules.isReadOnly(draft)) return;
        setDraft(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
    };

    const toggleRetention = () => {
        if (fiscalRules.isReadOnly(draft)) return;
        if (fiscalRules.canApplyRetention(draft.type)) {
            setApplyRetention(prev => !prev);
        }
    };

    const setReferenceInvoice = (refInvoice: Invoice) => {
        if (fiscalRules.isReadOnly(draft)) return;
        
        const reversedItems = invoicingCalculations.reverseItemsForCreditNote(refInvoice.items);
        setDraft(prev => ({
            ...prev,
            items: reversedItems,
            relatedInvoiceId: refInvoice.id,
            relatedInvoiceIUD: refInvoice.iud,
            clientId: refInvoice.clientId,
            clientName: refInvoice.clientName,
            clientNif: refInvoice.clientNif,
            clientAddress: refInvoice.clientAddress
        }));
        setApplyRetention(refInvoice.withholdingTotal > 0);
    };

    const setReason = (reason: string) => {
        if (fiscalRules.isReadOnly(draft)) return;
        setDraft(prev => ({...prev, reason}));
    };

    // Actions
    const saveDraft = () => {
        const series = settings.fiscalConfig.invoiceSeries || 'A';
        const tempId = draft.id?.startsWith(draft.type) ? draft.id : (draft.id || `DRAFT-${Date.now()}`);
        
        const savedInvoice: Invoice = {
            ...draft as Invoice,
            id: tempId,
            internalId: 0,
            series,
            status: 'Rascunho',
            fiscalStatus: 'Não Comunicado',
            iud: ''
        };
        
        onSaveSuccess(savedInvoice, draft.id);
        notify('success', 'Rascunho guardado.');
    };

    const finalize = async () => {
        const validationErrors = fiscalRules.validateForEmission(draft);
        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        const originalDraftId = draft.id; // Capture original draft ID
        setIsIssuing(true);
        try {
            const series = settings.fiscalConfig.invoiceSeries;
            const nextNum = db.invoices.getNextNumber(series);
            const finalId = `${draft.type} ${series}${new Date().getFullYear()}/${nextNum.toString().padStart(3, '0')}`;

            const invoiceToEmit: Invoice = {
                ...draft as Invoice,
                id: finalId,
                internalId: nextNum,
                series,
                typeCode: fiscalService.getTypeCode(draft.type),
                status: 'Emitida' // Estado inicial de emissão
            };

            const finalizedInvoice = fiscalService.finalizeDocument(invoiceToEmit, settings);
            
            // Auto create transaction if applicable
            if (fiscalRules.isAutoPaid(finalizedInvoice.type) || fiscalRules.isCreditNote(finalizedInvoice.type)) {
                onCreateTransaction(finalizedInvoice);
            }

            // Pass original ID to remove the draft from the list
            onSaveSuccess(finalizedInvoice, originalDraftId);
            notify('success', `Documento ${finalId} emitido com sucesso.`);
        } catch (e) {
            console.error(e);
            notify('error', 'Erro ao emitir documento.');
        } finally {
            setIsIssuing(false);
        }
    };

    return {
        draft,
        applyRetention,
        isIssuing,
        errors,
        initDraft,
        setDate,
        setType,
        setClient,
        setClientNif,
        setClientAddress,
        setNotes,
        addItem,
        removeItem,
        toggleRetention,
        setReferenceInvoice,
        setReason,
        saveDraft,
        finalize,
        isReadOnly: fiscalRules.isReadOnly(draft)
    };
};
