
import * as XLSX from 'xlsx';
import { Purchase, Client, PurchaseStatus } from '../../types';
import { db } from '../../services/db';

export interface ImportPurchaseRow {
    row_index: number;
    date: string;
    supplier_name: string;
    supplier_nif: string;
    reference: string; // Ref do Fornecedor
    description: string;
    amount: number;
    category: string;
    due_date: string;
    isValid: boolean;
    errors: string[];
}

export interface PurchaseImportResult {
    drafts: Partial<Purchase>[];
    errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>;
    summary: { total: number; valid: number; invalid: number };
}

// Helpers
const findValue = (row: any, keys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        if (row[key] !== undefined) return row[key];
        const found = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
        if (found) return row[found];
    }
    return undefined;
};

const parseNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim().replace(/[^0-9.,-]/g, '');
    if (str.includes(',') && str.includes('.')) {
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) str = str.replace(/\./g, '').replace(',', '.');
        else str = str.replace(/,/g, '');
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

const parseDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000) + 43200000);
        return isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    // Tenta formato PT DD/MM/AAAA
    if (str.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/)) {
        const parts = str.split(/[\/-]/);
        return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
};

export const purchaseImportService = {
    parseFile: async (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    resolve(XLSX.utils.sheet_to_json(sheet));
                } catch (error) { reject(error); }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    },

    processImport: (rawData: any[], suppliers: Client[]): PurchaseImportResult => {
        const drafts: Partial<Purchase>[] = [];
        const errors: Array<{ line: number; message: string; type: 'error' | 'warning' }> = [];

        rawData.forEach((row, index) => {
            const line = index + 2;
            const rowErrors: string[] = [];

            // 1. Extração
            const date = parseDate(findValue(row, ['date', 'data', 'emissao']));
            const supplierName = String(findValue(row, ['supplier', 'fornecedor', 'entidade', 'nome']) || '');
            const supplierNif = String(findValue(row, ['nif', 'vat', 'contribuinte']) || '').replace(/[^0-9]/g, '');
            const ref = String(findValue(row, ['ref', 'referencia', 'fatura', 'doc', 'numero']) || '');
            const desc = String(findValue(row, ['desc', 'descricao', 'item']) || 'Compra Importada');
            const amount = Math.abs(parseNumber(findValue(row, ['amount', 'valor', 'total', 'preco'])));
            const dueDate = parseDate(findValue(row, ['due', 'vencimento', 'limite']) || date);

            // 2. Validação Básica
            if (!supplierName && !supplierNif) rowErrors.push("Fornecedor obrigatório (Nome ou NIF).");
            if (amount <= 0) rowErrors.push("Valor deve ser maior que zero.");

            // 3. Matching de Fornecedor
            let supplier = suppliers.find(s => s.nif === supplierNif && s.nif !== '');
            if (!supplier && supplierName) {
                supplier = suppliers.find(s => s.company.toLowerCase().includes(supplierName.toLowerCase()));
            }

            if (rowErrors.length > 0) {
                rowErrors.forEach(msg => errors.push({ line, message: msg, type: 'error' }));
                return;
            }

            // 4. Construção do Draft
            drafts.push({
                id: `IMP-${Date.now()}-${index}`,
                date,
                dueDate,
                supplierId: supplier?.id || 0, // 0 indica novo/desconhecido
                supplierName: supplier?.company || supplierName,
                supplierNif: supplier?.nif || supplierNif,
                referenceDocument: ref,
                status: 'Aberta', // Importadas assumem dívida por defeito
                total: amount,
                subtotal: amount,
                taxTotal: 0,
                items: [{
                    id: `ITEM-${index}`,
                    description: desc,
                    quantity: 1,
                    unitPrice: amount,
                    total: amount,
                    taxRate: 0
                }],
                notes: `Importado via Excel. Ref: ${ref}`
            });
        });

        return {
            drafts,
            errors,
            summary: {
                total: rawData.length,
                valid: drafts.length,
                invalid: errors.length
            }
        };
    }
};
