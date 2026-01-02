# 🛠️ PLANO TÉCNICO DE IMPLEMENTAÇÃO

**Objetivo:** Refatorar Gestos1 ERP, eliminando duplicação, padronizando código e otimizando performance.

---

## 📋 FASE 1: PREPARAÇÃO DO AMBIENTE

### 1.1 Criar Estrutura de Diretórios

```bash
# Criar novos diretórios
mkdir -p src/components/common
mkdir -p src/hooks/common
mkdir -p src/types/import
mkdir -p src/services/import
```

### 1.2 Criar Tipos Unificados

**Arquivo:** `src/types/import.ts`

```typescript
/**
 * Interface genérica para resultado de importação
 * Reduz duplicação entre invoiceImportService, materialImportService, etc.
 */
export interface ImportResult<T> {
    drafts: Partial<T>[];
    errors: ImportError[];
    summary: ImportSummary;
}

export interface ImportError {
    line: number;
    message: string;
    type: 'error' | 'warning';
    field?: string;
}

export interface ImportSummary {
    total: number;
    valid: number;
    invalid: number;
}

/**
 * Row base com índice sempre em row_index
 * Substitui invoice_ref, row_index, etc. variados
 */
export interface BaseImportRow {
    row_index: number;
    [key: string]: any;
}

/**
 * Tipo para função de conversão de draft para entity
 */
export type ConvertDraftToEntity<T, E> = (draft: Partial<T>) => E;

/**
 * Tipo para função de processamento de importação
 */
export type ProcessImportFn<T> = (
    rawData: any[],
    existingData?: any[]
) => ImportResult<T>;
```

---

## 🔧 FASE 2: SERVIÇO BASE DE IMPORTAÇÃO

**Arquivo:** `src/services/baseImportService.ts`

