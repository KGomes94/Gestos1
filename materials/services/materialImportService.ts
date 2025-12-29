
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
        if (row[key] !== undefined) return row[key];
        const found = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
        if (found) return row[found];
    }
    return undefined;
};

const parseNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(',', '.');
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
            const name = findValue(row, ['name', 'nome', 'descricao', 'description', 'item']);
            let typeStr = String(findValue(row, ['type', 'tipo', 'categoria']) || 'Material');
            const code = findValue(row, ['code', 'codigo', 'ref', 'referencia']);
            const unit = findValue(row, ['unit', 'unidade', 'un']) || 'Un';
            const price = parseNumber(findValue(row, ['price', 'preco', 'valor', 'unit_price']));
            const stock = parseNumber(findValue(row, ['stock', 'qtd', 'quantidade']));
            const minStock = parseNumber(findValue(row, ['min', 'minimo', 'alerta']));
            const obs = findValue(row, ['obs', 'notas', 'observations']) || '';

            // 2. Validação
            if (!name) rowErrors.push("Nome é obrigatório");
            if (price < 0) rowErrors.push("Preço não pode ser negativo");

            // Normalização do Tipo
            let type: 'Material' | 'Serviço' = 'Material';
            if (typeStr.toLowerCase().includes('serv') || typeStr.toLowerCase().includes('mão')) {
                type = 'Serviço';
            }

            // Geração de Código se não existir
            let internalCode = code ? String(code) : '';
            
            // Duplicate Check (by Code or Name)
            if (internalCode) {
                const dup = existingMaterials.find(m => m.internalCode === internalCode);
                if (dup) rowErrors.push(`Código ${internalCode} já existe no sistema.`);
            }

            if (rowErrors.length > 0) {
                rowErrors.forEach(msg => errors.push({ line, message: msg, type: 'error' }));
                return;
            }

            // Create Draft
            drafts.push({
                id: Date.now() + index, // Temp ID
                name: String(name),
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
