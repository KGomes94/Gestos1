
import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, FileText, AlertCircle, HelpCircle } from 'lucide-react';
import { Client } from '../../types';
import Modal from '../../components/Modal';
import { useHelp } from '../../contexts/HelpContext';
import { ClientImportResult } from '../services/clientImportService';

interface ClientImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    result: ClientImportResult;
    onConfirm: () => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
}

export const ClientImportModal: React.FC<ClientImportModalProps> = ({
    isOpen, onClose, isLoading, result, onConfirm, onFileSelect, fileInputRef
}) => {
    const { setHelpContent, toggleHelp, isHelpOpen } = useHelp();
    const [activeTab, setActiveTab] = useState<'valid' | 'errors'>('valid');

    const handleShowFormatHelp = () => {
        setHelpContent({
            title: "Importação de Clientes - Formato Excel",
            content: `
                <p class="mb-2">O ficheiro deve ter cabeçalho na linha 1. Colunas suportadas (nomes flexíveis):</p>
                <ul class="list-disc pl-4 space-y-1 text-sm">
                    <li><strong>Type / Tipo</strong>: 'Doméstico' ou 'Empresarial'</li>
                    <li><strong>Name / Nome</strong>: Nome da pessoa</li>
                    <li><strong>Company / Empresa</strong>: Nome da entidade</li>
                    <li><strong>NIF</strong>: 9 dígitos (999999999 aceite para indiferenciados)</li>
                    <li><strong>Email</strong></li>
                    <li><strong>Phone / Telefone</strong></li>
                    <li><strong>Address / Morada</strong></li>
                    <li><strong>Notes / Notas</strong></li>
                </ul>
            `
        });
        if (!isHelpOpen) toggleHelp();
    };

    if (!isOpen) return null;

    const hasData = result.drafts.length > 0 || result.errors.length > 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Importar Clientes (Excel)">
            <div className="flex flex-col h-[85vh]">
                
                {/* Stats Header */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-4 mb-4 shrink-0">
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="bg-green-100 text-green-700 p-2 rounded-lg"><CheckCircle2 size={20}/></div>
                            <div><p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Válidos</p><p className="text-lg font-black text-green-700">{result.drafts.length}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="bg-red-100 text-red-700 p-2 rounded-lg"><AlertTriangle size={20}/></div>
                            <div><p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Alertas</p><p className="text-lg font-black text-red-700">{result.errors.length}</p></div>
                        </div>
                    </div>
                    
                    {!hasData && (
                        <div className="flex gap-2">
                            <button onClick={handleShowFormatHelp} className="bg-white border border-blue-200 text-blue-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-50 transition-colors shadow-sm text-xs uppercase tracking-wider">
                                <HelpCircle size={16}/> Ajuda
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
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
                            Dados Válidos ({result.drafts.length})
                        </button>
                        <button onClick={() => setActiveTab('errors')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'errors' ? 'border-red-500 text-red-700' : 'border-transparent text-gray-400'}`}>
                            Erros & Avisos ({result.errors.length})
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto bg-gray-50 border rounded-xl relative shadow-inner">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                        </div>
                    )}

                    {activeTab === 'valid' && result.drafts.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs whitespace-nowrap">
                                <thead className="bg-gray-100 sticky top-0 font-bold text-gray-500 uppercase z-10">
                                    <tr>
                                        <th className="p-3 text-left bg-gray-100 border-b">Tipo</th>
                                        <th className="p-3 text-left bg-gray-100 border-b">Empresa</th>
                                        <th className="p-3 text-left bg-gray-100 border-b">Nome</th>
                                        <th className="p-3 text-left bg-gray-100 border-b">NIF</th>
                                        <th className="p-3 text-left bg-gray-100 border-b">Email</th>
                                        <th className="p-3 text-left bg-gray-100 border-b">Telefone</th>
                                        <th className="p-3 text-left bg-gray-100 border-b">Morada</th>
                                        <th className="p-3 text-left bg-gray-100 border-b">Notas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {result.drafts.map((d, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded uppercase font-black text-[9px] ${d.type === 'Empresarial' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {d.type}
                                                </span>
                                            </td>
                                            <td className="p-3 font-bold text-gray-800">{d.company}</td>
                                            <td className="p-3 text-gray-600">{d.name}</td>
                                            <td className="p-3 font-mono">{d.nif === '999999999' ? <span className="text-green-600 font-bold">999 999 999</span> : d.nif || '-'}</td>
                                            <td className="p-3 text-gray-600">{d.email}</td>
                                            <td className="p-3 text-gray-600">{d.phone}</td>
                                            <td className="p-3 text-gray-600 max-w-[200px] truncate" title={d.address}>{d.address}</td>
                                            <td className="p-3 text-gray-400 italic max-w-[150px] truncate" title={d.notes}>{d.notes}</td>
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
                                    <th className="p-3 text-center w-24">Gravidade</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-red-100 bg-white">
                                {result.errors.map((err, i) => (
                                    <tr key={i} className="hover:bg-red-50/30">
                                        <td className="p-3 font-mono text-gray-600 border-r border-red-50">L.{err.line}</td>
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
                            <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 text-xs font-bold hover:underline px-4">
                                Carregar Outro Ficheiro
                            </button>
                        )}
                        <button 
                            onClick={onConfirm} 
                            disabled={result.drafts.length === 0}
                            className="px-8 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            <Upload size={18}/> Importar {result.drafts.length} Clientes
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
