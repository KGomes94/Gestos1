
import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, FileText, X, AlertCircle } from 'lucide-react';
import { DraftInvoice } from '../../types';
import Modal from '../../components/Modal';
import { ValidationError } from '../services/invoiceImportValidators';

interface InvoiceImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    drafts: DraftInvoice[];
    errors: ValidationError[];
    summary: { totalRows: number; validInvoices: number; invalidInvoices: number };
    onConfirm: () => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
}

export const InvoiceImportModal: React.FC<InvoiceImportModalProps> = ({
    isOpen, onClose, isLoading, drafts, errors, summary, onConfirm, onFileSelect, fileInputRef
}) => {
    const [activeTab, setActiveTab] = useState<'valid' | 'errors'>('valid');

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Importar Faturas (Excel)">
            <div className="flex flex-col h-[70vh]">
                
                {/* Header Stats */}
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex items-center justify-between mb-6 shrink-0">
                    <div className="flex gap-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 text-green-700 p-2 rounded-lg"><CheckCircle2 size={24}/></div>
                            <div><p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Válidas</p><p className="text-xl font-black text-green-700">{summary.validInvoices}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-red-100 text-red-700 p-2 rounded-lg"><AlertTriangle size={24}/></div>
                            <div><p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Erros</p><p className="text-xl font-black text-red-700">{summary.invalidInvoices}</p></div>
                        </div>
                    </div>
                    
                    {summary.validInvoices === 0 && summary.invalidInvoices === 0 && (
                        <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-50 transition-colors shadow-sm">
                            <Upload size={18}/> Selecionar Ficheiro
                        </button>
                    )}
                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={onFileSelect} />
                </div>

                {/* Tabs */}
                {(summary.validInvoices > 0 || summary.invalidInvoices > 0) && (
                    <div className="flex gap-2 mb-4 border-b shrink-0">
                        <button onClick={() => setActiveTab('valid')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'valid' ? 'border-green-500 text-green-700' : 'border-transparent text-gray-400'}`}>
                            Faturas a Importar ({drafts.length})
                        </button>
                        <button onClick={() => setActiveTab('errors')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'errors' ? 'border-red-500 text-red-700' : 'border-transparent text-gray-400'}`}>
                            Erros Encontrados ({errors.length})
                        </button>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-auto bg-gray-50 border rounded-xl relative">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                        </div>
                    )}

                    {activeTab === 'valid' && drafts.length > 0 && (
                        <table className="min-w-full text-xs">
                            <thead className="bg-gray-100 sticky top-0 font-bold text-gray-500 uppercase">
                                <tr>
                                    <th className="p-3 text-left">Ref</th>
                                    <th className="p-3 text-left">Data</th>
                                    <th className="p-3 text-left">Cliente</th>
                                    <th className="p-3 text-left">Tipo</th>
                                    <th className="p-3 text-right">Itens</th>
                                    <th className="p-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {drafts.map((d, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="p-3 font-mono text-gray-500">{d.notes?.replace('Importado via Excel (Ref: ', '').replace(')', '')}</td>
                                        <td className="p-3">{new Date(d.date).toLocaleDateString()}</td>
                                        <td className="p-3 font-bold text-gray-700">{d.clientName}</td>
                                        <td className="p-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-black">{d.type}</span></td>
                                        <td className="p-3 text-right">{d.items?.length}</td>
                                        <td className="p-3 text-right font-black">{d.total.toLocaleString()} CVE</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'errors' && errors.length > 0 && (
                        <table className="min-w-full text-xs">
                            <thead className="bg-red-50 sticky top-0 font-bold text-red-800 uppercase">
                                <tr>
                                    <th className="p-3 text-left">Localização</th>
                                    <th className="p-3 text-left">Mensagem</th>
                                    <th className="p-3 text-center">Tipo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-red-100 bg-white">
                                {errors.map((err, i) => (
                                    <tr key={i} className="hover:bg-red-50/30">
                                        <td className="p-3 font-mono text-gray-600">
                                            {err.line ? `Linha ${err.line}` : `Ref: ${err.invoiceRef}`}
                                        </td>
                                        <td className="p-3 font-medium text-gray-800">{err.message}</td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-0.5 rounded uppercase font-black text-[10px] ${err.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {err.type}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {drafts.length === 0 && errors.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <FileText size={48} className="mb-4 opacity-20"/>
                            <p>Carregue um ficheiro Excel para visualizar os dados.</p>
                            <p className="text-xs mt-2 opacity-60">Colunas: invoice_ref, type, date, client_nif, quantity, unit_price...</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="pt-6 border-t flex justify-between items-center shrink-0">
                    <button onClick={onClose} className="px-6 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50">Cancelar</button>
                    <div className="flex gap-3">
                        {summary.invalidInvoices > 0 && (
                            <span className="flex items-center text-xs text-orange-600 font-bold bg-orange-50 px-3 rounded-lg border border-orange-100">
                                <AlertCircle size={14} className="mr-1"/> Atenção: {summary.invalidInvoices} faturas serão ignoradas.
                            </span>
                        )}
                        <button 
                            onClick={onConfirm} 
                            disabled={drafts.length === 0}
                            className="px-8 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            <Upload size={18}/> Importar {drafts.length} Faturas
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
