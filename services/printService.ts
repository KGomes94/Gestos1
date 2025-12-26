
import { SystemSettings, Proposal, Invoice } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const printService = {
  
  /**
   * Imprime Documento Genérico (HTML fallback)
   */
  printDocument: (title: string, contentHtml: string, settings: SystemSettings) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para imprimir documentos.');
      return;
    }
    // ... (Keep HTML logic as fallback or specific use case)
    printWindow.document.write(`<html><head><title>${title}</title></head><body>${contentHtml}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  },

  /**
   * Gera PDF Profissional para Faturas (A4 e Talão)
   */
  printInvoice: (invoice: Invoice, settings: SystemSettings, format: 'A4' | 'Thermal' = 'A4') => {
    if (format === 'Thermal') {
        printService.printThermalInvoice(invoice, settings);
        return;
    }

    const doc = new jsPDF();
    const primaryColor = '#16a34a'; // Green-600

    // Header
    doc.setFontSize(22);
    doc.setTextColor(primaryColor);
    doc.text("GestOs", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Enterprise Solutions", 14, 25);

    // Company Info
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(settings.companyName, 14, 35);
    doc.text(`NIF: ${settings.companyNif}`, 14, 40);
    doc.text(settings.companyAddress, 14, 45);
    doc.text(`${settings.companyPhone} | ${settings.companyEmail}`, 14, 50);

    // Invoice Details (Right Side)
    doc.setFontSize(16);
    doc.text(invoice.type === 'FTE' ? 'FATURA' : invoice.type === 'NCE' ? 'NOTA DE CRÉDITO' : 'RECIBO', 195, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`Nº ${invoice.id}`, 195, 27, { align: 'right' });
    doc.text(`Data: ${new Date(invoice.date).toLocaleDateString('pt-PT')}`, 195, 32, { align: 'right' });
    
    if (invoice.iud) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`IUD: ${invoice.iud}`, 195, 38, { align: 'right' });
    }

    // Client Info Box
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 60, 182, 25, 'F');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Exmo.(s) Sr.(s)", 18, 66);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(invoice.clientName, 18, 72);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`NIF: ${invoice.clientNif || 'Consumidor Final'}`, 18, 78);
    doc.text(`Morada: ${invoice.clientAddress || '---'}`, 100, 78);

    if (invoice.type === 'NCE' && invoice.relatedInvoiceId) {
        doc.setTextColor(220, 38, 38); // Red
        doc.text(`Referente à Fatura: ${invoice.relatedInvoiceId}`, 18, 83);
        doc.text(`Motivo: ${invoice.reason}`, 100, 83);
        doc.setTextColor(0);
    }

    // Items Table
    const tableColumn = ["Descrição", "Qtd", "Preço Unit", "Taxa", "Total"];
    const tableRows = invoice.items.map(item => [
        item.description,
        item.quantity,
        `${item.unitPrice.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`,
        `${item.taxRate}%`,
        `${item.total.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`
    ]);

    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 90,
        theme: 'striped',
        headStyles: { fillColor: primaryColor },
        styles: { fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Totals
    doc.setFontSize(10);
    doc.text(`Subtotal:`, 140, finalY);
    doc.text(`${invoice.subtotal.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 195, finalY, { align: 'right' });
    
    doc.text(`IVA:`, 140, finalY + 5);
    doc.text(`${invoice.taxTotal.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 195, finalY + 5, { align: 'right' });

    if (invoice.withholdingTotal > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(`Retenção na Fonte:`, 140, finalY + 10);
        doc.text(`-${invoice.withholdingTotal.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 195, finalY + 10, { align: 'right' });
        doc.setTextColor(0);
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL A PAGAR:`, 140, finalY + 20);
    doc.text(`${invoice.total.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 195, finalY + 20, { align: 'right' });

    // Footer / Legal
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    const pageHeight = doc.internal.pageSize.height;
    doc.text("Processado por programa certificado nº 000/DNRE", 105, pageHeight - 10, { align: 'center' });
    if(invoice.fiscalHash) {
        doc.text(`Hash: ${invoice.fiscalHash.substring(0, 30)}...`, 14, pageHeight - 10);
    }

    doc.save(`${invoice.id}.pdf`);
  },

  /**
   * Imprime Talão Térmico (80mm) via janela do navegador
   */
  printThermalInvoice: (invoice: Invoice, settings: SystemSettings) => {
      const printWindow = window.open('', '_blank', 'width=350,height=600');
      if (!printWindow) return;

      const html = `
        <html>
        <head>
            <title>Talão ${invoice.id}</title>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 10px; width: 80mm; }
                .center { text-align: center; }
                .right { text-align: right; }
                .bold { font-weight: bold; }
                .line { border-bottom: 1px dashed #000; margin: 5px 0; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th { text-align: left; border-bottom: 1px solid #000; }
                .total-row { font-size: 14px; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="center bold">${settings.companyName}</div>
            <div class="center">NIF: ${settings.companyNif}</div>
            <div class="center">${new Date(invoice.date).toLocaleString()}</div>
            <div class="line"></div>
            <div class="center bold">${invoice.type} ${invoice.id}</div>
            <div class="line"></div>
            <div>Cliente: ${invoice.clientName}</div>
            <div>NIF: ${invoice.clientNif || 'N/A'}</div>
            <div class="line"></div>
            <table>
                <thead><tr><th>Qtd</th><th>Item</th><th class="right">Total</th></tr></thead>
                <tbody>
                    ${invoice.items.map(i => `
                        <tr>
                            <td>${i.quantity}</td>
                            <td>${i.description}</td>
                            <td class="right">${i.total.toFixed(0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="line"></div>
            <div class="right">Subtotal: ${invoice.subtotal.toLocaleString()}</div>
            <div class="right">IVA: ${invoice.taxTotal.toLocaleString()}</div>
            ${invoice.withholdingTotal > 0 ? `<div class="right">Retenção: -${invoice.withholdingTotal.toLocaleString()}</div>` : ''}
            <div class="right bold total-row">TOTAL: ${invoice.total.toLocaleString()} CVE</div>
            <div class="line"></div>
            ${invoice.iud ? `<div class="center" style="font-size: 9px; word-break: break-all;">IUD: ${invoice.iud}</div>` : ''}
            <div class="center" style="margin-top: 20px;">Obrigado pela preferência!</div>
        </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
      // Wait for resources to load
      setTimeout(() => printWindow.print(), 500);
  },

  printProposal: (proposal: Proposal, settings: SystemSettings) => {
      // Keep existing logic or migrate to jspdf later
      const printWindow = window.open('', '_blank', 'width=800,height=1000');
      // ... existing code ...
  }
};
