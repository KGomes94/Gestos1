
import { Client, ClientType } from '../../types';

export interface ValidationResult {
    isValid: boolean;
    errors: Record<string, string>;
}

export const clientValidators = {
    validate: (client: Partial<Client>): ValidationResult => {
        const errors: Record<string, string> = {};

        // 1. Identificação Básica
        if (client.type === 'Empresarial') {
            if (!client.company || client.company.trim().length < 2) {
                errors.company = "Nome da empresa é obrigatório.";
            }
            // Para empresas, NIF é geralmente mandatório num ERP
            if (!client.nif || client.nif.length !== 9 || isNaN(Number(client.nif))) {
                errors.nif = "NIF deve ter 9 dígitos numéricos.";
            }
        } else {
            if (!client.name || client.name.trim().length < 2) {
                errors.name = "Nome completo é obrigatório.";
            }
        }

        // 2. Contactos
        if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
            errors.email = "Formato de email inválido.";
        }

        if (client.phone && client.phone.length < 3) {
            errors.phone = "Telefone inválido.";
        }

        // 3. Localização
        if (!client.address || client.address.trim().length < 3) {
            errors.address = "Morada é obrigatória para faturação.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    /**
     * Verifica duplicados na lista existente
     */
    checkDuplicate: (newClient: Partial<Client>, existingClients: Client[]): string | null => {
        // Ignorar o próprio ID se for edição
        const others = existingClients.filter(c => c.id !== newClient.id);

        if (newClient.nif) {
            const nifExists = others.find(c => c.nif === newClient.nif);
            if (nifExists) return `NIF já registado para: ${nifExists.company}`;
        }

        const nameToCheck = newClient.type === 'Empresarial' ? newClient.company : newClient.name;
        if (nameToCheck) {
            const nameExists = others.find(c => 
                (c.company?.toLowerCase() === nameToCheck.toLowerCase()) || 
                (c.name?.toLowerCase() === nameToCheck.toLowerCase())
            );
            // Aviso apenas por nome (pode ser homónimo), mas retornamos para decisão
            // return nameExists ? `Nome similar encontrado: ${nameExists.company}` : null;
        }

        return null;
    }
};
