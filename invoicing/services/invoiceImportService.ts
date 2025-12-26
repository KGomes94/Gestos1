
import * as XLSX from 'xlsx';
import { DraftInvoice, InvoiceItem, Client, SystemSettings, InvoiceType } from '../../types';
import { invoicingCalculations } from './invoicingCalculations';
import { invoiceImportValidators, ImportRow, ValidationError } from './invoiceImportValidators';

interface ParsedInvoiceResult {
    drafts: DraftInvoice[];
    errors: ValidationError[];
    summary: {
        totalRows: number;
        validInvoices: number;
        invalidInvoices: number;
    };
}

// Helper para encontrar valores com chaves flexíveis
const findValue = (row: any, keys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        if (row[key] !== undefined) return row[key];
        // Case insensitive check
        const found = rowKeys.find(k => k.trim().toLowerCase() === key.trim().toLowerCase());
        if (found) return row[found];
        // Clean key check (remove underscores, etc)
        const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const foundClean = rowKeys.find(k => k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanKey);
        if (foundClean) return row[foundClean];
    }
    return undefined;
};

export const invoiceImportService = {
    /**
     * Parse Excel file content
     */
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

    /**
     * Map raw JSON to typed ImportRows
     */
    mapRows: (rawData: any[]): ImportRow[] => {
        return rawData.map((row, index) => {
            const dateVal = findValue(row, ['date', 'data', 'emissao', 'dia']);
            
            // Helper para data excel
            let dateStr = new Date().toISOString().split('T')[0];
            if (dateVal) {
                if (typeof dateVal === 'number') {
                    const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000) + 43200000);
                    dateStr = isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0];
                } else {
                    // Tentar parse de string PT (DD/MM/YYYY) ou ISO
                    const strVal = String(dateVal).trim();
                    if (strVal.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                        const parts = strVal.split('/');
                        dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    } else if (!isNaN(new Date(strVal).getTime())) {
                        dateStr = new Date(strVal).toISOString().split('T')[0];
                    }
                }
            }

            // Fuzzy mapping
            const ref = findValue(row, ['invoice_ref', 'ref', 'referencia', 'numero', 'doc_num', 'id']) || '';
            const type = findValue(row, ['type', 'tipo', 'doc_type', 'documento']) || 'FTE';
            const nif = findValue(row, ['client_nif', 'nif', 'contribuinte', 'vat']) || '';
            const name = findValue(row, ['client_name', 'name', 'nome', 'cliente', 'entidade']) || 'Cliente Importado';
            const desc = findValue(row, ['description', 'desc', 'descricao', 'item', 'produto']) || 'Item Importado';
            const code = findValue(row, ['item_code', 'code', 'codigo', 'ref_artigo']) || '';
            const qty = findValue(row, ['quantity', 'qty', 'qtd', 'quantidade']) || 0;
            const price = findValue(row, ['unit_price', 'price', 'preco', 'valor', 'unitario']) || 0;
            const tax = findValue(row, ['tax_rate', 'tax', 'iva', 'taxa']) ?? 15;
            const ret = findValue(row, ['apply_retention', 'retention', 'retencao', 'ir']) || false;

            return {
                row_index: index + 2, // Compensar header e index 0
                invoice_ref: String(ref).trim(),
                type: String(type).trim().toUpperCase(),
                date: dateStr,
                client_nif: String(nif).replace(/\s/g, ''),
                client_name: String(name),
                description: String(desc),
                item_code: String(code),
                quantity: Number(qty) || 0,
                unit_price: Number(price) || 0,
                tax_rate: Number(tax),
                apply_retention: String(ret).toLowerCase() === 'true' || String(ret) === '1' || String(ret).toLowerCase() === 'sim'
            };
        });
    },

    /**
     * Process logic: Group rows -> Validate -> Generate Drafts
     */
    processImport: (
        rawData: any[], 
        clients: Client[], 
        settings: SystemSettings
    ): ParsedInvoiceResult => {
        const rows = invoiceImportService.mapRows(rawData);
        const groupedMap = new Map<string, ImportRow[]>();
        const allErrors: ValidationError[] = [];

        // 1. Validate Individual Rows & Group
        rows.forEach(row => {
            const rowErrors = invoiceImportValidators.validateRow(row);
            if (rowErrors.length > 0) {
                allErrors.push(...rowErrors);
            } else {
                const group = groupedMap.get(row.invoice_ref) || [];
                group.push(row);
                groupedMap.set(row.invoice_ref, group);
            }
        });

        const validDrafts: DraftInvoice[] = [];
        let validCount = 0;
        let invalidCount = 0;

        // 2. Process Groups into Invoices
        groupedMap.forEach((groupRows, invoiceRef) => {
            const groupErrors = invoiceImportValidators.validateInvoiceGroup(invoiceRef, groupRows);
            
            if (groupErrors.length > 0) {
                allErrors.push(...groupErrors);
                invalidCount++;
                return;
            }

            // Map to Application Logic
            const firstRow = groupRows[0];
            const client = clients.find(c => c.nif === firstRow.client_nif) || 
                           clients.find(c => c.company.toLowerCase() === firstRow.client_name.toLowerCase());

            const isCreditNote = firstRow.type === 'NCE';
            
            // Build Items
            const items: InvoiceItem[] = groupRows.map(r => {
                let importedValue = Math.abs(r.unit_price);
                
                // LÓGICA DE CÁLCULO INVERSO (Target Pricing)
                // O valor importado é considerado o Valor LÍQUIDO A RECEBER (Total Final).
                // Precisamos encontrar o Unit Price BASE tal que:
                // Base + (Base * Tax%) - (Base * Ret%) = ValorImportado
                // Base * (1 + TaxDecimal - RetDecimal) = ValorImportado
                // Base = ValorImportado / (1 + TaxDecimal - RetDecimal)

                const taxDecimal = r.tax_rate / 100;
                const retentionDecimal = r.apply_retention ? (settings.defaultRetentionRate / 100) : 0;
                
                const factor = 1 + taxDecimal - retentionDecimal;
                
                // Evitar divisão por zero ou negativa (improvável, mas seguro)
                let basePrice = importedValue;
                if (factor > 0) {
                    basePrice = importedValue / factor;
                }

                if (isCreditNote) basePrice = -basePrice;

                return {
                    id: invoicingCalculations.generateItemId(),
                    description: r.description,
                    itemCode: r.item_code,
                    quantity: r.quantity,
                    unitPrice: basePrice, // Preço Base calculado
                    taxRate: r.tax_rate,
                    total: basePrice * r.quantity // Total Base
                };
            });

            // Se alguma linha do grupo tem retenção, a fatura toda assume retenção
            const hasRetention = groupRows.some(r => r.apply_retention);
            const totals = invoicingCalculations.calculateTotals(items, hasRetention, settings.defaultRetentionRate);

            const draft: DraftInvoice = {
                id: `DRAFT-IMP-${Date.now()}-${validCount}`, // Temp ID
                type: firstRow.type as InvoiceType,
                date: firstRow.date,
                dueDate: firstRow.date,
                clientId: client?.id || 0,
                clientName: client?.company || firstRow.client_name,
                clientNif: client?.nif || firstRow.client_nif,
                clientAddress: client?.address || 'Morada Importada',
                items: items,
                subtotal: totals.subtotal,
                taxTotal: totals.taxTotal,
                withholdingTotal: totals.withholdingTotal,
                total: totals.total,
                status: 'Rascunho',
                notes: `Importado via Excel (Ref: ${invoiceRef})`,
                reason: isCreditNote ? 'Retificação Importada' : undefined
            };

            validDrafts.push(draft);
            validCount++;
        });

        return {
            drafts: validDrafts,
            errors: allErrors,
            summary: {
                totalRows: rows.length,
                validInvoices: validCount,
                invalidInvoices: invalidCount
            }
        };
    }
};
