
import { useState, useRef } from 'react';
import { Client } from '../../types';
import { clientImportService, ClientImportResult } from '../services/clientImportService';
import { useNotification } from '../../contexts/NotificationContext';

export const useClientImport = (
    clients: Client[],
    setClients: React.Dispatch<React.SetStateAction<Client[]>>
) => {
    const { notify } = useNotification();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    const [result, setResult] = useState<ClientImportResult>({
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
            const rawData = await clientImportService.parseFile(file);
            const processed = clientImportService.processImport(rawData, clients);
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

        // Converter Partial<Client> para Client garantindo campos obrigatórios
        const newClients: Client[] = result.drafts.map(d => ({
            ...d,
            // Fallbacks de segurança final
            id: d.id || Date.now() + Math.random(),
            type: d.type || 'Doméstico',
            name: d.name || 'Sem Nome',
            company: d.company || 'Sem Empresa',
            email: d.email || '',
            phone: d.phone || '',
            address: d.address || '',
            history: []
        } as Client));

        setClients(prev => [...prev, ...newClients]);
        notify('success', `${newClients.length} clientes importados com sucesso.`);
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
