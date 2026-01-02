/**
 * BaseImportModal - Modal reutilizável para importação de dados
 * 
 * Consolida a lógica das 4 modais:
 * - InvoiceImportModal (199 linhas)
 * - MaterialImportModal (195 linhas)
 * - ClientImportModal (199 linhas)
 * - PurchaseImportModal (177 linhas)
 * 
 * Savings: ~700 linhas de código duplicado
 */

import React, { useState, useEffect } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  X,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  Play,
  Download,
} from 'lucide-react';
import Modal from '../../components/Modal';
import { useHelp } from '../../contexts/HelpContext';
import { ImportedRow, ImportResult, BaseImportModalProps } from '../../types/import';

interface BaseImportModalInternalProps<T> extends BaseImportModalProps<T> {
  results?: ImportResult<T>;
  isLoading?: boolean;
  onFileSelect: (file: File) => void;
  onConfirm: () => Promise<void>;
  selectedTab?: 'upload' | 'preview' | 'results';
  onTabChange?: (tab: 'upload' | 'preview' | 'results') => void;
  renderSuccessRow?: (row: ImportedRow<T>) => React.ReactNode;
  renderErrorRow?: (row: ImportedRow<T>) => React.ReactNode;
  confirmButtonLabel?: string;
  showAutoEmit?: boolean;
  autoEmitLabel?: string;
  autoEmitWarning?: string;
  onAutoEmitChange?: (checked: boolean) => void;
  autoEmitEnabled?: boolean;
}

