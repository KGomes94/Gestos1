
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
        const found = rowKeys.find(k => k.trim().toLowerCase() === key.trim().toLowerCase());
        if (found) return row[found];
        const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const foundClean = rowKeys.find(k => k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanKey);
        if (foundClean) return row[foundClean];
    }
    return undefined;
};

// Type Guard para garantir que o numero é válido, senão devolve undefined ou NaN explicitamente
const parseNumberStrict = (val: any): number => {
    if (val === null || val === undefined || String(val).trim() === '') return NaN;
    const num = Number(String(val).replace(',', '.')); // Handle decimal comma
    return num;
};

export const invoiceImportService = {
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
                    console.log("Parsed JSON rawData:", json); // LOG
                    resolve(json);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    },

    mapRows: (rawData: any[]): ImportRow[] => {
        console.log("Raw Data for mapping:", rawData); // LOG
        return rawData.map((row, index) => {
            const dateVal = findValue(row, ['date', 'data', 'emissao', 'dia']);
            
            let dateStr = new Date().toISOString().split('T')[0];
            if (dateVal) {
                if (typeof dateVal === 'number') {
                    const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000) + 43200000);
                    dateStr = isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0];
                } else {
                    const strVal = String(dateVal).trim();
                    if (strVal.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                        const parts = strVal.split('/');
                        dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    } else if (!isNaN(new Date(strVal).getTime())) {
                        dateStr = new Date(strVal).toISOString().split('T')[0];
                    }
                }
            }

            const ref = findValue(row, ['invoice_ref', 'ref', 'referencia', 'numero', 'doc_num', 'id']) || '';
            const type = findValue(row, ['type', 'tipo', 'doc_type', 'documento']) || 'FTE';
            const nif = findValue(row, ['client_nif', 'nif', 'contribuinte', 'vat']) || '';
            const name = findValue(row, ['client_name', 'name', 'nome', 'cliente', 'entidade']) || 'Cliente Importado';
            const desc = findValue(row, ['description', 'desc', 'descricao', 'item', 'produto']) || 'Item Importado';
            const code = findValue(row, ['item_code', 'code', 'codigo', 'ref_artigo']) || '';
            
            // Usar parseNumberStrict para permitir NaN (que será apanhado pelo validador)
            const qty = parseNumberStrict(findValue(row, ['quantity', 'qty', 'qtd', 'quantidade']));
            const price = parseNumberStrict(findValue(row, ['unit_price', 'price', 'preco', 'valor', 'unitario']));
            const tax = parseNumberStrict(findValue(row, ['tax_rate', 'tax', 'iva', 'taxa']));
            
            const ret = findValue(row, ['apply_retention', 'retention', 'retencao', 'ir']) || false;

            return {
                row_index: index + 2,
                invoice_ref: String(ref).trim(),
                type: String(type).trim().toUpperCase(),
                date: dateStr,
                client_nif: String(nif).replace(/\s/g, ''),
                client_name: String(name),
                description: String(desc),
                item_code: String(code),
                quantity: isNaN(qty) ? 0 : qty, // Converter para 0 para UI, mas validar em invoiceImportValidators
                unit_price: isNaN(price) ? 0 : price,
                tax_rate: isNaN(tax) ? 15 : tax, // Default 15 se inválido
                apply_retention: String(ret).toLowerCase() === 'true' || String(ret) === '1' || String(ret).toLowerCase() === 'sim'
            };
        });
    },

    processImport: (
        rawData: any[], 
        clients: Client[], 
        settings: SystemSettings
    ): ParsedInvoiceResult => {
        const rows = invoiceImportService.mapRows(rawData);
        console.log("Mapped Rows:", rows); // LOG
        const groupedMap = new Map<string, ImportRow[]>();
        const allErrors: ValidationError[] = [];

        // 1. Validate Individual Rows
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

            const firstRow = groupRows[0];
            const client = clients.find(c => c.nif === firstRow.client_nif) || 
                           clients.find(c => c.company.toLowerCase() === firstRow.client_name.toLowerCase());

            const isCreditNote = firstRow.type === 'NCE';
            
            const items: InvoiceItem[] = groupRows.map(r => {
                let importedValue = Math.abs(r.unit_price);
                const taxDecimal = r.tax_rate / 100;
                const retentionDecimal = r.apply_retention ? (settings.defaultRetentionRate / 100) : 0;
                
                const factor = 1 + taxDecimal - retentionDecimal;
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
                    unitPrice: basePrice,
                    taxRate: r.tax_rate,
                    total: basePrice * r.quantity
                };
            });

            const hasRetention = groupRows.some(r => r.apply_retention);
            const totals = invoicingCalculations.calculateTotals(items, hasRetention, settings.defaultRetentionRate);

            // SNAPSHOT LOGIC: Use import data or DB client data, but ensure it is copied
            const draft: DraftInvoice = {
                id: `DRAFT-IMP-${Date.now()}-${validCount}`,
                type: firstRow.type as InvoiceType,
                date: firstRow.date,
                dueDate: firstRow.date,
                clientId: client?.id || 0,
                // Force Snapshot from Import Data if Client not found, or Client Data if found
                clientName: client?.company || firstRow.client_name,
                clientNif: client?.nif || firstRow.client_nif || '',
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

        console.log("Final Import Result - Drafts:", validDrafts); // LOG
        console.log("Final Import Result - Errors:", allErrors); // LOG
        console.log("Final Import Result - Summary:", { // LOG
            totalRows: rows.length,
            validInvoices: validCount,
            invalidInvoices: invalidCount
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
