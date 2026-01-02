
import React, { useState, useCallback, useEffect } from 'react';
import { DraftInvoice, Invoice, InvoiceType, Client, Material, SystemSettings, Transaction, StockMovement, StockMovementType } from '../../types';
import { fiscalRules } from '../services/fiscalRules';
import { invoicingCalculations } from '../services/invoicingCalculations';
import { fiscalService } from '../../services/fiscalService';
import { db } from '../../services/db';
import { useNotification } from '../../contexts/NotificationContext';
import { stockService } from '../../services/stockService';

export const useInvoiceDraft = (
    settings: SystemSettings, 
    onSaveSuccess: (invoice: Invoice, originalId?: string) => void,
    onCreateTransaction: (invoice: Invoice) => void,
    // Novos callbacks para gerir stock
    materials?: Material[],
    setMaterials?: React.Dispatch<React.SetStateAction<Material[]>>,
    setStockMovements?: React.Dispatch<React.SetStateAction<StockMovement[]>>
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
        clientAddress: '',
        paymentMethod: 'Dinheiro' // Default for auto-paid documents
    });
    
    const [applyRetention, setApplyRetention] = useState(false);
    const [isIssuing, setIsIssuing] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    // Recalculate totals when items or retention changes
    useEffect(() => {
        if (!fiscalRules.isReadOnly(draft)) {
            const retentionRate = settings?.defaultRetentionRate ?? 0;
            const totals = invoicingCalculations.calculateTotals(draft.items || [], applyRetention, retentionRate);
            setDraft(prev => ({ ...prev, ...totals }));
        }
    }, [draft.items, applyRetention, settings?.defaultRetentionRate]);

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
                clientAddress: '',
                paymentMethod: 'Dinheiro'
            });
            setApplyRetention(false);
        }
        setErrors([]);
        setIsIssuing(false);
    }, []);

    // ... (Setters standard mantidos: setDate, setType, etc. - Sem alterações) ...
    // Para poupar espaço, omito os setters simples se não houver lógica nova,
    // mas num ambiente real manteria tudo. Vou incluir apenas os necessários para o contexto.
    const setDate = (date: string) => { if (!fiscalRules.isReadOnly(draft)) setDraft(prev => ({ ...prev, date })); };
    const setType = (type: InvoiceType) => { if (!fiscalRules.isReadOnly(draft)) { setDraft(prev => ({ ...prev, type, items: [], relatedInvoiceId: undefined })); if (type === 'NCE') setApplyRetention(false); } };
    const setClient = (client: Client) => { if (!fiscalRules.isReadOnly(draft)) setDraft(prev => ({ ...prev, clientId: client.id, clientName: client.company, clientNif: client.nif || '', clientAddress: client.address || '' })); };
    const setClientNif = (nif: string) => { if (!fiscalRules.isReadOnly(draft)) setDraft(prev => ({ ...prev, clientNif: nif })); };
    const setClientAddress = (address: string) => { if (!fiscalRules.isReadOnly(draft)) setDraft(prev => ({ ...prev, clientAddress: address })); };
    const setNotes = (notes: string) => { if (!fiscalRules.isReadOnly(draft)) setDraft(prev => ({ ...prev, notes })); };
    const removeItem = (itemId: string | number) => { if (!fiscalRules.isReadOnly(draft)) setDraft(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) })); };
    const toggleRetention = () => { if (!fiscalRules.isReadOnly(draft) && fiscalRules.canApplyRetention(draft.type)) setApplyRetention(prev => !prev); };
    const setReason = (reason: string) => { if (!fiscalRules.isReadOnly(draft)) setDraft(prev => ({...prev, reason})); };
    const setPaymentMethod = (method: string) => { if (!fiscalRules.isReadOnly(draft)) setDraft(prev => ({...prev, paymentMethod: method})); };

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
            clientNif: refInvoice.clientNif || '',
            clientAddress: refInvoice.clientAddress || ''
        }));
        setApplyRetention(refInvoice.withholdingTotal > 0);
    };

    const addItem = (material: Material, quantity: number, customPrice?: number) => {
        if (fiscalRules.isReadOnly(draft)) return;
        const effectivePrice = customPrice !== undefined ? customPrice : material.price;
        // Importante: Guardar referência ao internalCode para matching de stock futuro
        const materialWithPrice = { name: material.name, internalCode: material.internalCode, price: effectivePrice };
        const taxRate = settings?.defaultTaxRate ?? 15;
        const newItem = invoicingCalculations.createItem(materialWithPrice, quantity, taxRate, fiscalRules.isCreditNote(draft.type));
        setDraft(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    // Actions
    const saveDraft = () => {
        const series = settings?.fiscalConfig?.invoiceSeries || 'A';
        const tempId = draft.id?.startsWith(draft.type) ? draft.id : (draft.id || `DRAFT-${Date.now()}`);
        const savedInvoice: Invoice = { ...draft as Invoice, id: tempId, internalId: 0, series, status: 'Rascunho', fiscalStatus: 'Não Comunicado', iud: '' };
        onSaveSuccess(savedInvoice, draft.id);
        notify('success', 'Rascunho guardado.');
    };

    /**
     * Lógica de Processamento de Stock Automático
     */
    const processStockDeduction = (invoice: Invoice) => {
        if (!materials || !setMaterials || !setStockMovements) return;

        // Notas de Crédito = Entrada de Stock (Devolução)
        // Outros docs = Saída de Stock
        const isReturn = fiscalRules.isCreditNote(invoice.type);
        const type: StockMovementType = isReturn ? 'ENTRADA' : 'SAIDA';
        const movements: StockMovement[] = [];
        let updatedMaterialsList = [...materials];
        let alerts: string[] = [];

        invoice.items.forEach(item => {
            // Tenta encontrar o material pelo código ou nome exato
            const materialIndex = updatedMaterialsList.findIndex(m => 
                (item.itemCode && m.internalCode === item.itemCode) || 
                m.name === item.description
            );

            if (materialIndex !== -1) {
                const material = updatedMaterialsList[materialIndex];
                
                // Só processa se for do tipo 'Material' (Serviços não têm stock)
                if (material.type === 'Material') {
                    const qty = Math.abs(item.quantity);
                    const reason = `${isReturn ? 'Devolução' : 'Venda'} - Doc: ${invoice.id}`;
                    
                    const result = stockService.processMovement(
                        material,
                        qty,
                        type,
                        reason,
                        'Sistema (Faturação)',
                        invoice.id
                    );

                    if (result.success && result.updatedMaterial && result.movement) {
                        updatedMaterialsList[materialIndex] = result.updatedMaterial;
                        movements.push(result.movement);
                        
                        // Coleta alertas individuais para notificar
                        if (result.alertType === 'warning' || result.alertType === 'error') {
                            alerts.push(result.message);
                        }
                    }
                }
            }
        });

        if (movements.length > 0) {
            setMaterials(updatedMaterialsList);
            setStockMovements(prev => [...movements, ...prev]);
            
            // Dispara alertas acumulados
            if (alerts.length > 0) {
                // Notificar apenas o primeiro erro crítico ou um resumo
                notify('warning', `Stock atualizado com avisos: ${alerts[0]}`, 'Alerta de Stock');
            } else {
                notify('info', `${movements.length} artigos atualizados no stock.`, 'Stock Atualizado');
            }
        }
    };

    const finalize = async () => {
        const validationErrors = fiscalRules.validateForEmission(draft);
        if (validationErrors.length > 0) { setErrors(validationErrors); return; }

        // CHECK STOCK BLOCKING RULE
        // Se a configuração proibir stock negativo, validamos antes de prosseguir
        if ((settings?.allowNegativeStock === false) && materials) {
            const stockErrors: string[] = [];
            
            // Apenas validar se NÃO for nota de crédito (devolução aumenta stock, não diminui)
            if (!fiscalRules.isCreditNote(draft.type)) {
                draft.items.forEach(item => {
                    const material = materials.find(m => 
                        (item.itemCode && m.internalCode === item.itemCode) || 
                        m.name === item.description
                    );
                    
                    if (material && material.type === 'Material') {
                        if ((material.stock || 0) < item.quantity) {
                            stockErrors.push(`Stock insuficiente para "${material.name}": Disponível: ${material.stock}, Solicitado: ${item.quantity}`);
                        }
                    }
                });
            }

            if (stockErrors.length > 0) {
                setErrors(stockErrors);
                notify('error', 'Emissão bloqueada por falta de stock.');
                return;
            }
        }

        const originalDraftId = draft.id; 
        setIsIssuing(true);
        try {
            const series = settings?.fiscalConfig?.invoiceSeries || 'A';
            const allInvoices = await db.invoices.getAll();
            let nextNum = db.invoices.getNextNumber(series);
            let finalId = `${draft.type} ${series}${new Date().getFullYear()}/${nextNum.toString().padStart(3, '0')}`;
            
            while (allInvoices.some(i => i.id === finalId)) {
                nextNum++;
                finalId = `${draft.type} ${series}${new Date().getFullYear()}/${nextNum.toString().padStart(3, '0')}`;
            }

            const invoiceToEmit: Invoice = {
                ...draft as Invoice,
                id: finalId, internalId: nextNum, series, typeCode: fiscalService.getTypeCode(draft.type),
                status: 'Emitida', clientNif: draft.clientNif || '', clientAddress: draft.clientAddress || ''
            };

            const finalizedInvoice = fiscalService.finalizeDocument(invoiceToEmit, settings);
            
            if (fiscalRules.isAutoPaid(finalizedInvoice.type) || fiscalRules.isCreditNote(finalizedInvoice.type)) {
                onCreateTransaction(finalizedInvoice);
            }

            // CRITICAL: Stock Deduction
            processStockDeduction(finalizedInvoice);

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
        draft, applyRetention, isIssuing, errors,
        initDraft, setDate, setType, setClient, setClientNif, setClientAddress, setNotes, 
        addItem, removeItem, toggleRetention, setReferenceInvoice, setReason, setPaymentMethod,
        saveDraft, finalize, 
        isReadOnly: fiscalRules.isReadOnly(draft)
    };
};
