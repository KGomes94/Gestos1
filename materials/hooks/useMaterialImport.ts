
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

        // 1. Determinar Sequências Atuais
        let maxMatCode = 0;
        let maxServCode = 0;

        materials.forEach(m => {
            if (m.internalCode) {
                if (m.internalCode.startsWith('M')) {
                    const num = parseInt(m.internalCode.substring(1));
                    if (!isNaN(num) && num > maxMatCode) maxMatCode = num;
                } else if (m.internalCode.startsWith('S')) {
                    const num = parseInt(m.internalCode.substring(1));
                    if (!isNaN(num) && num > maxServCode) maxServCode = num;
                }
            }
        });

        // 2. Processar Lógica: Atualizar Existente ou Criar Novo
        let updatedMaterials = [...materials];
        let addedCount = 0;
        let updatedCount = 0;

        result.drafts.forEach((draft) => {
            // Verificar duplicado por Código (se fornecido) ou Nome (se código vazio)
            let existingIndex = -1;

            if (draft.internalCode) {
                existingIndex = updatedMaterials.findIndex(m => m.internalCode === draft.internalCode);
            }
            
            if (existingIndex === -1 && draft.name) {
                // Fallback: Tenta encontrar por nome exato para evitar duplicar produtos iguais sem código
                existingIndex = updatedMaterials.findIndex(m => m.name.toLowerCase() === draft.name?.toLowerCase() && m.type === draft.type);
            }

            if (existingIndex !== -1) {
                // ATUALIZAR EXISTENTE
                const existing = updatedMaterials[existingIndex];
                updatedMaterials[existingIndex] = {
                    ...existing,
                    price: draft.price !== undefined && draft.price > 0 ? draft.price : existing.price,
                    stock: draft.stock !== undefined ? (existing.stock || 0) + draft.stock : existing.stock, // Soma stock importado? Ou substitui? Vamos substituir para "importação de inventário"
                    // Nota: Se fosse "entrada de stock" somaria, mas importação costuma ser "estado atual".
                    // Mas para segurança, se o user importou preço, atualizamos preço.
                    unit: draft.unit || existing.unit,
                    observations: draft.observations ? `${existing.observations || ''} | ${draft.observations}` : existing.observations,
                    updatedAt: new Date().toISOString()
                };
                updatedCount++;
            } else {
                // CRIAR NOVO
                let finalCode = draft.internalCode;
                
                // Gerar Código se vazio
                if (!finalCode) {
                    if (draft.type === 'Material') {
                        maxMatCode++;
                        finalCode = `M${maxMatCode.toString().padStart(6, '0')}`;
                    } else {
                        maxServCode++;
                        finalCode = `S${maxServCode.toString().padStart(6, '0')}`;
                    }
                }

                const newItem: Material = {
                    id: Date.now() + Math.random(), // Ensure unique ID
                    name: draft.name || 'Item Sem Nome',
                    type: draft.type as 'Material' | 'Serviço',
                    internalCode: finalCode,
                    unit: draft.unit || 'Un',
                    price: draft.price || 0,
                    stock: draft.stock || 0,
                    minStock: draft.minStock || 0,
                    observations: draft.observations || '',
                    createdAt: new Date().toISOString()
                };

                updatedMaterials.push(newItem);
                addedCount++;
            }
        });

        setMaterials(updatedMaterials);
        notify('success', `Importação concluída: ${addedCount} novos, ${updatedCount} atualizados.`);
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
