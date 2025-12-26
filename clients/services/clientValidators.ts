
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
            // Para empresas, NIF é mandatório
            if (!client.nif || client.nif.length !== 9 || isNaN(Number(client.nif))) {
                errors.nif = "NIF de empresa deve ter 9 dígitos numéricos.";
            }
            // Para empresas, Morada é obrigatória (requisito fiscal)
            if (!client.address || client.address.trim().length < 3) {
                errors.address = "Morada da empresa é obrigatória.";
            }
        } else {
            // Doméstico / Singular
            if (!client.name || client.name.trim().length < 2) {
                errors.name = "Nome completo é obrigatório.";
            }
            
            // NIF Opcional para Doméstico, mas se preenchido, deve ser válido
            if (client.nif && client.nif.trim() !== '') {
                // Remove espaços para verificar
                const cleanNif = client.nif.replace(/\s/g, '');
                if (cleanNif.length !== 9 || isNaN(Number(cleanNif))) {
                    errors.nif = "NIF inválido (deixe vazio se desconhecido).";
                }
            }

            // Morada agora é OPCIONAL para domésticos na importação/criação
            // (Será pedida apenas se tentar emitir uma Faturação completa depois)
        }

        // 2. Contactos (Validação relaxada para importação)
        if (client.email && client.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
            errors.email = "Formato de email inválido.";
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

        if (newClient.nif && newClient.nif.trim() !== '') {
            const nifExists = others.find(c => c.nif === newClient.nif);
            if (nifExists) return `NIF já registado para: ${nifExists.company}`;
        }

        // Nome check (Opcional, pode gerar muitos falsos positivos em importações grandes)
        // Desativado por padrão para importação em massa para não bloquear homónimos legítimos
        /*
        const nameToCheck = newClient.type === 'Empresarial' ? newClient.company : newClient.name;
        if (nameToCheck) {
            const nameExists = others.find(c => 
                (c.company?.toLowerCase() === nameToCheck.toLowerCase()) || 
                (c.name?.toLowerCase() === nameToCheck.toLowerCase())
            );
            if (nameExists) return `Nome similar encontrado: ${nameExists.company}`;
        }
        */

        return null;
    }
};
