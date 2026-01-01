
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
    
    let dateStr = new Date().toISOString().split('T')[0];
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000) + 43200000);
        dateStr = isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0];
    } else {
        const strVal = String(val).trim();
        if (strVal.match(/^\d{2}\/\d{2}\/\d{4}/)) {
            const parts = strVal.split('/');
            dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else if (!isNaN(new Date(strVal).getTime())) {
            dateStr = new Date(strVal).toISOString().split('T')[0];
        }
    }
    return dateStr;
};

export const purchaseImportService = {
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

    processImport: (rawData: any[], suppliers: Client[]): PurchaseImportResult => {
        const drafts: Partial<Purchase>[] = [];
        const errors: Array<{ line: number; message: string; type: 'error' | 'warning' }> = [];

        rawData.forEach((row, index) => {
            const line = index + 2;
            const rowErrors: string[] = [];

            // Extraction
            const date = parseDate(findValue(row, ['date', 'data', 'emissao', 'dia']));
            const supplierName = String(findValue(row, ['supplier', 'fornecedor', 'nome', 'name']) || '').trim();
            const reference = String(findValue(row, ['reference', 'ref', 'fatura', 'doc_num']) || '').trim();
            const total = parseNumber(findValue(row, ['total', 'amount', 'valor', 'preco']));
            const desc = String(findValue(row, ['description', 'desc', 'descricao', 'item']) || 'Compra Importada').trim();
            const dueDate = parseDate(findValue(row, ['due_date', 'vencimento', 'limite']));
            const nif = String(findValue(row, ['nif', 'vat', 'contribuinte']) || '').replace(/[^0-9]/g, '');

            // Validation
            if (!date) rowErrors.push("Data inválida");
            if (!supplierName) rowErrors.push("Nome do fornecedor é obrigatório");
            if (total <= 0) rowErrors.push("Valor deve ser maior que zero");

            if (rowErrors.length > 0) {
                rowErrors.forEach(msg => errors.push({ line, message: msg, type: 'error' }));
                return;
            }

            // Find or create supplier logic handled in hook usually, here we just match
            let supplierId = 0;
            const supplier = suppliers.find(s => s.nif === nif || s.company.toLowerCase() === supplierName.toLowerCase());
            if (supplier) {
                supplierId = supplier.id;
            }

            drafts.push({
                date,
                dueDate: dueDate || date,
                supplierName,
                supplierId, // 0 if new
                referenceDocument: reference,
                total,
                items: [{
                    id: Date.now() + index,
                    description: desc,
                    quantity: 1,
                    unitPrice: total,
                    total: total,
                    taxRate: 0,
                    itemCode: ''
                }],
                status: 'Aberta'
            });
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
