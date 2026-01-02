import * as XLSX from 'xlsx';
import { RawImportData } from '../types/import';

/**
 * Serviço base para importação de Excel/CSV
 * Centraliza lógica comum para todos os módulos (Invoice, Material, Client, Purchase)
 * 
 * Reduz duplicação e garante consistência em todo o codebase
 */
export const baseImportService = {
    /**
     * Parse genérico para ficheiros Excel/CSV
     * 
     * @param file Ficheiro Excel/CSV a processar
     * @returns Promise com array de objetos
     * 
     * @example
     * const data = await baseImportService.parseFile(file);
     */
    parseFile: (file: File): Promise<RawImportData> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });

                    if (!workbook.SheetNames.length) {
                        reject(new Error('Ficheiro Excel vazio'));
                        return;
                    }

                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];

                    if (json.length === 0) {
                        reject(new Error('Nenhum dado encontrado na primeira folha'));
                        return;
                    }

                    const headers = Object.keys(json[0] || {});
                    resolve({
                        headers,
                        rows: json,
                        fileName: file.name,
                        fileSize: file.size,
                        sheetName,
                    });
                } catch (error) {
                    reject(new Error(`Erro ao processar ficheiro Excel: ${error}`));
                }
            };

            reader.onerror = (error) => {
                reject(new Error(`Erro ao ler ficheiro: ${error}`));
            };

            reader.readAsArrayBuffer(file);
        });
    },


    /**
     * Encontra valor em linha Excel, testando múltiplas variações de nomes
     * 
     * @param row Linha do Excel
     * @param keys Possíveis nomes da coluna (ex: ['name', 'nome', 'client_name'])
     * @returns Valor encontrado ou undefined
     * 
     * @example
     * const name = baseImportService.findValue(row, ['name', 'nome', 'client_name']);
     */
    findValue: (row: any, keys: string[]): any => {
        if (!row || typeof row !== 'object') return undefined;

        const rowKeys = Object.keys(row);

        // Busca exata (ignorando case)
        for (const key of keys) {
            const exactMatch = rowKeys.find(
                k => k.trim().toLowerCase() === key.toLowerCase()
            );

            if (exactMatch) {
                const value = row[exactMatch];

                // Aceita qualquer valor que não seja null/undefined vazio
                if (value !== undefined && value !== null && value !== '') {
                    return value;
                }
            }
        }

        return undefined;
    },

    /**
     * Como findValue, mas retorna sempre string
     * 
     * @example
     * const name = baseImportService.findStringValue(row, ['name', 'nome']);
     */
    findStringValue: (row: any, keys: string[]): string => {
        const value = baseImportService.findValue(row, keys);

        if (value === undefined || value === null) {
            return '';
        }

        return String(value).trim();
    },

    /**
     * Parse robusto de datas com suporte a múltiplos formatos
     * 
     * Suporta:
     * - "2024-01-15" (ISO)
     * - "15/01/2024" (Português)
     * - "01-15-2024" (Americano)
     * - 45324 (Número serial Excel)
     * - Date object
     * 
     * @param val Data em qualquer formato
     * @param defaultDate Data padrão se inválida (atual por padrão)
     * @returns Data em formato ISO string (YYYY-MM-DD)
     */
    parseDate: (val: any, defaultDate?: string): string => {
        if (!val) {
            return defaultDate || new Date().toISOString().split('T')[0];
        }

        // Se é número, assume formato Excel (dias desde 1900-01-01)
        if (typeof val === 'number') {
            try {
                const date = new Date((val - 25569) * 86400 * 1000);
                const iso = date.toISOString().split('T')[0];
                // Validar se resultado parece razoável
                const year = parseInt(iso.split('-')[0]);
                if (year >= 1900 && year <= 2100) {
                    return iso;
                }
            } catch {
                // Fallback
            }
        }

        // Se é string, tentar parse direto
        if (typeof val === 'string') {
            const trimmed = val.trim();

            // Tentar formato ISO direto
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                const parsed = new Date(trimmed);
                if (!isNaN(parsed.getTime())) return trimmed;
            }

            // Tentar formato português (DD/MM/YYYY)
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
                const [day, month, year] = trimmed.split('/');
                const parsed = new Date(`${year}-${month}-${day}`);
                if (!isNaN(parsed.getTime())) {
                    return parsed.toISOString().split('T')[0];
                }
            }

            // Tentar Date parse nativo
            const parsed = new Date(trimmed);
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
            }
        }

        // Se é objeto Date
        if (val instanceof Date && !isNaN(val.getTime())) {
            return val.toISOString().split('T')[0];
        }

        return defaultDate || new Date().toISOString().split('T')[0];
    },

    /**
     * Parse robusto de números
     * 
     * @param val Valor a converter
     * @param defaultValue Valor padrão se inválido
     * @returns Número com 2 casas decimais
     * 
     * @example
     * const amount = baseImportService.parseNumber('1.234,56'); // 1234.56
     */
    parseNumber: (val: any, defaultValue: number = 0): number => {
        if (val === undefined || val === null || val === '') {
            return defaultValue;
        }

        if (typeof val === 'number') {
            return Math.round(val * 100) / 100;
        }

        if (typeof val === 'string') {
            // Remove formatação comum (ex: "1.234,56" ou "1,234.56")
            const cleaned = val
                .replace(/\./g, '') // Remove todos os pontos
                .replace(',', '.')  // Converte última vírgula em ponto
                .trim();

            const num = parseFloat(cleaned);
            return isNaN(num) ? defaultValue : Math.round(num * 100) / 100;
        }

        return defaultValue;
    },

    /**
     * Parse robusto de booleanos
     * 
     * @param val Valor a converter
     * @returns true se for reconhecido como "sim" ou similar
     * 
     * @example
     * const applyRetention = baseImportService.parseBoolean('SIM'); // true
     */
    parseBoolean: (val: any): boolean => {
        if (typeof val === 'boolean') return val;

        if (typeof val === 'number') return val !== 0;

        if (typeof val === 'string') {
            const lower = val.toLowerCase().trim();
            return ['true', 'sim', 's', '1', 'yes', 'y'].includes(lower);
        }

        return false;
    },

    /**
     * Validadores comuns reutilizáveis
     */
    validators: {
        /**
         * Campo obrigatório
         * @returns erro ou null se válido
         */
        required: (value: any, fieldName: string): string | null => {
            if (value === undefined || value === null) {
                return `${fieldName} é obrigatório.`;
            }

            if (typeof value === 'string' && value.trim().length === 0) {
                return `${fieldName} é obrigatório.`;
            }

            return null;
        },

        /**
         * Comprimento mínimo
         */
        minLength: (value: string, min: number, fieldName: string): string | null => {
            if (value.length < min) {
                return `${fieldName} deve ter pelo menos ${min} caracteres.`;
            }
            return null;
        },

        /**
         * Email válido
         */
        email: (value: string): string | null => {
            if (!value) return null;
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
                return 'Email inválido.';
            }
            return null;
        },

        /**
         * NIF válido (9 dígitos)
         */
        nif: (value: string): string | null => {
            if (!value) return null;
            const clean = value.replace(/[^0-9]/g, '');
            if (clean.length !== 9) {
                return 'NIF deve ter 9 dígitos.';
            }
            return null;
        },

        /**
         * Número positivo
         */
        positiveNumber: (value: number, fieldName: string): string | null => {
            if (value < 0) {
                return `${fieldName} não pode ser negativo.`;
            }
            return null;
        },

        /**
         * Valor dentro de intervalo
         */
        range: (
            value: number,
            min: number,
            max: number,
            fieldName: string
        ): string | null => {
            if (value < min || value > max) {
                return `${fieldName} deve estar entre ${min} e ${max}.`;
            }
            return null;
        }
    }
};