```typescript
import * as XLSX from 'xlsx';

/**
 * Serviço base para importação de Excel/CSV
 * Centraliza lógica comum para todos os módulos (Invoice, Material, Client, Purchase)
 */
export const baseImportService = {
    /**
     * Parse genérico para ficheiros Excel/CSV
     * 
     * @param file Ficheiro Excel/CSV a processar
     * @returns Promise com array de objetos
     * 
     * Uso:
     * ```
     * const data = await baseImportService.parseFile(file);
     * ```
     */
    parseFile: (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    if (!workbook.SheetNames.length) {
                        reject(new Error('Ficheiro Excel vazio'));
                        return;
                    }
                    
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
                    
                    if (json.length === 0) {
                        reject(new Error('Nenhum dado encontrado na primeira folha'));
                        return;
                    }
                    
                    resolve(json);
                } catch (error) {
                    reject(new Error(`Erro ao processar ficheiro Excel: ${error}`));
                }
            };
            
            reader.onerror = (error) => {
                reject(new Error(`Erro ao ler ficheiro: ${error}`));
            };
            
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Encontra valor em linha Excel, testando múltiplas variações de nomes
     * 
     * @param row Linha do Excel
     * @param keys Possíveis nomes da coluna (ex: ['name', 'nome', 'client_name'])
     * @returns Valor encontrado ou undefined
     * 
     * Uso:
     * ```
     * const name = baseImportService.findValue(row, ['name', 'nome', 'client_name']);
     * ```
     */
    findValue: (row: any, keys: string[]): any => {
        if (!row || typeof row !== 'object') return undefined;
        
        const rowKeys = Object.keys(row);
        
        // Busca exata (ignorando case)
        for (const key of keys) {
            const exactMatch = rowKeys.find(
                k => k.trim().toLowerCase() === key.toLowerCase()
            );
            
            if (exactMatch) {
                const value = row[exactMatch];
                
                // Aceita qualquer valor que não seja null/undefined vazio
                if (value !== undefined && value !== null && value !== '') {
                    return value;
                }
            }
        }
        
        return undefined;
    },

    /**
     * Como findValue, mas retorna sempre string
     */
    findStringValue: (row: any, keys: string[]): string => {
        const value = baseImportService.findValue(row, keys);
        
        if (value === undefined || value === null) {
            return '';
        }
        
        return String(value).trim();
    },

    /**
     * Parse robusto de datas com suporte a múltiplos formatos
     * 
     * @param val Data em qualquer formato (string, número Excel, Date)
     * @param defaultDate Data padrão se inválida (atual por padrão)
     * @returns Data em formato ISO string (YYYY-MM-DD)
     * 
     * Suporta:
     * - "2024-01-15"
     * - "15/01/2024"
     * - "01-15-2024"
     * - 45324 (Número serial Excel)
     * - Date object
     */
    parseDate: (val: any, defaultDate?: string): string => {
        if (!val) {
            return defaultDate || new Date().toISOString().split('T')[0];
        }
        
        // Se é número, assume formato Excel (dias desde 1900-01-01)
        if (typeof val === 'number') {
            try {
                const date = new Date((val - 25569) * 86400 * 1000);
                const iso = date.toISOString().split('T')[0];
                // Validar se resultado parece razoável
                const year = parseInt(iso.split('-')[0]);
                if (year >= 1900 && year <= 2100) {
                    return iso;
                }
            } catch {
                // Fallback
            }
        }
        
        // Se é string, tentar parse direto
        if (typeof val === 'string') {
            const trimmed = val.trim();
            
            // Tentar formato ISO direto
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                const parsed = new Date(trimmed);
                if (!isNaN(parsed.getTime())) return trimmed;
            }
            
            // Tentar formato português (DD/MM/YYYY)
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
                const [day, month, year] = trimmed.split('/');
                const parsed = new Date(`${year}-${month}-${day}`);
                if (!isNaN(parsed.getTime())) {
                    return parsed.toISOString().split('T')[0];
                }
            }
            
            // Tentar Date parse nativo
            const parsed = new Date(trimmed);
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
            }
        }
        
        // Se é objeto Date
        if (val instanceof Date && !isNaN(val.getTime())) {
            return val.toISOString().split('T')[0];
        }
        
        return defaultDate || new Date().toISOString().split('T')[0];
    },

    /**
     * Parse robusto de números
     * 
     * @param val Valor a converter
     * @param defaultValue Valor padrão se inválido
     * @returns Número com 2 casas decimais
     */
    parseNumber: (val: any, defaultValue: number = 0): number => {
        if (val === undefined || val === null || val === '') {
            return defaultValue;
        }
        
        if (typeof val === 'number') {
            return Math.round(val * 100) / 100;
        }
        
        if (typeof val === 'string') {
            // Remove formatação comum (ex: "1.234,56" ou "1,234.56")
            const cleaned = val
                .replace(/\./g, '') // Remove todos os pontos
                .replace(',', '.')  // Converte última vírgula em ponto
                .trim();
            
            const num = parseFloat(cleaned);
            return isNaN(num) ? defaultValue : Math.round(num * 100) / 100;
        }
        
        return defaultValue;
    },

    /**
     * Parse robusto de booleanos
     * 
     * @param val Valor a converter
     * @returns true se for reconhecido como "sim" ou similar
     */
    parseBoolean: (val: any): boolean => {
        if (typeof val === 'boolean') return val;
        
        if (typeof val === 'number') return val !== 0;
        
        if (typeof val === 'string') {
            const lower = val.toLowerCase().trim();
            return ['true', 'sim', 's', '1', 'yes', 'y'].includes(lower);
        }
        
        return false;
    },

    /**
     * Validadores comuns reutilizáveis
     */
    validators: {
        /**
         * Campo obrigatório
         */
        required: (value: any, fieldName: string): string | null => {
            if (value === undefined || value === null) {
                return `${fieldName} é obrigatório.`;
            }
            
            if (typeof value === 'string' && value.trim().length === 0) {
                return `${fieldName} é obrigatório.`;
            }
            
            return null;
        },

        /**
         * NIF válido (9 dígitos)
         */
        nif: (nif: string): boolean => {
            if (!nif) return false;
            const clean = nif.replace(/[^0-9]/g, '');
            return clean.length === 9 && /^[0-9]{9}$/.test(clean);
        },

        /**
         * Email válido
         */
        email: (email: string): boolean => {
            if (!email) return false;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
        },

        /**
         * Número positivo
         */
        positiveNumber: (value: number, fieldName: string): string | null => {
            if (value < 0) {
                return `${fieldName} não pode ser negativo.`;
            }
            return null;
        },

        /**
         * Valor dentro de intervalo
         */
        range: (
            value: number,
            min: number,
            max: number,
            fieldName: string
        ): string | null => {
            if (value < min || value > max) {
                return `${fieldName} deve estar entre ${min} e ${max}.`;
            }
            return null;
        }
    }
};
```

---

## 🎣 FASE 3: HOOK BASE DE IMPORTAÇÃO

**Arquivo:** `src/hooks/useBaseImport.ts`

