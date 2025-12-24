
import { SystemSettings, Proposal, ProposalItem } from '../types';

export const printService = {
  /**
   * Gera e imprime um documento formatado
   */
  printDocument: (title: string, contentHtml: string, settings: SystemSettings) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para imprimir documentos.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @media print {
            .no-print { display: none; }
            body { padding: 0; margin: 0; -webkit-print-color-adjust: exact; }
          }
          body { font-family: sans-serif; color: #333; line-height: 1.5; }
          .document-container { padding: 40px; max-width: 800px; margin: auto; }
          .header-border { border-bottom: 3px solid #15803d; margin-bottom: 20px; }
          .label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: bold; }
          .value { font-size: 14px; font-weight: bold; margin-bottom: 10px; }
          .table-header { background-color: #f3f4f6; font-weight: bold; font-size: 11px; }
          .signature-box { border-top: 1px solid #ccc; width: 200px; text-align: center; font-size: 12px; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="document-container">
          <!-- CABEÇALHO DA EMPRESA -->
          <div class="flex justify-between items-start header-border pb-4">
            <div>
              <h1 class="text-3xl font-black text-green-700 m-0 leading-none">GestOs</h1>
              <p class="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Enterprise Solutions</p>
            </div>
            <div class="text-right text-xs">
              <p class="font-bold text-lg">${settings.companyName}</p>
              <p>NIF: ${settings.companyNif}</p>
              <p>${settings.companyAddress}</p>
              <p>${settings.companyPhone} | ${settings.companyEmail}</p>
            </div>
          </div>

          <div class="text-center py-4">
            <h2 class="text-xl font-black uppercase tracking-tighter">${title}</h2>
          </div>

          ${contentHtml}

          <!-- RODAPÉ DE ASSINATURAS -->
          <div class="mt-20 flex justify-between px-10">
            <div class="signature-box">
              O Técnico
              <div class="mt-8 text-[10px] text-gray-400">Assinatura / Carimbo</div>
            </div>
            <div class="signature-box">
              O Cliente
              <div class="mt-8 text-[10px] text-gray-400">Assinatura / Carimbo</div>
            </div>
          </div>
          
          <div class="mt-20 text-[9px] text-gray-400 text-center border-t pt-4">
            Documento processado por GestOs ERP v1.8.0 em ${new Date().toLocaleString('pt-PT')}
          </div>
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
               window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  },

  /**
   * Imprime uma Proposta Comercial com layout personalizado
   */
  printProposal: (proposal: Proposal, settings: SystemSettings) => {
    const layout = settings.proposalLayout;
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow) return alert('Por favor, permita pop-ups.');

    const calculateTotals = (items: ProposalItem[], disc: number, ret: number, tax: number) => {
        const subtotal = items.reduce((a, v) => a + v.total, 0);
        const discVal = subtotal * (disc / 100);
        const taxable = subtotal - discVal;
        const taxVal = taxable * (tax / 100);
        const retVal = taxable * (ret / 100);
        return { subtotal, discVal, taxable, taxVal, retVal, totalToPay: taxable + taxVal - retVal };
    };

    const totals = calculateTotals(proposal.items, proposal.taxRate, proposal.discount, proposal.retention);
    const primaryColor = layout.primaryColor || '#15803d';
    const secondaryColor = layout.secondaryColor || '#f0fdf4';
    const borderRadius = layout.headerShape === 'rounded' ? '12px' : '0px';

    const itemsRows = proposal.items.map(i => `
        <tr class="border-b border-gray-100">
            <td class="p-3 text-left">${i.description}</td>
            <td class="p-3 text-center">${i.quantity}</td>
            <td class="p-3 text-right">${i.unitPrice.toLocaleString()}</td>
            <td class="p-3 text-right font-bold">${i.total.toLocaleString()}</td>
        </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Proposta ${proposal.id}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @media print { body { -webkit-print-color-adjust: exact; } }
          body { font-family: 'Inter', sans-serif; background: ${layout.backgroundStyle === 'clean' ? '#fff' : '#fafafa'}; }
          .accent-bg { background-color: ${primaryColor}; color: white; }
          .secondary-bg { background-color: ${secondaryColor}; }
          .proposal-header { border-radius: ${borderRadius}; }
          .watermark { 
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); 
            font-size: 100px; color: rgba(0,0,0,0.03); z-index: -1; pointer-events: none; 
            font-weight: 900; text-transform: uppercase;
          }
        </style>
      </head>
      <body class="p-10">
        ${layout.backgroundStyle === 'corporate' ? '<div class="watermark">PROPOSTA</div>' : ''}
        
        <div class="max-w-4xl mx-auto">
          <!-- Top Bar -->
          <div class="flex justify-between items-center mb-8">
            <h1 class="text-4xl font-black" style="color: ${primaryColor}">GestOs</h1>
            <div class="text-right text-sm">
                <h2 class="text-xl font-bold uppercase tracking-widest">${proposal.title || 'Proposta Comercial'}</h2>
                <p class="font-mono font-bold text-gray-400 mt-1">Ref: ${proposal.id}</p>
            </div>
          </div>

          <!-- Info Boxes -->
          <div class="grid grid-cols-2 gap-8 mb-8">
            <div class="p-6 secondary-bg proposal-header">
                <h3 class="text-[10px] font-black uppercase text-gray-500 mb-3 tracking-widest border-b pb-1">De: Prestador</h3>
                <p class="font-bold text-lg">${settings.companyName}</p>
                <p class="text-xs text-gray-600">NIF: ${settings.companyNif}</p>
                <p class="text-xs text-gray-600 mt-2">${settings.companyAddress}</p>
                <p class="text-xs text-gray-600">${settings.companyPhone} | ${settings.companyEmail}</p>
            </div>
            <div class="p-6 bg-white border border-gray-100 shadow-sm proposal-header">
                <h3 class="text-[10px] font-black uppercase text-gray-500 mb-3 tracking-widest border-b pb-1">Para: Cliente</h3>
                <p class="font-bold text-lg">${proposal.clientName}</p>
                ${layout.showClientNif ? `<p class="text-xs text-gray-600">NIF: ${proposal.nif || '---'}</p>` : ''}
                ${layout.showClientAddress ? `<p class="text-xs text-gray-600 mt-2">${proposal.zone || '---'}</p>` : ''}
                <p class="text-xs text-gray-600">${proposal.contactPhone || ''}</p>
            </div>
          </div>

          <!-- Items Table -->
          <div class="mb-10">
            <table class="w-full text-sm border-collapse">
                <thead>
                    <tr class="accent-bg proposal-header">
                        <th class="p-3 text-left">Descrição</th>
                        <th class="p-3 text-center">Qtd</th>
                        <th class="p-3 text-right">P.Unit</th>
                        <th class="p-3 text-right">Total</th>
                    </tr>
                </thead>
                <tbody>${itemsRows}</tbody>
            </table>
          </div>

          <!-- Totals -->
          <div class="flex justify-end mb-10">
            <div class="w-64 space-y-2">
                <div class="flex justify-between text-xs"><span>Subtotal:</span><span>${totals.subtotal.toLocaleString()} ${settings.currency}</span></div>
                ${proposal.discount > 0 ? `<div class="flex justify-between text-xs text-red-600"><span>Desconto (${proposal.discount}%):</span><span>-${totals.discVal.toLocaleString()}</span></div>` : ''}
                <div class="flex justify-between text-xs"><span>IVA (${proposal.taxRate}%):</span><span>${totals.taxVal.toLocaleString()}</span></div>
                ${proposal.retention > 0 ? `<div class="flex justify-between text-xs text-orange-600"><span>Retenção (${proposal.retention}%):</span><span>-${totals.retVal.toLocaleString()}</span></div>` : ''}
                <div class="flex justify-between text-xl font-black border-t pt-2" style="color: ${primaryColor}">
                    <span>Total:</span>
                    <span>${totals.totalToPay.toLocaleString()} ${settings.currency}</span>
                </div>
            </div>
          </div>

          <!-- Bottom -->
          <div class="grid grid-cols-1 gap-6 text-xs text-gray-500">
             ${layout.showValidity && proposal.validUntil ? `<div><span class="font-bold uppercase tracking-tighter">Validade:</span> Esta proposta é válida até ${new Date(proposal.validUntil).toLocaleDateString()}</div>` : ''}
             ${layout.showTerms ? `<div class="p-4 border border-dashed rounded-lg bg-gray-50"><span class="font-bold uppercase tracking-tighter block mb-2">Termos e Condições:</span>${proposal.notes || settings.defaultProposalNotes}</div>` : ''}
          </div>

          ${layout.showSignature ? `
          <div class="mt-20 flex justify-between items-center px-10">
            <div class="text-center w-48 border-t border-gray-300 pt-2">Pela Empresa</div>
            <div class="text-center w-48 border-t border-gray-300 pt-2">Aceito pelo Cliente</div>
          </div>` : ''}

          <div class="mt-20 text-[8px] text-gray-300 text-center uppercase tracking-widest">Gerado por GestOs ERP v1.8.0</div>
        </div>
        <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }
};
