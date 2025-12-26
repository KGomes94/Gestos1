
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

export const invoiceImportService = {
    /**
     * Parse Excel file content
     */
    parseFile: async (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet);
                    resolve(json);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsBinaryString(file);
        });
    },

    /**
     * Map raw JSON to typed ImportRows
     */
    mapRows: (rawData: any[]): ImportRow[] => {
        return rawData.map((row, index) => {
            // Helper para data excel
            let dateStr = new Date().toISOString().split('T')[0];
            if (row.date) {
                if (typeof row.date === 'number') {
                    const date = new Date(Math.round((row.date - 25569) * 86400 * 1000) + 43200000);
                    dateStr = date.toISOString().split('T')[0];
                } else {
                    dateStr = String(row.date).trim();
                }
            }

            return {
                row_index: index + 2, // Compensar header e index 0
                invoice_ref: String(row.invoice_ref || '').trim(),
                type: String(row.type || 'FTE').trim().toUpperCase(),
                date: dateStr,
                client_nif: String(row.client_nif || '').replace(/\s/g, ''),
                client_name: String(row.client_name || 'Cliente Importado'),
                description: String(row.description || 'Item Importado'),
                item_code: String(row.item_code || ''),
                quantity: Number(row.quantity) || 0,
                unit_price: Number(row.unit_price) || 0,
                tax_rate: row.tax_rate !== undefined ? Number(row.tax_rate) : 15,
                apply_retention: String(row.apply_retention).toLowerCase() === 'true' || String(row.apply_retention) === '1'
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
                // Ensure correct sign for NCE (negative) or normal (positive)
                // If importing NCE and Excel has positive numbers, convert to negative
                // If importing NCE and Excel has negative numbers, keep negative
                let price = Math.abs(r.unit_price);
                if (isCreditNote) price = -price;

                return {
                    id: invoicingCalculations.generateItemId(),
                    description: r.description,
                    itemCode: r.item_code,
                    quantity: r.quantity,
                    unitPrice: price,
                    taxRate: r.tax_rate,
                    total: price * r.quantity
                };
            });

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