```typescript
import React, { useState, useRef, useCallback } from 'react';
import { ImportResult } from '../types/import';
import { baseImportService } from '../services/baseImportService';
import { useNotification } from '../contexts/NotificationContext';

export interface UseBaseImportOptions<T, E> {
    /**
     * Dados atuais
     */
    data: E[];
    
    /**
     * Setter para dados
     */
    setData: React.Dispatch<React.SetStateAction<E[]>>;
    
    /**
     * Função para processar importação
     * Recebe raw data do Excel e retorna ImportResult
     */
    processImport: (rawData: any[], existingData: E[]) => ImportResult<T>;
    
    /**
     * Função para converter draft (resultado da importação) para entity
     */
    convertToEntity: (draft: Partial<T>) => E;
    
    /**
     * Callback opcional após importação bem-sucedida
     */
    onImportSuccess?: (count: number) => void;
    
    /**
     * Callback opcional após erro
     */
    onImportError?: (error: string) => void;
}

/**
 * Hook genérico para importação de dados
 * Reutilizável para Invoice, Material, Client, Purchase, etc.
 * 
 * Uso:
 * ```typescript
 * const importHook = useBaseImport({
 *     data: materials,
 *     setData: setMaterials,
 *     processImport: materialImportService.processImport,
 *     convertToEntity: (draft) => ({
 *         ...draft,
 *         id: Date.now(),
 *         createdAt: new Date().toISOString()
 *     } as Material),
 *     onImportSuccess: (count) => notify('success', `${count} materiais importados`)
 * });
 * ```
 */
export const useBaseImport = <T, E>({
    data,
    setData,
    processImport,
    convertToEntity,
    onImportSuccess,
    onImportError
}: UseBaseImportOptions<T, E>) => {
    const { notify } = useNotification();
    
    // Estado modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Estado dos resultados
    const [result, setResult] = useState<ImportResult<T>>({
        drafts: [],
        errors: [],
        summary: { total: 0, valid: 0, invalid: 0 }
    });
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Abre modal de importação
     */
    const openModal = useCallback(() => {
        setResult({
            drafts: [],
            errors: [],
            summary: { total: 0, valid: 0, invalid: 0 }
        });
        setIsModalOpen(true);
    }, []);

    /**
     * Fecha modal de importação
     */
    const closeModal = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    /**
     * Handler para seleção de ficheiro
     */
    const handleFileSelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            setIsLoading(true);
            try {
                // Parsing do ficheiro
                const rawData = await baseImportService.parseFile(file);
                
                // Processamento da importação
                const processed = processImport(rawData, data);
                
                // Atualizar estado de resultado
                setResult(processed);
                
                // Log para debug
                console.log('✅ Importação processada:', processed);
            } catch (error) {
                console.error('❌ Erro ao processar importação:', error);
                
                const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao ler ficheiro Excel.';
                notify('error', errorMessage);
                
                onImportError?.(errorMessage);
            } finally {
                setIsLoading(false);
                
                // Limpar input
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        },
        [data, processImport, notify, onImportError]
    );

    /**
     * Handler para confirmar importação
     */
    const confirmImport = useCallback(() => {
        if (result.drafts.length === 0) {
            notify('warning', 'Nenhum registro válido para importar.');
            return;
        }

        try {
            // Converter drafts para entities
            const newEntities: E[] = result.drafts.map(draft => {
                try {
                    return convertToEntity(draft);
                } catch (error) {
                    console.error('❌ Erro ao converter draft:', draft, error);
                    throw error;
                }
            });

            // Atualizar dados
            setData(prev => [...newEntities, ...prev]);

            // Notificação de sucesso
            const message = `${newEntities.length} registos importados com sucesso.`;
            notify('success', message);

            // Callback
            onImportSuccess?.(newEntities.length);

            // Fechar modal
            closeModal();
        } catch (error) {
            console.error('❌ Erro ao confirmar importação:', error);
            const errorMessage = error instanceof Error ? error.message : 'Erro ao importar dados';
            notify('error', errorMessage);
            onImportError?.(errorMessage);
        }
    }, [result.drafts, convertToEntity, setData, notify, onImportSuccess, onImportError, closeModal]);

    /**
     * Handler para rejeitar importação (voltar atrás)
     */
    const cancelImport = useCallback(() => {
        setResult({
            drafts: [],
            errors: [],
            summary: { total: 0, valid: 0, invalid: 0 }
        });
        closeModal();
    }, [closeModal]);

    /**
     * Retorna interface pública do hook
     */
    return {
        // Estado
        isModalOpen,
        isLoading,
        result,
        
        // Refs
        fileInputRef,
        
        // Métodos
        openModal,
        closeModal,
        handleFileSelect,
        confirmImport,
        cancelImport,
        
        // Atalho para testar
        setResult
    };
};

export type UseBaseImportReturn<T, E> = ReturnType<typeof useBaseImport<T, E>>;
```

