
import { SystemSettings, Proposal, Invoice, Client } from '../types';
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
    printWindow.document.write(`<html><head><title>${title}</title></head><body>${contentHtml}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  },

  /**
   * Gera PDF Profissional para Faturas (A4 e Talão)
   */
  printInvoice: (invoice: Invoice, settings: SystemSettings, format: 'A4' | 'Thermal' = 'A4') => {
    try {
        if (format === 'Thermal') {
            printService.printThermalInvoice(invoice, settings);
            return;
        }

        const doc = new jsPDF();
        const primaryColor = '#16a34a'; // Green-600
        const layout = settings.invoiceLayout || { showBankInfo: true, customFooterText: '', showSalesman: false, bankInfoText: '' };

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
        doc.text(settings.companyName || 'Nome da Empresa', 14, 35);
        doc.text(`NIF: ${settings.companyNif || '---'}`, 14, 40);
        doc.text(settings.companyAddress || '---', 14, 45);
        doc.text(`${settings.companyPhone || ''} | ${settings.companyEmail || ''}`, 14, 50);

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
        doc.text(invoice.clientName || 'Consumidor Final', 18, 72);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`NIF: ${invoice.clientNif || '999999999'}`, 18, 78);
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

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 90,
            theme: 'striped',
            headStyles: { fillColor: primaryColor },
            styles: { fontSize: 9 }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        let currentY = finalY;
        const rightColumnX = 195;
        const labelColumnX = 135;

        // Totals
        doc.setFontSize(10);
        
        // Subtotal
        doc.text(`Subtotal:`, labelColumnX, currentY);
        doc.text(`${invoice.subtotal.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, rightColumnX, currentY, { align: 'right' });
        
        currentY += 6;

        // IVA
        doc.text(`IVA:`, labelColumnX, currentY);
        doc.text(`${invoice.taxTotal.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, rightColumnX, currentY, { align: 'right' });

        currentY += 6;

        // Retention
        if (invoice.withholdingTotal > 0) {
            doc.setTextColor(220, 38, 38);
            doc.text(`Retenção:`, labelColumnX, currentY);
            doc.text(`-${invoice.withholdingTotal.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, rightColumnX, currentY, { align: 'right' });
            doc.setTextColor(0);
            currentY += 6;
        }

        // Total Final
        currentY += 5; // Espaçamento extra
        
        // Caixa de fundo suave para o total
        doc.setFillColor(240, 253, 244); // green-50
        doc.rect(100, currentY - 8, 98, 14, 'F');

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 101, 52); // green-800
        
        // Ajustado X para 105 para dar espaço ao valor à direita
        doc.text(`TOTAL A PAGAR:`, 105, currentY);
        doc.text(`${invoice.total.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 192, currentY, { align: 'right' });

        // Bank Info Section
        if (layout.showBankInfo && layout.bankInfoText) {
            currentY += 20;
            doc.setFontSize(9);
            doc.setTextColor(0);
            doc.setFont("helvetica", "bold");
            doc.text("Dados para Pagamento:", 14, currentY);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            
            const bankLines = doc.splitTextToSize(layout.bankInfoText, 100);
            doc.text(bankLines, 14, currentY + 5);
        }

        // Footer / Legal
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        const pageHeight = doc.internal.pageSize.height;
        
        if (layout.customFooterText) {
            doc.text(layout.customFooterText, 105, pageHeight - 15, { align: 'center' });
        } else {
            doc.text("Processado por programa certificado nº 000/DNRE", 105, pageHeight - 15, { align: 'center' });
        }

        if(invoice.fiscalHash) {
            doc.text(`Hash: ${invoice.fiscalHash.substring(0, 30)}...`, 14, pageHeight - 10);
        }

        doc.save(`${invoice.id.replace(/\//g, '-')}.pdf`);
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Erro ao gerar o PDF. Verifique a consola para mais detalhes.");
    }
  },

  /**
   * Imprime Extrato de Conta Corrente (Statement)
   */
  printClientStatement: (invoices: Invoice[], client: Client, period: string, settings: SystemSettings) => {
      try {
          const doc = new jsPDF();
          const primaryColor = '#16a34a';

          // Header
          doc.setFontSize(22);
          doc.setTextColor(primaryColor);
          doc.text(settings.companyName || 'Empresa', 14, 20);
          
          doc.setFontSize(10);
          doc.setTextColor(100);
          doc.text("Extrato de Conta Corrente", 14, 26);
          doc.text(`Período: ${period}`, 14, 31);

          // Info Direita
          doc.setFontSize(9);
          doc.setTextColor(0);
          doc.text(`Cliente: ${client.company || client.name}`, 195, 20, { align: 'right' });
          doc.text(`NIF: ${client.nif || 'N/A'}`, 195, 25, { align: 'right' });
          doc.text(client.address || '', 195, 30, { align: 'right' });

          // Dados da Tabela
          let totalDebit = 0;
          let totalCredit = 0;
          
          const tableRows = invoices.map(inv => {
              const debit = inv.type === 'NCE' ? 0 : inv.total;
              const credit = inv.type === 'NCE' ? 0 : (inv.status === 'Paga' ? inv.total : 0);
              const status = inv.status;
              
              totalDebit += debit;
              totalCredit += credit;

              // Em notas de crédito, ajustamos: reduz débito
              if (inv.type === 'NCE') {
                  totalDebit -= Math.abs(inv.total); // Reduz dívida
                  // Crédito (Pagamento) não se aplica diretamente aqui a menos que reembolsado, simplificado.
              }

              return [
                  new Date(inv.date).toLocaleDateString('pt-PT'),
                  inv.id,
                  inv.type === 'NCE' ? 'Nota Crédito' : (inv.type === 'FTE' ? 'Fatura' : 'Doc'),
                  inv.total.toLocaleString('pt-PT', {minimumFractionDigits: 2}),
                  status === 'Paga' ? 'Liquidado' : 'Pendente'
              ];
          });

          const balance = totalDebit - totalCredit;

          autoTable(doc, {
              head: [['Data', 'Documento', 'Tipo', 'Valor (CVE)', 'Estado']],
              body: tableRows,
              startY: 40,
              theme: 'grid',
              headStyles: { fillColor: primaryColor }
          });

          const finalY = (doc as any).lastAutoTable.finalY + 10;

          // Resumo
          doc.setFontSize(10);
          doc.text("Resumo do Extrato:", 14, finalY);
          
          doc.setFont("helvetica", "bold");
          doc.text(`Total Faturado: ${totalDebit.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 14, finalY + 7);
          doc.text(`Total Pago: ${totalCredit.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 14, finalY + 12);
          
          doc.setFontSize(12);
          if (balance > 0) {
              doc.setTextColor(220, 38, 38); // Red
              doc.text(`Saldo em Dívida: ${balance.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 14, finalY + 20);
          } else {
              doc.setTextColor(primaryColor);
              doc.text("Situação Regularizada", 14, finalY + 20);
          }

          // Footer
          doc.setTextColor(150);
          doc.setFontSize(8);
          doc.text(`Emitido em ${new Date().toLocaleString()} via GestOs`, 105, 290, { align: 'center' });

          doc.save(`Extrato_${client.company?.replace(/\s/g, '_')}_${period.replace(/\s/g, '_')}.pdf`);

      } catch (error) {
          console.error("Erro ao gerar extrato:", error);
          alert("Erro ao gerar PDF do extrato.");
      }
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
      // Logic placeholder - use standard printDocument for now
      const content = `
        <h1>Proposta ${proposal.id}</h1>
        <p>Cliente: ${proposal.clientName}</p>
        <p>Total: ${(proposal.items || []).reduce((a, b) => a + b.total, 0).toLocaleString()} CVE</p>
      `;
      printService.printDocument(`Proposta ${proposal.id}`, content, settings);
  }
};
