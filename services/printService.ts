import { SystemSettings, Proposal, Invoice, Client, Purchase, Transaction, Account } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { currency } from '../utils/currency';

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

  // Helper para formatar datas sem fuso horário
  formatDate: (dateStr: string) => {
      if (!dateStr) return '';
      const clean = dateStr.split('T')[0];
      const parts = clean.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateStr;
  },

  /**
   * Helper: Cabeçalho Padrão PDF
   */
  _addHeader: (doc: jsPDF, title: string, settings: SystemSettings, subTitle?: string) => {
      const primaryColor = '#16a34a';
      doc.setFontSize(22);
      doc.setTextColor(primaryColor);
      doc.text(settings.companyName || "GestOs", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Relatório de Gestão", 14, 26);

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(title, 195, 20, { align: 'right' });
      if (subTitle) {
          doc.setFontSize(10);
          doc.setTextColor(100);
          doc.text(subTitle, 195, 26, { align: 'right' });
      }
      doc.line(14, 30, 195, 30);
  },

  /**
   * Relatório 1: Balancete (Trial Balance)
   */
  printTrialBalance: (
      transactions: Transaction[], 
      invoices: Invoice[], 
      purchases: Purchase[], 
      categories: Account[],
      period: { start: string, end: string },
      settings: SystemSettings
  ) => {
      try {
          const doc = new jsPDF();
          printService._addHeader(doc, "Balancete de Verificação", settings, `Período: ${printService.formatDate(period.start)} a ${printService.formatDate(period.end)}`);

          const data: Record<string, { name: string, type: string, debit: number, credit: number }> = {};

          categories.forEach(cat => {
              data[cat.name] = { name: cat.name, type: cat.type, debit: 0, credit: 0 };
          });

          transactions.filter(t => t.date >= period.start && t.date <= period.end && !t.isVoided).forEach(t => {
              if (data[t.category]) {
                  if (t.income) data[t.category].credit += t.income;
                  if (t.expense) data[t.category].debit += t.expense;
              }
          });

          purchases.filter(p => p.date >= period.start && p.date <= period.end && p.status !== 'Anulada').forEach(p => {
              const catName = categories.find(c => c.id === p.categoryId)?.name || 'Outros Custos';
              if (!data[catName]) data[catName] = { name: catName, type: 'Custo', debit: 0, credit: 0 };
              data[catName].debit += p.total;
          });

          invoices.filter(i => i.date >= period.start && i.date <= period.end && i.status !== 'Anulada' && i.status !== 'Rascunho').forEach(i => {
              const catName = 'Vendas / Serviços Prestados'; 
              if (!data[catName]) data[catName] = { name: catName, type: 'Receita', debit: 0, credit: 0 };
              data[catName].credit += i.total;
          });

          const rows = Object.values(data)
              .filter(r => r.debit > 0 || r.credit > 0)
              .sort((a, b) => a.type.localeCompare(b.type))
              .map(r => [
                  r.type,
                  r.name,
                  r.debit > 0 ? r.debit.toLocaleString('pt-PT', {minimumFractionDigits: 2}) : '-',
                  r.credit > 0 ? r.credit.toLocaleString('pt-PT', {minimumFractionDigits: 2}) : '-'
              ]);

          const totalDebit = Object.values(data).reduce((acc, r) => acc + r.debit, 0);
          const totalCredit = Object.values(data).reduce((acc, r) => acc + r.credit, 0);
          const saldo = totalCredit - totalDebit;

          autoTable(doc, {
              head: [['Tipo', 'Conta', 'Débito (Despesa)', 'Crédito (Receita)']],
              body: rows,
              startY: 35,
              theme: 'grid',
              headStyles: { fillColor: '#16a34a' },
              foot: [['TOTAL', '', totalDebit.toLocaleString('pt-PT'), totalCredit.toLocaleString('pt-PT')]],
              footStyles: { fillColor: '#f3f4f6', textColor: '#000', fontStyle: 'bold' }
          });

          const finalY = (doc as any).lastAutoTable.finalY + 10;
          doc.setFontSize(12);
          doc.text(`Saldo do Período: ${saldo.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 14, finalY);

          doc.save(`Balancete_${period.start}_${period.end}.pdf`);
      } catch (e) {
          console.error(e);
          alert("Erro ao gerar Balancete.");
      }
  },

  /**
   * Relatório 2: Extrato Consolidado
   */
  printConsolidatedStatement: (
      transactions: Transaction[],
      invoices: Invoice[],
      purchases: Purchase[],
      period: { start: string, end: string },
      settings: SystemSettings
  ) => {
      try {
          const doc = new jsPDF();
          printService._addHeader(doc, "Extrato Consolidado", settings, `Período: ${printService.formatDate(period.start)} a ${printService.formatDate(period.end)}`);

          const allMovements = [
              ...transactions.filter(t => t.date >= period.start && t.date <= period.end && !t.isVoided).map(t => ({
                  date: t.date,
                  desc: t.description,
                  type: 'Tesouraria',
                  docRef: t.id.toString(),
                  in: t.income || 0,
                  out: t.expense || 0,
                  obs: '' 
              })),
              ...invoices.filter(i => i.date >= period.start && i.date <= period.end && i.status !== 'Rascunho' && i.status !== 'Anulada').map(i => ({
                  date: i.date,
                  desc: `Fatura ${i.clientName}`,
                  type: 'Faturação',
                  docRef: i.id,
                  in: 0, 
                  out: 0,
                  obs: `Emitido: ${i.total.toLocaleString()}`
              })),
              ...purchases.filter(p => p.date >= period.start && p.date <= period.end && p.status !== 'Anulada').map(p => ({
                  date: p.date,
                  desc: `Compra ${p.supplierName}`,
                  type: 'Compras',
                  docRef: p.id,
                  in: 0,
                  out: 0,
                  obs: `Registado: ${p.total.toLocaleString()}`
              }))
          ].sort((a, b) => a.date.localeCompare(b.date));

          const rows = allMovements.map(m => [
              printService.formatDate(m.date),
              m.type,
              m.docRef,
              m.desc,
              m.in > 0 ? m.in.toLocaleString('pt-PT') : '',
              m.out > 0 ? m.out.toLocaleString('pt-PT') : '',
              m.obs || ''
          ]);

          autoTable(doc, {
              head: [['Data', 'Origem', 'Ref', 'Descrição', 'Entrada', 'Saída', 'Obs (Económico)']],
              body: rows,
              startY: 35,
              styles: { fontSize: 8 },
              headStyles: { fillColor: '#3b82f6' }
          });

          doc.save(`Extrato_Consolidado_${period.start}.pdf`);
      } catch (e) {
          console.error(e);
          alert("Erro ao gerar Extrato.");
      }
  },

  /**
   * Relatório 3: DRE (Demonstração de Resultados)
   */
  printPeriodFinancialReport: (
      transactions: Transaction[],
      invoices: Invoice[],
      purchases: Purchase[],
      categories: Account[],
      period: { start: string, end: string },
      settings: SystemSettings
  ) => {
      try {
          const doc = new jsPDF();
          printService._addHeader(doc, "Demonstração de Resultados (DRE)", settings, `Período: ${printService.formatDate(period.start)} a ${printService.formatDate(period.end)}`);

          // --- CÁLCULOS DRE ---
          const periodInvoices = invoices.filter(i => i.date >= period.start && i.date <= period.end && i.status !== 'Rascunho' && i.status !== 'Anulada');
          const periodPurchases = purchases.filter(p => p.date >= period.start && p.date <= period.end && p.status !== 'Anulada');

          // 1. Receita Bruta
          const grossRevenue = periodInvoices.reduce((acc, i) => currency.add(acc, i.total), 0);
          
          // 2. Deduções (IVA)
          const taxesOnSales = periodInvoices.reduce((acc, i) => currency.add(acc, i.taxTotal), 0);
          const returns = invoices.filter(i => i.date >= period.start && i.date <= period.end && i.type === 'NCE' && i.status !== 'Rascunho').reduce((acc, i) => currency.add(acc, i.total), 0);
          const deductions = currency.add(taxesOnSales, returns);

          // 3. Receita Líquida
          const netRevenue = currency.sub(grossRevenue, deductions);

          // 4. CMV / Variáveis
          const variableCosts = periodPurchases.filter(p => {
              const cat = categories.find(c => c.id === p.categoryId);
              return cat && (cat.type === 'Custo Direto' || cat.code.startsWith('2.'));
          }).reduce((acc, p) => currency.add(acc, p.total), 0);

          // 5. Margem Bruta
          const grossProfit = currency.sub(netRevenue, variableCosts);

          // 6. Custos Fixos
          const fixedCosts = periodPurchases.filter(p => {
              const cat = categories.find(c => c.id === p.categoryId);
              return cat && (cat.type === 'Custo Fixo' || cat.code.startsWith('3.'));
          }).reduce((acc, p) => currency.add(acc, p.total), 0);

          // 7. EBITDA
          const ebitda = currency.sub(grossProfit, fixedCosts);

          // 8. Financeiro
          const financialCosts = periodPurchases.filter(p => {
              const cat = categories.find(c => c.id === p.categoryId);
              return cat && (cat.type === 'Despesa Financeira' || cat.code.startsWith('4.'));
          }).reduce((acc, p) => currency.add(acc, p.total), 0);

          // 9. Liquido
          const netIncome = currency.sub(ebitda, financialCosts);

          // Helper AV%
          const getPerc = (val: number) => netRevenue > 0 ? ((val / netRevenue) * 100).toFixed(1) + '%' : '0.0%';

          // TABELA DRE
          const rows: any[] = [
              ['1. Faturação Bruta', grossRevenue.toLocaleString('pt-PT'), ''],
              ['(-) Impostos e Devoluções', `(${deductions.toLocaleString('pt-PT')})`, ''],
              ['', '', ''],
              [{content: '2. Receita Operacional Líquida', styles: {fontStyle: 'bold', fillColor: '#f0f9ff'}}, {content: netRevenue.toLocaleString('pt-PT'), styles: {fontStyle: 'bold'}}, '100%'],
              ['(-) Custos Variáveis (CMV)', `(${variableCosts.toLocaleString('pt-PT')})`, getPerc(variableCosts)],
              ['', '', ''],
              [{content: '3. Margem Bruta', styles: {fontStyle: 'bold', fillColor: '#f0fdf4'}}, {content: grossProfit.toLocaleString('pt-PT'), styles: {fontStyle: 'bold'}}, getPerc(grossProfit)],
              ['(-) Custos Fixos Operacionais', `(${fixedCosts.toLocaleString('pt-PT')})`, getPerc(fixedCosts)],
              ['', '', ''],
              [{content: '4. EBITDA (Resultado Operacional)', styles: {fontStyle: 'bold', fillColor: '#eff6ff'}}, {content: ebitda.toLocaleString('pt-PT'), styles: {fontStyle: 'bold', textColor: ebitda >= 0 ? '#16a34a' : '#dc2626'}}, getPerc(ebitda)],
              ['(-) Resultado Financeiro', `(${financialCosts.toLocaleString('pt-PT')})`, getPerc(financialCosts)],
              ['', '', ''],
              [{content: '5. Resultado Líquido do Exercício', styles: {fontStyle: 'bold', fontSize: 12, fillColor: '#faf5ff'}}, {content: netIncome.toLocaleString('pt-PT') + ' CVE', styles: {fontStyle: 'bold', fontSize: 12, textColor: netIncome >= 0 ? '#16a34a' : '#dc2626'}}, getPerc(netIncome)],
          ];

          autoTable(doc, {
              head: [['Descrição', 'Valor (CVE)', 'AV %']],
              body: rows,
              startY: 35,
              theme: 'grid',
              styles: { cellPadding: 2, fontSize: 10 },
              columnStyles: { 
                  0: { cellWidth: 'auto' },
                  1: { cellWidth: 40, halign: 'right' },
                  2: { cellWidth: 20, halign: 'right' }
              },
              headStyles: { fillColor: '#4b5563' }
          });

          // Footer info
          const finalY = (doc as any).lastAutoTable.finalY + 15;
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text("Nota: Este relatório segue o regime de competência (baseado na data de emissão dos documentos).", 14, finalY);
          doc.text("AV %: Análise Vertical baseada na Receita Líquida.", 14, finalY + 5);

          doc.save(`DRE_${period.start}.pdf`);

      } catch (e) {
          console.error(e);
          alert("Erro ao gerar DRE.");
      }
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
        
        // CORREÇÃO DATA
        doc.text(`Data: ${printService.formatDate(invoice.date)}`, 195, 32, { align: 'right' });
        
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

              if (inv.type === 'NCE') {
                  totalDebit -= Math.abs(inv.total); 
              }

              return [
                  printService.formatDate(inv.date),
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
   * Imprime Extrato de Fornecedor (Purchases)
   */
  printSupplierStatement: (purchases: Purchase[], supplier: Client, period: string, settings: SystemSettings) => {
      try {
          const doc = new jsPDF();
          const primaryColor = '#dc2626'; // Red-600

          // Header
          doc.setFontSize(22);
          doc.setTextColor(primaryColor);
          doc.text(settings.companyName || 'Empresa', 14, 20);
          
          doc.setFontSize(10);
          doc.setTextColor(100);
          doc.text("Extrato de Fornecedor", 14, 26);
          doc.text(`Período: ${period}`, 14, 31);

          // Info Direita
          doc.setFontSize(9);
          doc.setTextColor(0);
          doc.text(`Fornecedor: ${supplier.company || supplier.name}`, 195, 20, { align: 'right' });
          doc.text(`NIF: ${supplier.nif || 'N/A'}`, 195, 25, { align: 'right' });
          doc.text(supplier.address || '', 195, 30, { align: 'right' });

          let totalDebt = 0;
          let totalPaid = 0;
          
          const tableRows = purchases.map(p => {
              const amount = p.total;
              const status = p.status;
              
              totalDebt += amount;
              if (status === 'Paga') totalPaid += amount;

              return [
                  printService.formatDate(p.date),
                  p.id,
                  p.referenceDocument || '-',
                  p.total.toLocaleString('pt-PT', {minimumFractionDigits: 2}),
                  status === 'Paga' ? 'Pago' : 'Em Dívida'
              ];
          });

          const balance = totalDebt - totalPaid;

          autoTable(doc, {
              head: [['Data', 'Documento Interno', 'Ref. Externa', 'Valor (CVE)', 'Estado']],
              body: tableRows,
              startY: 40,
              theme: 'grid',
              headStyles: { fillColor: primaryColor }
          });

          const finalY = (doc as any).lastAutoTable.finalY + 10;

          // Resumo
          doc.setFontSize(10);
          doc.text("Resumo:", 14, finalY);
          
          doc.setFont("helvetica", "bold");
          doc.text(`Total Compras: ${totalDebt.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 14, finalY + 7);
          doc.text(`Total Pago: ${totalPaid.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 14, finalY + 12);
          
          doc.setFontSize(12);
          if (balance > 0) {
              doc.setTextColor(220, 38, 38); 
              doc.text(`Saldo a Pagar: ${balance.toLocaleString('pt-PT', {minimumFractionDigits: 2})} CVE`, 14, finalY + 20);
          } else {
              doc.setTextColor('#16a34a'); // Green
              doc.text("Conta Regularizada", 14, finalY + 20);
          }

          doc.setTextColor(150);
          doc.setFontSize(8);
          doc.text(`Emitido em ${new Date().toLocaleString()} via GestOs`, 105, 290, { align: 'center' });

          doc.save(`Extrato_Forn_${supplier.company?.replace(/\s/g, '_')}_${period.replace(/\s/g, '_')}.pdf`);

      } catch (error) {
          console.error(error);
          alert("Erro ao gerar PDF.");
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
            <div class="center">${printService.formatDate(invoice.date)}</div>
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
        <p>Data: ${printService.formatDate(proposal.date)}</p>
        <p>Total: ${(proposal.items || []).reduce((a, b) => a + b.total, 0).toLocaleString()} CVE</p>
      `;
      printService.printDocument(`Proposta ${proposal.id}`, content, settings);
  }
};