---

## 🧩 FASE 4: COMPONENTES BASE

### 4.1 BaseImportModal Principal

**Arquivo:** `src/components/common/BaseImportModal.tsx`

```typescript
import React, { useEffect } from 'react';
import { Upload, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';
import Modal from '../Modal';
import { useHelp } from '../../contexts/HelpContext';
import { ImportResult } from '../../types/import';
import { ImportStatsHeader } from './ImportStatsHeader';
import { ImportTabs } from './ImportTabs';
import { ImportDataTable } from './ImportDataTable';
import { ImportErrorsTable } from './ImportErrorsTable';
import { ImportActions } from './ImportActions';

interface BaseImportModalProps<T> {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    result: ImportResult<T>;
    onConfirm: () => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    
    // Customização
    title: string;
    formatHelpContent: () => { title: string; content: string };
    columns: Array<{
        key: keyof T | string;
        label: string;
        format?: (value: any) => string;
    }>;
}

/**
 * Modal genérico para importação de Excel
 * Reutilizável para qualquer tipo de entidade
 */
export const BaseImportModal = React.forwardRef<
    HTMLDivElement,
    BaseImportModalProps<any>
>(({
    isOpen,
    onClose,
    isLoading,
    result,
    onConfirm,
    onFileSelect,
    fileInputRef,
    title,
    formatHelpContent,
    columns
}, ref) => {
    const { setHelpContent, toggleHelp, isHelpOpen } = useHelp();
    const [activeTab, setActiveTab] = React.useState<'valid' | 'errors'>('valid');

    const hasData = result.drafts.length > 0 || result.errors.length > 0;

    // Auto-switch a tabs se houver apenas erros
    useEffect(() => {
        if (hasData) {
            if (result.drafts.length === 0 && result.errors.length > 0) {
                setActiveTab('errors');
            } else if (result.drafts.length > 0) {
                setActiveTab('valid');
            }
        }
    }, [hasData, result.drafts.length, result.errors.length]);

    const handleShowFormatHelp = () => {
        const content = formatHelpContent();
        setHelpContent(content);
        if (!isHelpOpen) toggleHelp();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${title} (Excel)`}>
            <div className="flex flex-col h-[85vh]" ref={ref}>
                {/* Header com estatísticas */}
                <ImportStatsHeader
                    validCount={result.drafts.length}
                    errorCount={result.errors.length}
                    isLoading={isLoading}
                />

                {/* Estado vazio - mostrar botões e ajuda */}
                {!hasData && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
                        <Upload size={48} className="text-gray-300" />
                        
                        <p className="text-gray-500 text-center max-w-xs">
                            Carregue um ficheiro Excel para visualizar e importar os dados.
                        </p>

                        <div className="flex gap-2">
                            <button
                                onClick={handleShowFormatHelp}
                                className="bg-white border border-blue-200 text-blue-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-50 transition-colors shadow-sm text-xs uppercase tracking-wider"
                            >
                                <HelpCircle size={16} /> Ajuda
                            </button>
                            
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50"
                            >
                                <Upload size={18} /> Selecionar Ficheiro
                            </button>
                        </div>
                    </div>
                )}

                {/* Estado carregado - mostrar abas e tabelas */}
                {hasData && (
                    <>
                        <ImportTabs
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            validCount={result.drafts.length}
                            errorCount={result.errors.length}
                        />

                        <div className="flex-1 overflow-auto bg-gray-50 border rounded-xl relative">
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                                </div>
                            )}

                            {activeTab === 'valid' && (
                                <ImportDataTable
                                    data={result.drafts}
                                    columns={columns}
                                />
                            )}

                            {activeTab === 'errors' && (
                                <ImportErrorsTable
                                    errors={result.errors}
                                />
                            )}
                        </div>
                    </>
                )}

                {/* Input hidden para ficheiro */}
                <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={onFileSelect}
                    disabled={isLoading}
                />

                {/* Botões de ação (sempre visível) */}
                <ImportActions
                    hasData={hasData}
                    onCancel={onClose}
                    onConfirm={onConfirm}
                    isDisabled={result.drafts.length === 0}
                    hasErrors={result.errors.length > 0}
                />
            </div>
        </Modal>
    );
});

