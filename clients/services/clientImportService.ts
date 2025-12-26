
import * as XLSX from 'xlsx';
import { Client, ClientType } from '../../types';
import { clientValidators } from './clientValidators';

export interface ImportClientRow {
    row_index: number;
    name: string;
    company_name: string;
    client_type: string;
    nif: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    notes: string;
    active: boolean;
}

export interface ClientImportResult {
    drafts: Partial<Client>[];
    errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>;
    summary: { total: number; valid: number; invalid: number };
}

// Helper para encontrar valores no Excel com chaves flexíveis
const findValue = (row: any, keys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        if (row[key] !== undefined) return row[key];
        const found = rowKeys.find(k => k.trim().toLowerCase() === key.trim().toLowerCase());
        if (found) return row[found];
    }
    return undefined;
};

export const clientImportService = {
    parseFile: async (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet);
                    resolve(json);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    },

    processImport: (rawData: any[], existingClients: Client[]): ClientImportResult => {
        const drafts: Partial<Client>[] = [];
        const errors: Array<{ line: number; message: string; type: 'error' | 'warning' }> = [];

        rawData.forEach((row, index) => {
            const line = index + 2; // Excel header offset

            // 1. Mapeamento
            const typeRaw = String(findValue(row, ['type', 'tipo', 'client_type']) || 'Doméstico').toUpperCase();
            const type: ClientType = typeRaw.includes('EMP') ? 'Empresarial' : 'Doméstico';
            
            const name = String(findValue(row, ['name', 'nome', 'responsavel']) || '').trim();
            const company = String(findValue(row, ['company', 'empresa', 'company_name']) || '').trim();
            const nif = String(findValue(row, ['nif', 'vat', 'contribuinte']) || '').replace(/\s/g, '');
            
            // Lógica de Nome/Empresa
            let finalName = name;
            let finalCompany = company;
            
            if (type === 'Empresarial' && !finalCompany) finalCompany = finalName; 
            if (type === 'Doméstico' && !finalName) finalName = finalCompany; 
            if (type === 'Doméstico') finalCompany = finalName; // Fallback para manter consistência de display

            const clientDraft: Partial<Client> = {
                id: Date.now() + index, // ID temporário
                type,
                name: finalName,
                company: finalCompany,
                nif: nif,
                email: String(findValue(row, ['email', 'mail']) || '').trim(),
                phone: String(findValue(row, ['phone', 'telefone', 'telemovel', 'celular']) || '').trim(),
                address: String(findValue(row, ['address', 'morada', 'endereco']) || '').trim(),
                notes: String(findValue(row, ['notes', 'notas', 'obs']) || '').trim(),
                history: []
            };

            // 2. Validação Estrutural
            const validation = clientValidators.validate(clientDraft);
            if (!validation.isValid) {
                Object.values(validation.errors).forEach(msg => {
                    errors.push({ line, message: msg, type: 'error' });
                });
                return; // Pula este registo
            }

            // 3. Verificação de Duplicados
            const duplicateMsg = clientValidators.checkDuplicate(clientDraft, existingClients);
            if (duplicateMsg) {
                errors.push({ line, message: `Ignorado: ${duplicateMsg}`, type: 'warning' });
                return; // Pula duplicados
            }

            // Verificar duplicados dentro do próprio ficheiro
            const internalDupe = drafts.find(d => d.nif === clientDraft.nif && clientDraft.nif !== '');
            if (internalDupe) {
                errors.push({ line, message: `NIF duplicado no ficheiro (Linha anterior)`, type: 'error' });
                return;
            }

            drafts.push(clientDraft);
        });

        return {
            drafts,
            errors,
            summary: {
                total: rawData.length,
                valid: drafts.length,
                invalid: errors.filter(e => e.type === 'error').length
            }
        };
    }
};
