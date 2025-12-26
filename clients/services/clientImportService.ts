
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

// Helper robusto para encontrar valores
const findValue = (row: any, keys: string[]): any => {
    const rowKeys = Object.keys(row);
    
    // 1. Prioridade Absoluta: Correspondência Exata (Case Insensitive)
    for (const key of keys) {
        const exactMatch = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
        if (exactMatch && row[exactMatch] !== undefined) return row[exactMatch];
    }

    // 2. Prioridade Secundária: Contém a string (ex: "Mobile Phone" matches "phone")
    for (const key of keys) {
        if (key.length <= 2) continue; // Ignorar chaves muito curtas para evitar falsos positivos
        const partialMatch = rowKeys.find(k => k.trim().toLowerCase().includes(key.toLowerCase()));
        if (partialMatch && row[partialMatch] !== undefined) return row[partialMatch];
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
                    // Defval: "" garante que células vazias não "desapareçam" do JSON se houver headers
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

            // 1. Extração de Dados Brutos
            const nameRaw = String(findValue(row, ['name', 'nome', 'responsavel', 'cliente', 'client', 'contact']) || '').trim();
            const companyRaw = String(findValue(row, ['company', 'empresa', 'company_name', 'entidade', 'business']) || '').trim();
            
            // Limpeza de NIF
            let nifRaw = String(findValue(row, ['nif', 'vat', 'contribuinte', 'tax_id', 'tax']) || '').replace(/[^0-9]/g, '');
            // Tratamento de NIFs inválidos/vazios comuns
            if (nifRaw === '0' || nifRaw.length < 5) nifRaw = '';

            // 2. Deteção de Linha Vazia (Rigida)
            // Se não tem Nome, nem Empresa, nem NIF, é lixo.
            if (!nameRaw && !companyRaw && !nifRaw) {
                return;
            }

            // 3. Determinação do Tipo de Cliente
            const typeRaw = String(findValue(row, ['type', 'tipo', 'client_type', 'categoria', 'category']) || '').toUpperCase().trim();
            
            let type: ClientType = 'Doméstico';
            // Se a coluna Type diz explicitamente
            if (typeRaw.includes('EMP') || typeRaw.includes('COLETIVA') || typeRaw.includes('SOCIEDADE') || typeRaw.includes('LDA')) {
                type = 'Empresarial';
            } 
            // Fallback: Se não diz nada, mas tem nome de empresa preenchido e NIF válido que não é o genérico
            else if (!typeRaw && companyRaw && nifRaw && nifRaw !== '999999999') {
                type = 'Empresarial';
            }

            // 4. Lógica de Nome vs Empresa
            let finalName = nameRaw;
            let finalCompany = companyRaw;

            if (type === 'Empresarial') {
                if (!finalCompany) finalCompany = finalName; // Se só veio nome, assume que é o nome da empresa
                if (!finalName) finalName = finalCompany;    // Se só veio empresa, assume que o contacto é a empresa
            } else {
                // Doméstico
                if (!finalName) finalName = finalCompany;
                finalCompany = finalName; // Para domésticos, empresa = nome para display
            }

            // 5. Outros Campos
            const email = String(findValue(row, ['email', 'mail', 'e-mail', 'correio']) || '').trim();
            const phone = String(findValue(row, ['phone', 'telefone', 'telemovel', 'celular', 'contact', 'mobile']) || '').trim();
            const notes = String(findValue(row, ['notes', 'notas', 'obs', 'observacoes', 'comments']) || '').trim();
            
            // Tratamento de Morada
            let address = String(findValue(row, ['address', 'morada', 'endereco', 'localidade', 'rua']) || '').trim();
            const city = String(findValue(row, ['city', 'cidade', 'zona', 'concelho']) || '').trim();
            
            // Se cidade existe e não está inclusa na morada, concatena
            if (city && !address.toLowerCase().includes(city.toLowerCase())) {
                address = address ? `${address}, ${city}` : city;
            }

            const clientDraft: Partial<Client> = {
                id: Date.now() + index, // ID temporário
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

            // 6. Validação Estrutural (Campos obrigatórios)
            const validation = clientValidators.validate(clientDraft);
            if (!validation.isValid) {
                // Apenas erros estruturais graves impedem o draft (ex: falta de nome)
                if (validation.errors.name || validation.errors.company) {
                    Object.values(validation.errors).forEach(msg => {
                        errors.push({ line, message: msg, type: 'error' });
                    });
                    return;
                }
                // Outros erros (ex: email inválido) podem passar como warning ou ser corrigidos depois
            }

            // 7. Verificação de Duplicados (NIF)
            // REGRA: Só verifica se NIF existe, não é vazio E NÃO É O GENÉRICO 999999999
            if (clientDraft.nif && clientDraft.nif !== '999999999') {
                // Check BD existente
                const duplicateMsg = clientValidators.checkDuplicate(clientDraft, existingClients);
                if (duplicateMsg) {
                    errors.push({ line, message: `Ignorado: ${duplicateMsg}`, type: 'warning' });
                    return; 
                }

                // Check duplicado interno no ficheiro (ignora se for 999999999)
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
