
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
                // Se for empresarial e não tiver nome de empresa, usamos o nome como fallback, mas validamos
                if (!client.name || client.name.trim().length < 2) {
                    errors.company = "Nome da empresa ou responsável é obrigatório.";
                }
            }
            
            // Para empresas, NIF é mandatório, exceto se for estrangeiro (mas regra geral pede 9 digitos)
            // Permitimos passar se for vazio na importação para permitir correção posterior, mas idealmente seria erro.
            if (client.nif && client.nif.length > 0 && (client.nif.length !== 9 || isNaN(Number(client.nif)))) {
                errors.nif = "NIF de empresa deve ter 9 dígitos numéricos.";
            }
        } else {
            // Doméstico / Singular
            if (!client.name || client.name.trim().length < 2) {
                errors.name = "Nome completo é obrigatório.";
            }
            
            // NIF Opcional para Doméstico, mas se preenchido, deve ser válido
            if (client.nif && client.nif.trim() !== '') {
                const cleanNif = client.nif.replace(/\s/g, '');
                if (cleanNif.length > 0 && (cleanNif.length !== 9 || isNaN(Number(cleanNif)))) {
                    errors.nif = "NIF inválido (deixe vazio se desconhecido).";
                }
            }
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
     * EXCEÇÃO: NIF 999999999 é permitido duplicar (Cliente Final/Indiferenciado)
     */
    checkDuplicate: (newClient: Partial<Client>, existingClients: Client[]): string | null => {
        // Se NIF for vazio ou o genérico, NÃO verificar duplicado
        if (!newClient.nif || newClient.nif.trim() === '' || newClient.nif === '999999999') {
            return null;
        }

        // Ignorar o próprio ID se for edição
        const others = existingClients.filter(c => c.id !== newClient.id);

        const nifExists = others.find(c => c.nif === newClient.nif);
        if (nifExists) return `NIF já registado para: ${nifExists.company}`;

        return null;
    }
};
