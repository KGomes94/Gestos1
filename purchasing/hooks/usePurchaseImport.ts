
import React, { useState, useRef } from 'react';
import { Purchase, Client } from '../../types';
import { purchaseImportService, PurchaseImportResult } from '../services/purchaseImportService';
import { useNotification } from '../../contexts/NotificationContext';
import { db } from '../../services/db';

export const usePurchaseImport = (
    purchases: Purchase[],
    setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>,
    suppliers: Client[]
) => {
    const { notify } = useNotification();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    const [result, setResult] = useState<PurchaseImportResult>({
        drafts: [],
        errors: [],
        summary: { total: 0, valid: 0, invalid: 0 }
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const openModal = () => {
        setResult({ drafts: [], errors: [], summary: { total: 0, valid: 0, invalid: 0 } });
        setIsModalOpen(true);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const rawData = await purchaseImportService.parseFile(file);
            const processed = purchaseImportService.processImport(rawData, suppliers);
            setResult(processed);
        } catch (error) {
            console.error(error);
            notify('error', 'Erro ao ler o ficheiro Excel.');
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmImport = () => {
        if (result.drafts.length === 0) return;

        const currentYear = new Date().getFullYear();
        
        // Gerar IDs sequenciais reais
        let newPurchases: Purchase[] = [];
        // Note: In a real async scenario, fetching next ID in loop is tricky. 
        // Here we fetch base and increment.
        const baseId = db.purchases.getNextId(currentYear); // e.g., COMP-2024/005
        const [prefix, seqStr] = baseId.split('/');
        let seq = parseInt(seqStr);

        newPurchases = result.drafts.map((draft, idx) => {
            const newSeq = (seq + idx).toString().padStart(3, '0');
            return {
                ...draft,
                id: `${prefix}/${newSeq}`,
                // Ensure required fields
                status: 'Aberta',
                subtotal: draft.total || 0,
                taxTotal: 0,
                items: draft.items || [],
                supplierId: draft.supplierId || 0,
                supplierName: draft.supplierName || 'Fornecedor Desconhecido',
                date: draft.date || new Date().toISOString().split('T')[0],
                dueDate: draft.dueDate || new Date().toISOString().split('T')[0],
            } as Purchase;
        });

        setPurchases(prev => [...newPurchases, ...prev]);
        notify('success', `${newPurchases.length} compras importadas com sucesso.`);
        setIsModalOpen(false);
    };

    return {
        isModalOpen,
        setIsModalOpen,
        openModal,
        isLoading,
        result,
        handleFileSelect,
        confirmImport,
        fileInputRef
    };
};
