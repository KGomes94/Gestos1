
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
            'NCE': '05', // Nota de Crédito Eletrónica
            'RCE': '04',
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
            if (product > 9) product -= 9; // Fix Luhn algo standard
            soma += product;
        }
        const w = (soma * 9) % 10;
        return w.toString();
    },

    /**
     * Gera o IUD de 45 caracteres conforme Pág 17
     * ATENÇÃO: Apenas deve ser chamado ao FINALIZAR o documento para comunicação.
     */
    generateIUD: (invoice: Invoice, settings: SystemSettings): string => {
        const config = settings.fiscalConfig;
        const date = new Date(invoice.date);
        
        const pais = "CV";
        const repo = config.repositoryCode || '1'; 
        const ano = date.getFullYear().toString().slice(-2);
        const mes = (date.getMonth() + 1).toString().padStart(2, '0');
        const dia = date.getDate().toString().padStart(2, '0');
        const nif = settings.companyNif.padStart(9, '0');
        const led = config.ledCode.padStart(5, '0');
        const tipo = fiscalService.getTypeCode(invoice.type).padStart(2, '0');
        const numDoc = invoice.internalId.toString().padStart(9, '0');
        
        // Código Aleatório de 10 dígitos (Pág 18)
        // Em produção, isso deve ser persistido para não mudar se regenerado
        const random = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
        
        const base = `${repo}${ano}${mes}${dia}${nif}${led}${tipo}${numDoc}${random}`;
        const dv = fiscalService.calculateLuhnDV(base);
        
        return `${pais}${base}${dv}`;
    },

    /**
     * Valida os dados antes da emissão
     */
    validateInvoiceData: (invoice: Partial<Invoice>, settings: SystemSettings): { valid: boolean, errors: string[] } => {
        const errors: string[] = [];
        
        if (!invoice.clientNif || invoice.clientNif.length !== 9) {
            errors.push("NIF do cliente inválido (deve ter 9 dígitos).");
        }
        if (!invoice.clientAddress || invoice.clientAddress.length < 5) {
            errors.push("Morada do cliente obrigatória.");
        }
        if (!invoice.items || invoice.items.length === 0) {
            errors.push("O documento deve ter pelo menos um item.");
        }
        if ((invoice.total || 0) < 0 && invoice.type !== 'NCE') {
            errors.push("O total não pode ser negativo (exceto em Notas de Crédito).");
        }
        if (invoice.type === 'NCE' && !invoice.relatedInvoiceId) {
            errors.push("Notas de Crédito devem referenciar uma fatura original.");
        }
        if (invoice.type === 'NCE' && !invoice.reason) {
            errors.push("Motivo obrigatório para Nota de Crédito.");
        }

        return { valid: errors.length === 0, errors };
    },

    /**
     * FINALIZA O DOCUMENTO internamente.
     * Gera IUD, atribui número sequencial oficial e prepara para envio.
     */
    finalizeDocument: (invoice: Invoice, settings: SystemSettings): Invoice => {
        // Gera IUD
        const iud = fiscalService.generateIUD(invoice, settings);
        
        // Em um cenário real, aqui assinaríamos o XML com chave privada
        // Por enquanto, preparamos o estado
        
        return {
            ...invoice,
            iud: iud,
            status: 'Emitida', // Ou 'Paga' se for recibo
            fiscalStatus: 'Pendente', // Aguardando envio assíncrono
            fiscalHash: iud.slice(-10), // Placeholder do hash
            fiscalQrCode: `https://pe.efatura.cv/dfe/view/${iud}`
        };
    },

    /**
     * Envia o documento para a DNRE (Placeholder para integração futura)
     * Esta função será ativada por um worker ou botão "Comunicar Agora"
     */
    sendToFiscalAuthority: async (invoice: Invoice): Promise<FiscalStatus> => {
        console.log("Iniciando comunicação segura com DNRE para IUD:", invoice.iud);
        // TODO: Implementar envio SOAP/REST com certificado digital
        return 'Transmitido';
    }
};
