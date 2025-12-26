
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

// Helper para encontrar valores no Excel com chaves flexíveis e prioridade exata
const findValue = (row: any, keys: string[]): any => {
    const rowKeys = Object.keys(row);
    
    // 1. Tentar correspondência exata primeiro (Case Insensitive)
    for (const key of keys) {
        const exactMatch = rowKeys.find(k => k.toLowerCase() === key.toLowerCase());
        if (exactMatch && row[exactMatch] !== undefined) return row[exactMatch];
    }

    // 2. Tentar correspondência parcial (trimmed) se não encontrou exata
    for (const key of keys) {
        const found = rowKeys.find(k => k.trim().toLowerCase() === key.trim().toLowerCase());
        if (found && row[found] !== undefined) return row[found];
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

            const name = String(findValue(row, ['name', 'nome', 'responsavel', 'cliente', 'client']) || '').trim();
            const company = String(findValue(row, ['company', 'empresa', 'company_name', 'entidade']) || '').trim();
            
            // Limpeza de NIF (Remove espaços "999 999 999" -> "999999999")
            let nif = String(findValue(row, ['nif', 'vat', 'contribuinte', 'tax_id']) || '').replace(/\s/g, '').trim();
            
            // Se NIF for "0", "N/A", "undefined" ou curto demais, assumir vazio
            if (nif === '0' || nif.toLowerCase() === 'n/a' || nif.toLowerCase() === 'undefined' || nif.length < 5) nif = '';

            // CRÍTICO: Se a linha não tiver Nome, nem Empresa, nem NIF, ignorar completamente (linha vazia/lixo)
            if (!name && !company && !nif) {
                return;
            }

            // 1. Mapeamento Inteligente de Tipos
            const typeRaw = String(findValue(row, ['type', 'tipo', 'client_type', 'categoria', 'category']) || 'Doméstico').toUpperCase().trim();
            const isEmpresarial = typeRaw.includes('EMP') || 
                                  typeRaw.includes('COLETIVA') || 
                                  typeRaw.includes('SOCIEDADE') || 
                                  typeRaw.includes('LDA') ||
                                  typeRaw.includes('SA') ||
                                  typeRaw.includes('UNIPESSOAL');
            
            const type: ClientType = isEmpresarial ? 'Empresarial' : 'Doméstico';
            
            // Lógica de Nome/Empresa
            let finalName = name;
            let finalCompany = company;
            
            if (type === 'Empresarial' && !finalCompany) finalCompany = finalName; 
            if (type === 'Doméstico' && !finalName) finalName = finalCompany; 
            if (type === 'Doméstico') finalCompany = finalName; 

            // Tratamento de Morada
            let address = String(findValue(row, ['address', 'morada', 'endereco', 'localidade']) || '').trim();
            const city = String(findValue(row, ['city', 'cidade', 'zona', 'concelho']) || '').trim();
            
            if (address && city && !address.toLowerCase().includes(city.toLowerCase())) {
                address = `${address}, ${city}`;
            } else if (!address && city) {
                address = city;
            }

            const clientDraft: Partial<Client> = {
                id: Date.now() + index, 
                type,
                name: finalName,
                company: finalCompany,
                nif: nif,
                email: String(findValue(row, ['email', 'mail', 'e-mail']) || '').trim(),
                phone: String(findValue(row, ['phone', 'telefone', 'telemovel', 'celular', 'contact']) || '').trim(),
                address: address,
                notes: String(findValue(row, ['notes', 'notas', 'obs', 'observacoes']) || '').trim(),
                history: []
            };

            // 2. Validação Estrutural
            const validation = clientValidators.validate(clientDraft);
            if (!validation.isValid) {
                Object.values(validation.errors).forEach(msg => {
                    errors.push({ line, message: msg, type: 'error' });
                });
                return; 
            }

            // 3. Verificação de Duplicados
            // Apenas verifica se NIF existe, não é vazio e NÃO é o genérico 999999999
            if (clientDraft.nif && clientDraft.nif.length > 0 && clientDraft.nif !== '999999999') {
                const duplicateMsg = clientValidators.checkDuplicate(clientDraft, existingClients);
                if (duplicateMsg) {
                    errors.push({ line, message: `Ignorado: ${duplicateMsg}`, type: 'warning' });
                    return; 
                }

                // Verificar duplicados dentro do próprio ficheiro (ignora generic)
                const internalDupe = drafts.find(d => d.nif === clientDraft.nif && d.nif !== '' && d.nif !== '999999999');
                if (internalDupe) {
                    errors.push({ line, message: `NIF ${clientDraft.nif} duplicado no ficheiro (já existe na linha importada anteriormente).`, type: 'error' });
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
