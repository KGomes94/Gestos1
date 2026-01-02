/**
 * Hook reutilizável para gestão de importação de dados
 * Consolidado de: useInvoiceImport, useMaterialImport, useClientImport, usePurchaseImport
 * 
 * Elimina ~350 linhas de código duplicado
 */

import { useState, useCallback } from 'react';
import {
  ImportResult,
  ImportedRow,
  ImportError,
  ImportSummary,
  ImportModalState,
  RawImportData,
  ImportOptions,
  ImportProgressCallback,
} from '../../types/import';
import { baseImportService } from '../../services/baseImportService';

interface UseBaseImportProps<T> {
  onSuccess?: (data: ImportedRow<T>[]) => void;
  onError?: (error: Error) => void;
  columnMapping?: Record<string, string[]>;
  validators?: Record<string, (value: unknown) => boolean | string>;
  defaultValues?: Partial<T>;
}

interface UseBaseImportReturn<T> {
  state: ImportModalState<T>;
  actions: {
    openModal: () => void;
    closeModal: () => void;
    selectFile: (file: File) => void;
    previewData: () => Promise<RawImportData>;
    confirmImport: (processor: (row: Record<string, unknown>) => T | null) => Promise<void>;
    resetState: () => void;
  };
  stats: {
    totalRows: number;
    successCount: number;
    warningCount: number;
    errorCount: number;
    successPercentage: number;
  };
}

const initialState = <T,>(): ImportModalState<T> => ({
  isOpen: false,
  file: null,
  isLoading: false,
  results: null,
  activeTab: 'upload',
  error: null,
  successMessage: null,
});

/**
 * Hook genérico para importação de dados
 * 
 * @example
 * const { state, actions, stats } = useBaseImport<ImportedInvoice>({
 *   columnMapping: {
 *     'invoiceNumber': ['Invoice #', 'Nº Fatura', 'Number'],
 *     'amount': ['Total', 'Montante', 'Amount']
 *   },
 *   validators: {
 *     'invoiceNumber': (val) => typeof val === 'string' && val.length > 0,
 *     'amount': (val) => typeof val === 'number' && val > 0
 *   }
 * });
 */
export function useBaseImport<T = Record<string, unknown>>(
  props: UseBaseImportProps<T> = {}
): UseBaseImportReturn<T> {
  const [state, setState] = useState<ImportModalState<T>>(initialState<T>());

  // ========== AÇÕES DE MODAL ==========

  const openModal = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true, error: null }));
  }, []);

  const closeModal = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const selectFile = useCallback((file: File) => {
    setState((prev) => ({
      ...prev,
      file,
      error: null,
      activeTab: 'preview',
    }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState<T>());
  }, []);

  // ========== PROCESSAMENTO DE IMPORTAÇÃO ==========

  /**
   * Preview dos dados antes de importar
   */
  const previewData = useCallback(async (): Promise<RawImportData> => {
    if (!state.file) {
      throw new Error('Nenhum ficheiro selecionado');
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const rawData = await baseImportService.parseFile(state.file);
      return rawData;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao processar ficheiro';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [state.file]);

  /**
   * Confirmar importação com processador customizado
   */
  const confirmImport = useCallback(
    async (processor: (row: Record<string, unknown>) => T | null) => {
      if (!state.file) {
        throw new Error('Nenhum ficheiro selecionado');
      }

      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        const startTime = performance.now();

        // Parse do ficheiro
        const rawData = await baseImportService.parseFile(state.file);

        // Processamento de linhas
        const importedRows: ImportedRow<T>[] = [];
        let successCount = 0;
        let warningCount = 0;
        let errorCount = 0;

        for (let i = 0; i < rawData.rows.length; i++) {
          const rawRow = rawData.rows[i];
          const rowNumber = i + 2; // +2 porque começa em 1 e há header
          const errors: ImportError[] = [];

          try {
            // Processador customizado (específico de cada módulo)
            const processedData = processor(rawRow);

            if (!processedData) {
              errorCount++;
              importedRows.push({
                id: `row-${rowNumber}`,
                rowNumber,
                data: {} as T,
                status: 'error',
                errors: [{ field: 'row', message: 'Falha ao processar linha' }],
              });
              continue;
            }

            // Validação customizada (se fornecida)
            if (props.validators) {
              for (const [field, validator] of Object.entries(props.validators)) {
                const value = (processedData as Record<string, unknown>)[field];
                const validationResult = validator(value);

                if (validationResult === false || (typeof validationResult === 'string' && validationResult)) {
                  errors.push({
                    field,
                    message: typeof validationResult === 'string' ? validationResult : `Campo inválido: ${field}`,
                    value,
                  });
                }
              }
            }

            const status = errors.length > 0 ? 'warning' : 'success';
            if (status === 'success') successCount++;
            else warningCount++;

            importedRows.push({
              id: `row-${rowNumber}`,
              rowNumber,
              data: processedData,
              status,
              errors,
            });
          } catch (error) {
            errorCount++;
            importedRows.push({
              id: `row-${rowNumber}`,
              rowNumber,
              data: {} as T,
              status: 'error',
              errors: [
                {
                  field: 'row',
                  message: error instanceof Error ? error.message : 'Erro desconhecido',
                },
              ],
            });
          }
        }

        const duration = performance.now() - startTime;
        const summary: ImportSummary = {
          totalRows: rawData.rows.length,
          successCount,
          warningCount,
          errorCount,
          duration,
          timestamp: new Date(),
          fileName: state.file.name,
        };

        const result: ImportResult<T> = {
          success: errorCount === 0,
          data: importedRows,
          summary,
          errors: importedRows.flatMap((row) => row.errors),
        };

        setState((prev) => ({
          ...prev,
          results: result,
          activeTab: 'results',
          successMessage: `Importação concluída: ${successCount} sucesso, ${warningCount} avisos, ${errorCount} erros`,
        }));

        // Callback de sucesso
        if (props.onSuccess && result.success) {
          props.onSuccess(importedRows.filter((row) => row.status === 'success'));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao importar';
        setState((prev) => ({ ...prev, error: message }));

        if (props.onError) {
          props.onError(error instanceof Error ? error : new Error(message));
        }
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [state.file, props]
  );

  // ========== COMPUTAÇÕES DE ESTATÍSTICAS ==========

  const stats = {
    totalRows: state.results?.summary.totalRows ?? 0,
    successCount: state.results?.summary.successCount ?? 0,
    warningCount: state.results?.summary.warningCount ?? 0,
    errorCount: state.results?.summary.errorCount ?? 0,
    successPercentage:
      state.results && state.results.summary.totalRows > 0
        ? Math.round((state.results.summary.successCount / state.results.summary.totalRows) * 100)
        : 0,
  };

  // ========== RETORNO ==========

  return {
    state,
    actions: {
      openModal,
      closeModal,
      selectFile,
      previewData,
      confirmImport,
      resetState,
    },
    stats,
  };
}