export const BaseImportModal = React.forwardRef<HTMLDivElement, BaseImportModalInternalProps<any>>(
  (
    {
      isOpen,
      onClose,
      onFileSelect,
      onConfirm,
      onImport,
      title,
      description,
      acceptedFormats = '.xlsx, .xls, .csv',
      maxFileSize = 10 * 1024 * 1024, // 10MB default
      results,
      isLoading = false,
      selectedTab = 'upload',
      onTabChange,
      renderSuccessRow,
      renderErrorRow,
      confirmButtonLabel = 'Importar',
      showAutoEmit = false,
      autoEmitLabel = 'Ação automática',
      autoEmitWarning = 'ATENÇÃO: Ação irreversível.',
      onAutoEmitChange,
      autoEmitEnabled = false,
    },
    ref
  ) => {
    const { setHelpContent, toggleHelp, isHelpOpen } = useHelp();
    const [activeTab, setActiveTab] = useState<'upload' | 'preview' | 'results'>(selectedTab);
    const [autoEmit, setAutoEmit] = useState(autoEmitEnabled);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
      setActiveTab(selectedTab);
    }, [selectedTab]);

    // Auto switch to errors tab se houver erros mas sem sucessos
    useEffect(() => {
      if (results && results.data.length > 0) {
        const successCount = results.data.filter((r) => r.status === 'success').length;
        const errorCount = results.data.filter((r) => r.status === 'error').length;

        if (successCount === 0 && errorCount > 0) {
          setActiveTab('results');
        }
      }
    }, [results]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (maxFileSize && file.size > maxFileSize) {
        alert(`Ficheiro demasiado grande. Máximo: ${(maxFileSize / 1024 / 1024).toFixed(0)}MB`);
        return;
      }

      setFileName(file.name);
      onFileSelect(file);
    };

    const handleAutoEmitChange = (checked: boolean) => {
      setAutoEmit(checked);
      onAutoEmitChange?.(checked);
    };

    const handleShowFormatHelp = () => {
      if (description) {
        setHelpContent({
          title: `Formato do Ficheiro - ${title}`,
          content: description,
        });
        if (!isHelpOpen) toggleHelp();
      }
    };

    const handleConfirm = async () => {
      try {
        await onConfirm();
      } catch (error) {
        console.error('Erro ao confirmar importação:', error);
      }
    };

    if (!isOpen) return null;

    const successCount = results?.summary.successCount ?? 0;
    const errorCount = results?.summary.errorCount ?? 0;
    const warningCount = results?.summary.warningCount ?? 0;
    const hasData = successCount > 0 || errorCount > 0 || warningCount > 0;

    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title}>
        <div ref={ref} className="flex flex-col h-[70vh]">
          {/* Header Stats */}
          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex items-center justify-between mb-6 shrink-0">
            <div className="flex gap-8">
              {successCount > 0 && (
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 text-green-700 p-2 rounded-lg">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">
                      Válidos
                    </p>
                    <p className="text-xl font-black text-green-700">{successCount}</p>
                  </div>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex items-center gap-3">
                  <div className="bg-red-100 text-red-700 p-2 rounded-lg">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">
                      Erros
                    </p>
                    <p className="text-xl font-black text-red-700">{errorCount}</p>
                  </div>
                </div>
              )}
              {warningCount > 0 && (
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 text-orange-700 p-2 rounded-lg">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">
                      Avisos
                    </p>
                    <p className="text-xl font-black text-orange-700">{warningCount}</p>
                  </div>
                </div>
              )}
            </div>

            {!hasData && (
              <div className="flex gap-2">
                {description && (
                  <button
                    onClick={handleShowFormatHelp}
                    className="bg-white border border-blue-200 text-blue-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-50 transition-colors shadow-sm text-xs uppercase tracking-wider"
                  >
                    <HelpCircle size={16} /> Formato Esperado
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  <Upload size={18} /> Selecionar Ficheiro
                </button>
              </div>
            )}

            {fileName && (
              <div className="text-sm text-gray-600">
                <span className="font-bold">Ficheiro:</span> {fileName}
              </div>
            )}

            <input
              type="file"
              accept={Array.isArray(acceptedFormats) ? acceptedFormats.join(',') : acceptedFormats}
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          {/* Tabs */}
          {hasData && (
            <div className="flex gap-2 mb-4 border-b shrink-0">
              <button
                onClick={() => {
                  setActiveTab('preview');
                  onTabChange?.('preview');
                }}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === 'preview'
                    ? 'border-green-500 text-green-700'
                    : 'border-transparent text-gray-400'
                }`}
              >
                A Importar ({successCount})
              </button>
              <button
                onClick={() => {
                  setActiveTab('results');
                  onTabChange?.('results');
                }}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === 'results'
                    ? 'border-red-500 text-red-700'
                    : 'border-transparent text-gray-400'
                }`}
              >
                Erros & Avisos ({errorCount + warningCount})
              </button>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-auto bg-gray-50 border rounded-xl relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}

            {/* Tab: Preview (Success Rows) */}
            {activeTab === 'preview' && successCount > 0 && results && (
              <div className="overflow-x-auto">
                {renderSuccessRow ? (
                  <div className="divide-y divide-gray-200">
                    {results.data
                      .filter((row) => row.status === 'success')
                      .map((row) => (
                        <div key={row.id} className="p-4 hover:bg-green-50 transition-colors">
                          {renderSuccessRow(row)}
                        </div>
                      ))}
                  </div>
                ) : (
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0 font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="p-3 text-left">#</th>
                        <th className="p-3 text-left">Dados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {results.data
                        .filter((row) => row.status === 'success')
                        .map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="p-3 font-mono text-gray-500">{row.rowNumber}</td>
                            <td className="p-3">
                              <pre className="text-xs overflow-x-auto">
                                {JSON.stringify(row.data, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab: Results (Error/Warning Rows) */}
            {activeTab === 'results' && (errorCount > 0 || warningCount > 0) && results && (
              <div className="overflow-x-auto">
                {renderErrorRow ? (
                  <div className="divide-y divide-gray-200">
                    {results.data
                      .filter((row) => row.status === 'error' || row.status === 'warning')
                      .map((row) => (
                        <div key={row.id} className="p-4 hover:bg-red-50 transition-colors">
                          {renderErrorRow(row)}
                        </div>
                      ))}
                  </div>
                ) : (
                  <table className="min-w-full text-xs">
                    <thead className="bg-red-50 sticky top-0 font-bold text-red-800 uppercase">
                      <tr>
                        <th className="p-3 text-left">Linha</th>
                        <th className="p-3 text-left">Campo</th>
                        <th className="p-3 text-left">Mensagem</th>
                        <th className="p-3 text-center">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100 bg-white">
                      {results.data
                        .filter((row) => row.status === 'error' || row.status === 'warning')
                        .flatMap((row) =>
                          row.errors.map((error, idx) => (
                            <tr key={`${row.id}-${idx}`} className="hover:bg-red-50/30">
                              <td className="p-3 font-mono text-gray-600">Linha {row.rowNumber}</td>
                              <td className="p-3 font-mono text-gray-600">{error.field}</td>
                              <td className="p-3 font-medium text-gray-800">{error.message}</td>
                              <td className="p-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded uppercase font-black text-[10px] ${
                                    row.status === 'error'
                                      ? 'bg-red-100 text-red-600'
                                      : 'bg-orange-100 text-orange-600'
                                  }`}
                                >
                                  {row.status === 'error' ? 'ERRO' : 'AVISO'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Empty State */}
            {!hasData && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FileText size={48} className="mb-4 opacity-20" />
                <p>Carregue um ficheiro para visualizar os dados.</p>
                {description && (
                  <button
                    onClick={handleShowFormatHelp}
                    className="text-blue-500 hover:underline mt-2 text-xs font-bold"
                  >
                    Ver formato esperado
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-6 border-t flex flex-col gap-4 bg-white shrink-0">
            {showAutoEmit && hasData && successCount > 0 && (
              <div
                className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                  autoEmit ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    checked={autoEmit}
                    onChange={(e) => handleAutoEmitChange(e.target.checked)}
                  />
                  <div>
                    <span
                      className={`text-sm font-bold ${
                        autoEmit ? 'text-orange-800' : 'text-gray-700'
                      }`}
                    >
                      {autoEmitLabel}
                    </span>
                    {autoEmit && (
                      <p className="text-xs text-orange-700 mt-1">
                        <ShieldAlert size={12} className="inline mr-1" />
                        <strong>{autoEmitWarning}</strong>
                      </p>
                    )}
                  </div>
                </label>
              </div>
            )}

            <div className="flex justify-between items-center">
              <button
                onClick={onClose}
                className="px-6 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <div className="flex gap-3">
                {errorCount > 0 && (
                  <span className="flex items-center text-xs text-orange-600 font-bold bg-orange-50 px-3 rounded-lg border border-orange-100">
                    <AlertCircle size={14} className="mr-1" /> Erros serão ignorados.
                  </span>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={successCount === 0}
                  className={`px-8 py-2 text-white rounded-xl font-black uppercase shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 ${
                    autoEmit ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {autoEmit ? <Play size={18} /> : <Upload size={18} />}
                  {confirmButtonLabel} ({successCount})
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }
);

BaseImportModal.displayName = 'BaseImportModal';
