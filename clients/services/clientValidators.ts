
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
                // Se não for vazio, tem de ter 9 digitos
                if (cleanNif.length > 0 && (cleanNif.length !== 9 || isNaN(Number(cleanNif)))) {
                    errors.nif = "NIF inválido (deixe vazio se desconhecido).";
                }
            }

            // Morada é OPCIONAL para domésticos na importação/criação
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

        // Apenas verifica duplicação se o NIF existir, não for vazio E NÃO FOR O GENÉRICO (999999999)
        if (newClient.nif && newClient.nif.trim() !== '' && newClient.nif !== '999999999') {
            const nifExists = others.find(c => c.nif === newClient.nif);
            if (nifExists) return `NIF já registado para: ${nifExists.company}`;
        }

        return null;
    }
};
