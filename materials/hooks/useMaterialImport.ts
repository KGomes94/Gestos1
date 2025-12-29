
import React, { useState, useRef } from 'react';
import { Material } from '../../types';
import { materialImportService, MaterialImportResult } from '../services/materialImportService';
import { useNotification } from '../../contexts/NotificationContext';
import { db } from '../../services/db';

export const useMaterialImport = (
    materials: Material[],
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>
) => {
    const { notify } = useNotification();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    const [result, setResult] = useState<MaterialImportResult>({
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
            const rawData = await materialImportService.parseFile(file);
            const processed = materialImportService.processImport(rawData, materials);
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

        // Gerar códigos automáticos para os que faltam
        let nextMatSeq = 0; // Optimization: Fetch once if needed, or rely on individual generation
        
        const newItems: Material[] = result.drafts.map((d, idx) => {
            let finalCode = d.internalCode;
            if (!finalCode) {
                // Se não tiver código, geramos um temporário com base no timestamp + index para evitar colisão imediata
                // Idealmente, usaríamos db.materials.getNextCode, mas num loop síncrono pode gerar duplicados se a lógica não for robusta.
                // Vamos usar um prefixo IMP-
                finalCode = `IMP-${Date.now()}-${idx}`;
            }

            return {
                ...d,
                id: Date.now() + idx,
                name: d.name || 'Sem Nome',
                unit: d.unit || 'Un',
                price: d.price || 0,
                type: d.type || 'Material',
                internalCode: finalCode,
                stock: d.stock || 0,
                minStock: d.minStock || 0,
                observations: d.observations || ''
            } as Material;
        });

        setMaterials(prev => [...prev, ...newItems]);
        notify('success', `${newItems.length} itens importados com sucesso.`);
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