BaseImportModal.displayName = 'BaseImportModal';
```

### 4.2 Subcomponentes

**Arquivo:** `src/components/common/ImportStatsHeader.tsx`

```typescript
import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface ImportStatsHeaderProps {
    validCount: number;
    errorCount: number;
    isLoading?: boolean;
}

export const ImportStatsHeader: React.FC<ImportStatsHeaderProps> = ({
    validCount,
    errorCount,
    isLoading
}) => {
    return (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-4 mb-4 shrink-0">
            <div className="flex gap-6">
                <div className="flex items-center gap-2">
                    <div className="bg-green-100 text-green-700 p-2 rounded-lg">
                        <CheckCircle2 size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">
                            Válidos
                        </p>
                        <p className="text-lg font-black text-green-700">{validCount}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-red-100 text-red-700 p-2 rounded-lg">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">
                            Erros
                        </p>
                        <p className="text-lg font-black text-red-700">{errorCount}</p>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="text-xs text-blue-600 font-bold flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                    Processando...
                </div>
            )}
        </div>
    );
};
```

**Arquivo:** `src/components/common/ImportTabs.tsx`

```typescript
import React from 'react';

interface ImportTabsProps {
    activeTab: 'valid' | 'errors';
    setActiveTab: (tab: 'valid' | 'errors') => void;
    validCount: number;
    errorCount: number;
}

export const ImportTabs: React.FC<ImportTabsProps> = ({
    activeTab,
    setActiveTab,
    validCount,
    errorCount
}) => {
    return (
        <div className="flex gap-2 mb-2 border-b shrink-0">
            <button
                onClick={() => setActiveTab('valid')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'valid'
                        ? 'border-green-500 text-green-700'
                        : 'border-transparent text-gray-400'
                }`}
            >
                Dados Válidos ({validCount})
            </button>
            <button
                onClick={() => setActiveTab('errors')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === 'errors'
                        ? 'border-red-500 text-red-700'
                        : 'border-transparent text-gray-400'
                }`}
            >
                Erros ({errorCount})
            </button>
        </div>
    );
};
```

**Arquivo:** `src/components/common/ImportDataTable.tsx`

```typescript
import React from 'react';

interface Column {
    key: string;
    label: string;
    format?: (value: any) => string;
}

interface ImportDataTableProps {
    data: any[];
    columns: Column[];
}

