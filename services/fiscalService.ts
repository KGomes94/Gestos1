
import { Invoice, SystemSettings, FiscalStatus, InvoiceType } from '../types';

export const fiscalService = {
    /**
     * Códigos de Tipo de Documento conforme Tabela 20 (Pág 33)
     */
    getTypeCode: (type: InvoiceType): string => {
        const mapping: Record<InvoiceType, string> = {
            'FTE': '01',
            'FRE': '02',
            'TVE': '03',
            'RCE': '04',
            'NCE': '05',
            'NDE': '06',
            'DTE': '07',
            'DVE': '08',
            'NLE': '09'
        };
        return mapping[type] || '01';
    },

    /**
     * Algoritmo Luhn Formula para Cálculo de Dígito Verificador (Pág 21)
     */
    calculateLuhnDV: (base: string): string => {
        let soma = 0;
        for (let i = 0; i < base.length; i++) {
            const digit = parseInt(base.charAt(i));
            const factor = (i % 2 === 0) ? 1 : 2;
            let product = digit * factor;
            soma += product;
        }
        const w = soma * 9;
        const dv = w % 10;
        return dv.toString();
    },

    /**
     * Gera o IUD de 45 caracteres conforme Pág 17
     */
    generateIUD: (invoice: Invoice, settings: SystemSettings): string => {
        const config = settings.fiscalConfig;
        const date = new Date(invoice.date);
        
        const pais = "CV";
        const repo = config.repositoryCode; 
        const ano = date.getFullYear().toString().slice(-2);
        const mes = (date.getMonth() + 1).toString().padStart(2, '0');
        const dia = date.getDate().toString().padStart(2, '0');
        const nif = settings.companyNif.padStart(9, '0');
        const led = config.ledCode.padStart(5, '0');
        const tipo = invoice.typeCode.padStart(2, '0');
        const numDoc = invoice.internalId.toString().padStart(9, '0');
        
        // Código Aleatório de 10 dígitos (Pág 18)
        const random = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
        
        const base = `${repo}${ano}${mes}${dia}${nif}${led}${tipo}${numDoc}${random}`;
        const dv = fiscalService.calculateLuhnDV(base);
        
        return `${pais}${base}${dv}`;
    },

    /**
     * Simula a comunicação com o portal e-fatura.cv
     */
    communicateInvoice: async (invoice: Invoice, settings: SystemSettings): Promise<{ iud: string, fiscalStatus: FiscalStatus, fiscalHash: string, fiscalQrCode: string }> => {
        const config = settings.fiscalConfig;
        const typeCode = fiscalService.getTypeCode(invoice.type);
        const invoiceWithCode = { ...invoice, typeCode };
        const iud = fiscalService.generateIUD(invoiceWithCode, settings);
        
        if (!config.enabled) {
            return { iud, fiscalStatus: 'Pendente', fiscalHash: 'PENDING_OFFLINE', fiscalQrCode: '' };
        }

        // Simular latência de rede (comunicação síncrona Pág 12)
        await new Promise(resolve => setTimeout(resolve, 800));

        const qrUrl = `https://pe.efatura.cv/dfe/view/${iud}`;

        return {
            iud,
            fiscalStatus: 'Transmitido',
            fiscalHash: iud.slice(-10), 
            fiscalQrCode: qrUrl
        };
    }
};
