
import * as XLSX from 'xlsx';
import { Material } from '../../types';
import { db } from '../../services/db';

export interface ImportMaterialRow {
    row_index: number;
    name: string;
    type: string;
    internalCode: string;
    unit: string;
    price: number;
    stock: number;
    minStock: number;
    observations: string;
    isValid: boolean;
    errors: string[];
}

export interface MaterialImportResult {
    drafts: Partial<Material>[];
    errors: Array<{ line: number; message: string; type: 'error' | 'warning' }>;
    summary: { total: number; valid: number; invalid: number };
}

// Helpers
const findValue = (row: any, keys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        // Exact Match
        if (row[key] !== undefined) return row[key];
        
        // Case insensitive match
        const found = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
        if (found) return row[found];
    }
    return undefined;
};

const parseNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    
    if (typeof val === 'number') return val;
    
    // Convert string
    let str = String(val).trim();
    
    // Remove symbols (currency, etc) except dots, commas, minus
    str = str.replace(/[^0-9.,-]/g, '');

    // Handle formats:
    // 1.200,50 (PT) -> 1200.50
    // 1,200.50 (US) -> 1200.50
    // 1200 (Int) -> 1200
    
    const hasComma = str.includes(',');
    const hasDot = str.includes('.');

    if (hasComma && hasDot) {
        // Check which one is last (decimal separator)
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');
        
        if (lastComma > lastDot) {
            // 1.200,50 -> Remove dots, replace comma with dot
            str = str.replace(/\./g, '').replace(',', '.');
        } else {
            // 1,200.50 -> Remove commas
            str = str.replace(/,/g, '');
        }
    } else if (hasComma) {
        // Ambiguous: 1,200 (Thousand) or 1,20 (Decimal)?
        // Assumption for Price imports in CV/PT context: Comma is usually decimal if it's "Preço"
        // But excel sometimes exports "1200"
        
        // If there's only one comma and it's near the end (2 digits), assume decimal
        // 10,50 -> 10.5
        // 100,5 -> 100.5
        str = str.replace(',', '.');
    }
    // If only dot (10.50 or 1.000), JS parseFloat handles 10.50 well. 1.000 might be read as 1.

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

export const materialImportService = {
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

    processImport: (rawData: any[], existingMaterials: Material[]): MaterialImportResult => {
        const drafts: Partial<Material>[] = [];
        const errors: Array<{ line: number; message: string; type: 'error' | 'warning' }> = [];

        rawData.forEach((row, index) => {
            const line = index + 2;
            const rowErrors: string[] = [];

            // 1. Extração
            const name = findValue(row, ['name', 'nome', 'descricao', 'description', 'item', 'produto', 'servico']);
            let typeStr = String(findValue(row, ['type', 'tipo', 'categoria']) || 'Material');
            const code = findValue(row, ['code', 'codigo', 'ref', 'referencia', 'id']);
            const unit = findValue(row, ['unit', 'unidade', 'un', 'medida']) || 'Un';
            
            // Expanded price keys
            const price = parseNumber(findValue(row, ['price', 'preco', 'preço', 'valor', 'unit_price', 'pvp', 'custo', 'unitario']));
            
            const stock = parseNumber(findValue(row, ['stock', 'qtd', 'quantidade', 'existencia']));
            const minStock = parseNumber(findValue(row, ['min', 'minimo', 'alerta', 'stock_min']));
            const obs = findValue(row, ['obs', 'notas', 'observations']) || '';

            // 2. Validação
            if (!name) rowErrors.push("Nome/Descrição é obrigatório");
            if (price < 0) rowErrors.push("Preço não pode ser negativo");

            // Normalização do Tipo
            let type: 'Material' | 'Serviço' = 'Material';
            if (typeStr.toLowerCase().includes('serv') || typeStr.toLowerCase().includes('mão') || typeStr.toLowerCase().includes('obra')) {
                type = 'Serviço';
            }

            // Normalização do Código (limpeza)
            let internalCode = code ? String(code).trim() : '';
            
            if (rowErrors.length > 0) {
                rowErrors.forEach(msg => errors.push({ line, message: msg, type: 'error' }));
                return;
            }

            // Create Draft
            drafts.push({
                id: Date.now() + index, // Temp ID
                name: String(name).trim(),
                type,
                internalCode, // If empty, will be generated on save
                unit: String(unit),
                price,
                stock,
                minStock,
                observations: String(obs)
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