export const ImportDataTable: React.FC<ImportDataTableProps> = ({
    data,
    columns
}) => {
    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Nenhum dado válido
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-xs whitespace-nowrap">
                <thead className="bg-gray-100 sticky top-0 font-bold text-gray-500 uppercase z-10">
                    <tr>
                        {columns.map(col => (
                            <th
                                key={col.key}
                                className="p-3 text-left border-b"
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {data.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-100">
                            {columns.map(col => (
                                <td
                                    key={`${idx}-${col.key}`}
                                    className="p-3 text-gray-600"
                                >
                                    {col.format
                                        ? col.format((item as any)[col.key])
                                        : (item as any)[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
```

**Arquivo:** `src/components/common/ImportErrorsTable.tsx`

```typescript
import React from 'react';
import { ImportError } from '../../types/import';

interface ImportErrorsTableProps {
    errors: ImportError[];
}

export const ImportErrorsTable: React.FC<ImportErrorsTableProps> = ({
    errors
}) => {
    if (errors.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Nenhum erro
            </div>
        );
    }

    return (
        <table className="min-w-full text-xs">
            <thead className="bg-red-50 sticky top-0 font-bold text-red-800 uppercase">
                <tr>
                    <th className="p-3 text-left w-20">Linha</th>
                    <th className="p-3 text-left">Mensagem</th>
                    <th className="p-3 text-center w-24">Tipo</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-red-100 bg-white">
                {errors.map((err, i) => (
                    <tr key={i} className="hover:bg-red-50/30">
                        <td className="p-3 font-mono text-gray-600 border-r border-red-50">
                            L.{err.line}
                        </td>
                        <td className="p-3 text-gray-800">{err.message}</td>
                        <td className="p-3 text-center">
                            <span
                                className={`px-2 py-0.5 rounded uppercase font-black text-[10px] ${
                                    err.type === 'error'
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-orange-100 text-orange-600'
                                }`}
                            >
                                {err.type}
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};
```

**Arquivo:** `src/components/common/ImportActions.tsx`

```typescript
import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ImportActionsProps {
    hasData: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    isDisabled: boolean;
    hasErrors: boolean;
}

export const ImportActions: React.FC<ImportActionsProps> = ({
    hasData,
    onCancel,
    onConfirm,
    isDisabled,
    hasErrors
}) => {
    return (
        <div className="flex justify-between items-center border-t pt-4 shrink-0 gap-3">
            <button
                onClick={onCancel}
                className="px-6 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50"
            >
                Cancelar
            </button>

            <div className="flex gap-3">
                {hasErrors && (
                    <span className="flex items-center text-xs text-orange-600 font-bold bg-orange-50 px-3 rounded-lg border border-orange-100">
                        <AlertCircle size={14} className="mr-1" /> Linhas com erro serão ignoradas.
                    </span>
                )}

                <button
                    onClick={onConfirm}
                    disabled={!hasData || isDisabled}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Importar
                </button>
            </div>
        </div>
    );
};
```

---

## 📝 FASE 5: ADAPTAÇÃO DE EXISTENTES

### 5.1 Refatorar InvoiceImportModal

**Novo arquivo:** `src/invoicing/components/InvoiceImportModal.tsx`

```typescript
import React from 'react';
import { BaseImportModal } from '../../components/common/BaseImportModal';
import { Invoice } from '../../types';
import { ImportResult } from '../../types/import';

interface InvoiceImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    result: ImportResult<any>;
    onConfirm: () => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
}

export const InvoiceImportModal: React.FC<InvoiceImportModalProps> = (props) => {
    const handleShowFormatHelp = () => ({
        title: "Formato do Ficheiro de Importação",
        content: `
            <p class="mb-2">Para importar faturas corretamente, o ficheiro Excel deve seguir a estrutura abaixo.</p>
            <h4 class="font-bold text-gray-800 mt-3 mb-1">Colunas Obrigatórias</h4>
            <ul class="list-disc pl-4 space-y-1 text-sm">
                <li><strong>invoice_ref</strong>: Agrupador (mesmo ref = mesma fatura)</li>
                <li><strong>type</strong>: FTE, FRE, TVE, NCE, RCE, NDE</li>
                <li><strong>date</strong>: Data do documento</li>
                <li><strong>client_name</strong>: Nome do cliente</li>
                <li><strong>amount</strong> ou <strong>total</strong>: Valor total</li>
            </ul>
        `
    });

    return (
        <BaseImportModal
            {...props}
            title="Importar Faturas"
            formatHelpContent={handleShowFormatHelp}
            columns={[
                { key: 'invoice_ref', label: 'Ref.' },
                { key: 'type', label: 'Tipo' },
                { key: 'date', label: 'Data' },
                { key: 'client_name', label: 'Cliente' },
                { key: 'total', label: 'Total', format: (v) => `${v} CVE` }
            ]}
        />
    );
};
```

### 5.2 Refatorar useInvoiceImport

```typescript
import React from 'react';
import { useBaseImport } from '../../hooks/useBaseImport';
import { Invoice, Client, Material, SystemSettings } from '../../types';
import { invoiceImportService } from '../services/invoiceImportService';
import { baseImportService } from '../../services/baseImportService';

export const useInvoiceImport = (
    clients: Client[],
    setClients: React.Dispatch<React.SetStateAction<Client[]>>,
    materials: Material[],
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>,
    settings: SystemSettings,
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>
) => {
    return useBaseImport({
        data: [],
        setData: setInvoices,
        processImport: (rawData) => invoiceImportService.processImport(rawData, clients, settings),
        convertToEntity: (draft) => ({
            ...draft,
            id: `INV-${Date.now()}`,
            createdAt: new Date().toISOString()
        } as Invoice),
        onImportSuccess: (count) => {
            // Lógica pós-importação específica de invoices
            console.log(`${count} invoices importadas`);
        }
    });
};
```

---

## ✅ CHECKLIST DE TESTE

Após cada fase:

```bash
# Testes de build
npm run build

# Testes lint
npm run lint

# Testes unitários (se existirem)
npm test

# Verificar imports
grep -r "InvoiceImportModal" src/ --include="*.tsx" --include="*.ts"
grep -r "useInvoiceImport" src/ --include="*.tsx" --include="*.ts"
```

---

**Próximo passo:** Implementar Fase 1 - Preparação do Ambiente

