/**
 * Subcomponentes reutilizáveis para exibição de dados importados
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { ImportedRow, ImportedInvoice, ImportedMaterial, ImportedClient, ImportedPurchase } from '../../types/import';

/**
 * Componente para exibir uma linha de fatura importada
 */
export const InvoiceImportRow: React.FC<{ row: ImportedRow<ImportedInvoice> }> = ({ row }) => {
  const invoice = row.data;
  return (
    <div className="grid grid-cols-6 gap-4 items-center py-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-green-600" />
        <span className="font-mono text-sm text-gray-600">#{row.rowNumber}</span>
      </div>
      <div>
        <p className="font-bold text-gray-800">{invoice.invoiceNumber}</p>
      </div>
      <div>
        <p className="text-sm text-gray-600">{invoice.clientName}</p>
      </div>
      <div>
        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
          {invoice.status || 'draft'}
        </span>
      </div>
      <div className="text-right">
        <p className="font-bold text-gray-800">{invoice.amount.toFixed(2)} CVE</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
      </div>
    </div>
  );
};

/**
 * Componente para exibir uma linha de material importado
 */
export const MaterialImportRow: React.FC<{ row: ImportedRow<ImportedMaterial> }> = ({ row }) => {
  const material = row.data;
  return (
    <div className="grid grid-cols-5 gap-4 items-center py-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-green-600" />
        <span className="font-mono text-sm text-gray-600">#{row.rowNumber}</span>
      </div>
      <div>
        <p className="font-bold text-gray-800">{material.code}</p>
        <p className="text-xs text-gray-500">{material.sku}</p>
      </div>
      <div>
        <p className="text-sm text-gray-600">{material.name}</p>
        <p className="text-xs text-gray-400">{material.category}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-gray-800">{material.quantity}</p>
        <p className="text-xs text-gray-500">{material.unit || 'un'}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-gray-800">{material.unitPrice.toFixed(2)} CVE</p>
      </div>
    </div>
  );
};

/**
 * Componente para exibir uma linha de cliente importado
 */
export const ClientImportRow: React.FC<{ row: ImportedRow<ImportedClient> }> = ({ row }) => {
  const client = row.data;
  return (
    <div className="grid grid-cols-5 gap-4 items-center py-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-green-600" />
        <span className="font-mono text-sm text-gray-600">#{row.rowNumber}</span>
      </div>
      <div>
        <p className="font-bold text-gray-800">{client.name}</p>
        <p className="font-mono text-xs text-gray-500">{client.nif}</p>
      </div>
      <div>
        <p className="text-sm text-gray-600">{client.email || '—'}</p>
        <p className="text-xs text-gray-500">{client.phone || '—'}</p>
      </div>
      <div>
        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-bold">
          {client.type || 'individual'}
        </span>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-gray-800">{client.city || '—'}</p>
        <p className="text-xs text-gray-500">{client.postalCode || '—'}</p>
      </div>
    </div>
  );
};

/**
 * Componente para exibir uma linha de compra importada
 */
export const PurchaseImportRow: React.FC<{ row: ImportedRow<ImportedPurchase> }> = ({ row }) => {
  const purchase = row.data;
  return (
    <div className="grid grid-cols-6 gap-4 items-center py-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-green-600" />
        <span className="font-mono text-sm text-gray-600">#{row.rowNumber}</span>
      </div>
      <div>
        <p className="font-bold text-gray-800">{purchase.purchaseNumber}</p>
      </div>
      <div>
        <p className="text-sm text-gray-600">{purchase.supplierName}</p>
      </div>
      <div>
        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">
          {purchase.status || 'pending'}
        </span>
      </div>
      <div className="text-right">
        <p className="font-bold text-gray-800">{purchase.amount.toFixed(2)} CVE</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500">{new Date(purchase.purchaseDate).toLocaleDateString()}</p>
      </div>
    </div>
  );
};

/**
 * Componente para exibir uma linha com erro
 */
export const ImportErrorRow: React.FC<{ row: ImportedRow<any> }> = ({ row }) => {
  const iconClass = row.status === 'error' ? 'text-red-600' : 'text-orange-600';
  const IconComponent = row.status === 'error' ? AlertTriangle : AlertCircle;

  return (
    <div className="border rounded-lg p-4 mb-3 bg-gray-50">
      <div className="flex items-start gap-3 mb-2">
        <IconComponent size={20} className={iconClass} />
        <div className="flex-1">
          <p className="font-bold text-gray-800">Linha {row.rowNumber}</p>
          <p className={`text-sm font-bold ${row.status === 'error' ? 'text-red-700' : 'text-orange-700'}`}>
            {row.status === 'error' ? 'ERRO' : 'AVISO'}
          </p>
        </div>
      </div>
      <div className="ml-8 space-y-1">
        {row.errors.map((error, idx) => (
          <div key={idx} className="border-l-2 border-gray-300 pl-3">
            <p className="text-xs font-mono text-gray-600">{error.field}</p>
            <p className="text-sm text-gray-700">{error.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Container para exibir estatísticas de importação
 */
export const ImportStats: React.FC<{
  total: number;
  success: number;
  warning: number;
  error: number;
}> = ({ total, success, warning, error }) => {
  const percentage = total > 0 ? Math.round((success / total) * 100) : 0;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">Resumo da Importação</h3>
        <span className="text-2xl font-black text-blue-600">{percentage}%</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-3 rounded-lg border border-blue-100">
          <p className="text-xs text-gray-500 font-bold uppercase">Total</p>
          <p className="text-2xl font-black text-blue-600">{total}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-green-100">
          <p className="text-xs text-gray-500 font-bold uppercase">Sucesso</p>
          <p className="text-2xl font-black text-green-600">{success}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-orange-100">
          <p className="text-xs text-gray-500 font-bold uppercase">Avisos</p>
          <p className="text-2xl font-black text-orange-600">{warning}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-red-100">
          <p className="text-xs text-gray-500 font-bold uppercase">Erros</p>
          <p className="text-2xl font-black text-red-600">{error}</p>
        </div>
      </div>

      <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-green-600 h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
