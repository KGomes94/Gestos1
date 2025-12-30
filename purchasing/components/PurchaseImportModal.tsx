
import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, FileText, HelpCircle, Hash, Calendar } from 'lucide-react';
import Modal from '../../components/Modal';
import { useHelp } from '../../contexts/HelpContext';
import { PurchaseImportResult } from '../services/purchaseImportService';

interface PurchaseImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    result: PurchaseImportResult;
    onConfirm: () => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
}

export const PurchaseImportModal: React.FC<PurchaseImportModalProps> = ({
    isOpen, onClose, isLoading, result, onConfirm, onFileSelect, fileInputRef
}) => {
    const { setHelpContent, toggleHelp, isHelpOpen } = useHelp();
    const [activeTab, setActiveTab] = useState<'valid' | 'errors'>('valid');

    const handleShowFormatHelp = () => {
        setHelpContent({
            title: "Importação de Compras - Formato Excel",
            content: `
                <p class="mb-2">Cabeçalhos suportados (linha 1):</p>
                <ul class="list-disc pl-4 space-y-1 text-sm">
                    <li><strong>Data / Emissão</strong> (Obrigatório)</li>
                    <li><strong>Fornecedor / Nome</strong> (Obrigatório)</li>
                    <li><strong>Valor / Total</strong> (Obrigatório)</li>
                    <li><strong>Ref / Fatura</strong> (Nº do documento original)</li>
                    <li><strong>Descrição / Item</strong></li>
                    <li><strong>Vencimento / Limite</strong></li>
                    <li><strong>NIF</strong> (Opcional, ajuda a identificar fornecedor)</li>
                </ul>
            `
        });
        if (!isHelpOpen) toggleHelp();
    };

    if (!isOpen) return null;
    const hasData = result.drafts.length > 0 || result.errors.length > 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Importar Contas a Pagar (Excel)">
            <div className="flex flex-col h-[85vh]">
                
                {/* Stats Header */}
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-wrap items-center justify-between gap-4 mb-4 shrink-0">
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="bg-green-100 text-green-700 p-2 rounded-lg"><CheckCircle2 size={20}/></div>
                            <div><p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Válidos</p><p className="text-lg font-black text-green-700">{result.drafts.length}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="bg-red-100 text-red-700 p-2 rounded-lg"><AlertTriangle size={20}/></div>
                            <div><p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Erros</p><p className="text-lg font-black text-red-700">{result.errors.length}</p></div>
                        </div>
                    </div>
                    
                    {!hasData && (
                        <div className="flex gap-2">
                            <button onClick={handleShowFormatHelp} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-red-50 transition-colors shadow-sm text-xs uppercase tracking-wider">
                                <HelpCircle size={16}/> Ajuda
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
                                <Upload size={18}/> Selecionar Ficheiro
                            </button>
                        </div>
                    )}
                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={onFileSelect} />
                </div>

                {/* Tabs */}
                {hasData && (
                    <div className="flex gap-2 mb-2 border-b shrink-0">
                        <button onClick={() => setActiveTab('valid')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'valid' ? 'border-green-500 text-green-700' : 'border-transparent text-gray-400'}`}>
                            Registos Válidos ({result.drafts.length})
                        </button>
                        <button onClick={() => setActiveTab('errors')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'errors' ? 'border-red-500 text-red-700' : 'border-transparent text-gray-400'}`}>
                            Erros ({result.errors.length})
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto bg-gray-50 border rounded-xl relative shadow-inner">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                        </div>
                    )}

                    {activeTab === 'valid' && result.drafts.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs whitespace-nowrap">
                                <thead className="bg-gray-100 sticky top-0 font-bold text-gray-500 uppercase z-10">
                                    <tr>
                                        <th className="p-3 text-left border-b">Data</th>
                                        <th className="p-3 text-left border-b">Fornecedor</th>
                                        <th className="p-3 text-left border-b">Ref. Externa</th>
                                        <th className="p-3 text-right border-b">Valor</th>
                                        <th className="p-3 text-left border-b pl-6">Descrição</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {result.drafts.map((d, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="p-3 font-mono text-gray-600">{new Date(d.date!).toLocaleDateString()}</td>
                                            <td className="p-3 font-bold text-gray-800">
                                                {d.supplierName}
                                                {d.supplierId === 0 && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1 ml-1 rounded">Novo</span>}
                                            </td>
                                            <td className="p-3 text-gray-500 flex items-center gap-1">
                                                <Hash size={10}/> {d.referenceDocument || '-'}
                                            </td>
                                            <td className="p-3 text-right font-black text-red-600">{d.total?.toLocaleString()}</td>
                                            <td className="p-3 text-gray-500 pl-6 max-w-[200px] truncate">{d.items?.[0]?.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'errors' && result.errors.length > 0 && (
                        <table className="min-w-full text-xs">
                            <thead className="bg-red-50 sticky top-0 font-bold text-red-800 uppercase">
                                <tr>
                                    <th className="p-3 text-left w-20">Linha</th>
                                    <th className="p-3 text-left">Mensagem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-red-100 bg-white">
                                {result.errors.map((err, i) => (
                                    <tr key={i} className="hover:bg-red-50/30">
                                        <td className="p-3 font-mono text-gray-600 border-r border-red-50">L.{err.line}</td>
                                        <td className="p-3 font-medium text-gray-800">{err.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {!hasData && !isLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <FileText size={48} className="mb-4 opacity-20"/>
                            <p>Carregue um ficheiro Excel para visualizar os dados.</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t flex justify-between items-center shrink-0">
                    <button onClick={onClose} className="px-6 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50">Cancelar</button>
                    <div className="flex gap-3">
                        {hasData && (
                            <button onClick={() => fileInputRef.current?.click()} className="text-red-600 text-xs font-bold hover:underline px-4">
                                Carregar Outro
                            </button>
                        )}
                        <button 
                            onClick={onConfirm} 
                            disabled={result.drafts.length === 0}
                            className="px-8 py-2 bg-red-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            <Upload size={18}/> Importar {result.drafts.length} Compras
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
