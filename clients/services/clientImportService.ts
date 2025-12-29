
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

// Helper Type Guard para verificar se um valor é string válida não vazia
const isNonEmptyString = (val: unknown): val is string => {
    return typeof val === 'string' && val.trim().length > 0;
};

// Helper robusto para encontrar valores e garantir tipo String limpa
const findStringValue = (row: any, keys: string[]): string => {
    const rowKeys = Object.keys(row);
    let val: any = undefined;

    // 1. Prioridade Absoluta: Correspondência Exata
    for (const key of keys) {
        const exactMatch = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
        if (exactMatch && row[exactMatch] !== undefined) {
            val = row[exactMatch];
            break;
        }
    }

    // 2. Fallback: Correspondência Parcial
    if (val === undefined) {
        for (const key of keys) {
            if (key.length <= 2) continue;
            const partialMatch = rowKeys.find(k => k.trim().toLowerCase().includes(key.toLowerCase()));
            if (partialMatch && row[partialMatch] !== undefined) {
                val = row[partialMatch];
                break;
            }
        }
    }

    if (val === undefined || val === null) return '';
    return String(val).trim();
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
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
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
            const line = index + 2; // Offset cabeçalho Excel

            // 1. Extração de Dados Brutos com Type Guards implícitos no findStringValue
            const nameRaw = findStringValue(row, ['name', 'nome', 'responsavel', 'cliente', 'client', 'contact']);
            const companyRaw = findStringValue(row, ['company', 'empresa', 'company_name', 'entidade', 'business']);
            
            // Limpeza de NIF (Remove espaços e traços)
            let nifRaw = findStringValue(row, ['nif', 'vat', 'contribuinte', 'tax_id', 'tax']).replace(/[^0-9]/g, '');
            if (nifRaw === '0' || nifRaw.length < 5) nifRaw = ''; // Invalidar NIFs curtos/zero

            // 2. Deteção de Linha Vazia (Strict Check)
            if (!nameRaw && !companyRaw && !nifRaw) {
                return;
            }

            // 3. Determinação do Tipo de Cliente
            const typeRaw = findStringValue(row, ['type', 'tipo', 'client_type', 'categoria', 'category']).toUpperCase();
            
            let type: ClientType = 'Doméstico';
            if (typeRaw.includes('EMP') || typeRaw.includes('COLETIVA') || typeRaw.includes('SOCIEDADE') || typeRaw.includes('LDA')) {
                type = 'Empresarial';
            } 
            else if (!typeRaw && companyRaw && nifRaw && nifRaw !== '999999999') {
                type = 'Empresarial';
            }

            // 4. Lógica de Snapshot Nome vs Empresa
            let finalName = nameRaw;
            let finalCompany = companyRaw;

            if (type === 'Empresarial') {
                if (!finalCompany) finalCompany = finalName;
                if (!finalName) finalName = finalCompany;
            } else {
                if (!finalName) finalName = finalCompany;
                finalCompany = finalName;
            }

            const email = findStringValue(row, ['email', 'mail', 'e-mail']);
            const phone = findStringValue(row, ['phone', 'telefone', 'telemovel', 'celular', 'contact']);
            const notes = findStringValue(row, ['notes', 'notas', 'obs']);
            
            let address = findStringValue(row, ['address', 'morada', 'endereco', 'rua']);
            const city = findStringValue(row, ['city', 'cidade', 'zona', 'concelho']);
            
            if (city && !address.toLowerCase().includes(city.toLowerCase())) {
                address = address ? `${address}, ${city}` : city;
            }

            const clientDraft: Partial<Client> = {
                id: Date.now() + index,
                type,
                name: finalName,
                company: finalCompany,
                nif: nifRaw,
                email,
                phone,
                address,
                notes,
                history: []
            };

            // 6. Validação Estrutural
            const validation = clientValidators.validate(clientDraft);
            if (!validation.isValid) {
                if (validation.errors.name || validation.errors.company) {
                    Object.values(validation.errors).forEach(msg => {
                        errors.push({ line, message: msg, type: 'error' });
                    });
                    return;
                }
            }

            // 7. Verificação de Duplicados
            if (clientDraft.nif && clientDraft.nif !== '999999999') {
                const duplicateMsg = clientValidators.checkDuplicate(clientDraft, existingClients);
                if (duplicateMsg) {
                    errors.push({ line, message: `Ignorado: ${duplicateMsg}`, type: 'warning' });
                    return; 
                }

                const internalDupe = drafts.find(d => d.nif === clientDraft.nif && d.nif !== '999999999');
                if (internalDupe) {
                    errors.push({ 
                        line, 
                        message: `NIF ${clientDraft.nif} repetido no ficheiro. Linha ignorada.`, 
                        type: 'warning' 
                    });
                    return;
                }
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
