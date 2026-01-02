# 🔧 ESPECIFICAÇÃO TÉCNICA DETALHADA - MÓDULO IMPORTAÇÃO HISTÓRICA

**Data:** Janeiro 2, 2026  
**Versão:** 1.0  
**Público:** Desenvolvedores

---

## 📌 ÍNDICE

1. [Arquitetura](#arquitetura)
2. [Componentes](#componentes)
3. [Serviços](#serviços)
4. [Tipos de Dados](#tipos-de-dados)
5. [Fluxo de Dados](#fluxo-de-dados)
6. [Algoritmos Principais](#algoritmos-principais)
7. [Integração com Módulos Existentes](#integração-com-módulos-existentes)
8. [Performance e Escalabilidade](#performance-e-escalabilidade)
9. [Testes](#testes)
10. [Deployment](#deployment)

---

## 🏗️ ARQUITETURA

### Padrão: Modular Hexagonal

```
┌─────────────────────────────────────────────────────────┐
│                    ADAPTERS (UI)                        │
│  ┌──────────────┬──────────────┬──────────────┐        │
│  │ Components   │ Hooks        │ Contexts     │        │
│  └──────────────┴──────────────┴──────────────┘        │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              APPLICATION (Orquestração)                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │ useHistoricalImport (Hook Principal)             │  │
│  │ - Estado global do wizard                        │  │
│  │ - Transições entre telas                        │  │
│  │ - Confirmação de ações                          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│               DOMAIN (Lógica de Negócio)               │
│  ┌──────────┬──────────────┬────────────────┐         │
│  │ Bank     │ Invoices     │ Payments       │         │
│  │ Processor│ Processor    │ Processor      │         │
│  │          │              │                │         │
│  │ • Parse  │ • Parse      │ • Parse        │         │
│  │ • Validate│ • Validate  │ • Validate    │         │
│  │ • Map    │ • Map       │ • Map         │         │
│  └──────────┴──────────────┴────────────────┘         │
│  ┌──────────────────────────────────────────────┐     │
│  │ ReconciliationEngine                         │     │
│  │ • Scoring Algorithm                          │     │
│  │ • Matching Logic                             │     │
│  │ • Deduplication                              │     │
│  └──────────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────────┐     │
│  │ Validators                                   │     │
│  │ • Format Validation                          │     │
│  │ • Business Rule Validation                   │     │
│  │ • Completeness Check                         │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              INFRASTRUCTURE (Persistência)              │
│  ┌──────────────┬──────────────┬──────────────┐        │
│  │ DB Service   │ Drive Service│ Local Cache  │        │
│  │ (Supabase)   │ (Google)     │ (IndexedDB)  │        │
│  └──────────────┴──────────────┴──────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Separação de Responsabilidades

| Camada | Responsabilidade | Exemplo |
|--------|------------------|---------|
| **UI** | Renderização, interação | `ValidationPreview.tsx` |
| **Hooks** | Estado, efeitos colaterais | `useHistoricalImport.ts` |
| **Services** | Lógica de negócio | `bankStatementProcessor.ts` |
| **Validators** | Regras de validação | `historicalImportValidators.ts` |
| **DB** | Persistência | `db.ts` (Supabase) |

---

## 🧩 COMPONENTES

### 1. HistoricalImportWizard.tsx

**Responsabilidade:** Orquestrador das 5 telas do wizard

```typescript
interface HistoricalImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: (sessionId: string) => void;
}

interface WizardState {
    currentStep: 0 | 1 | 2 | 3 | 4;
    sources: SelectedSources;
    uploads: UploadedFile[];
    mappings: ColumnMappingConfig;
    validationResults: ValidationResult[];
    reconciliationMatches: ReconciliationMatch[];
    importResult?: ImportResult;
    isLoading: boolean;
    error?: Error;
}
```

**Fluxo:**
```
┌─────────────┐
│   Step 0    │  Seleção de fontes
│   Selector  │
└──────┬──────┘
       │
       ▼
┌──────────────┐
│   Step 1     │  Upload + Mapeamento
│   Mapping    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Step 2     │  Validação + Preview
│ Validation   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Step 3     │  Reconciliação manual
│Reconcile     │  (apenas matches duvidosos)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Step 4     │  Confirmação e resumo
│   Results    │
└──────────────┘
```

### 2. DataSourceSelector.tsx

**Entrada:** Nenhuma
**Saída:** `selectedSources: ('bank' | 'invoices' | 'payments')[]`

```typescript
interface DataSourceSelectorProps {
    onSelect: (sources: SourceType[]) => void;
    onCancel: () => void;
}

// Renderiza 3 cards clicáveis:
// 1. Extrato Banco (BankTransaction)
// 2. Faturas Emitidas (Invoice)
// 3. Pagtos/Recebimentos (Transaction)
```

### 3. ColumnMappingUI.tsx

**Entrada:** `uploadedFile: File, sourceType: 'bank' | 'invoices' | 'payments'`
**Saída:** `mapping: ColumnMapping`

```typescript
interface ColumnMappingUIProps {
    file: File;
    sourceType: SourceType;
    initialMapping?: ColumnMapping;
    onMappingConfirmed: (mapping: ColumnMapping) => void;
    onCancel: () => void;
}

// Função:
// 1. Ler primeiras N linhas do ficheiro
// 2. Detectar colunas automaticamente
// 3. Sugerir mapeamento
// 4. Permitir ajuste manual
// 5. Mostrar preview com mapeamento
// 6. Confirmar e prosseguir
```

**Lógica:**
```typescript
const handleFileLoad = async (file: File) => {
    const firstRows = await parseFilePreview(file, 5);
    const detected = columnDetection.detectColumns(
        firstRows[0],
        firstRows.slice(1),
        sourceType
    );
    const suggested = columnDetection.suggestMapping(detected, sourceType);
    setMapping(suggested);
    setPreviewData(firstRows);
};

const handleMappingChange = (field: string, newValue: string) => {
    const updated = { ...mapping, [field]: newValue };
    const validation = columnDetection.validateMapping(updated);
    setMapping(updated);
    setMappingValid(validation.isValid);
};

const handleConfirm = () => {
    if (columnDetection.validateMapping(mapping).isValid) {
        onMappingConfirmed(mapping);
    }
};
```

### 4. ValidationPreview.tsx

**Entrada:** `uploadedFiles: UploadedFile[], mappings: ColumnMapping[]`
**Saída:** Confirmação ou ajustes

```typescript
interface ValidationPreviewProps {
    files: UploadedFile[];
    mappings: ColumnMappingConfig;
    onContinue: () => void;
    onReview: () => void;
    onCancel: () => void;
}

// Função:
// 1. Processar todos os ficheiros em paralelo
// 2. Executar validação completa
// 3. Mostrar resumo com estatísticas
// 4. Listar registos com avisos/erros
// 5. Permitir revisão antes de confirmar
```

**Workflow:**
```typescript
const handleValidateAll = async () => {
    setIsValidating(true);
    
    const results = await Promise.all(
        uploadedFiles.map(file =>
            historicalImportService.validate(
                file.data,
                file.type,
                mappings[file.type]
            )
        )
    );
    
    // Agregar resultados
    const summary = aggregateResults(results);
    
    // Mostrar preview
    setValidationResults(results);
    setSummary(summary);
    setIsValidating(false);
};
```

### 5. ReconciliationMatrix.tsx

**Entrada:** `validatedData: ImportProcessingResult[]`
**Saída:** `confirmedMatches: ReconciliationMatch[]`

```typescript
interface ReconciliationMatrixProps {
    bankTransactions: any[];
    importedInvoices: any[];
    importedPayments: any[];
    onConfirm: (matches: ReconciliationMatch[]) => void;
    onCancel: () => void;
}

// Função:
// 1. Calcular matches entre as 3 fontes
// 2. Filtrar apenas matches com confiança 50-95%
// 3. Para cada match: mostrar par de transações
// 4. Permitir aceitar/rejeitar cada match
// 5. Confirmar decisões antes de prosseguir
```

**Lógica:**
```typescript
useEffect(() => {
    const bankMap = createIndexedMap(bankTransactions);
    const invoiceMap = createIndexedMap(importedInvoices);
    const paymentMap = createIndexedMap(importedPayments);
    
    // Reconciliar banco com pagamentos
    const bankVsPayments = bankTransactions
        .map(bank => ({
            bank,
            candidates: reconciliationEngine.findMatches(
                bank,
                [...importedPayments, ...existingPayments],
                50  // score mínimo
            )
        }))
        .filter(m => m.candidates.length > 0);
    
    // Reconciliar banco com extratos de contas a receber
    const bankVsInvoices = bankTransactions
        .map(bank => ({
            bank,
            candidates: reconciliationEngine.findMatches(
                bank,
                [...importedInvoices, ...existingInvoices],
                50
            )
        }))
        .filter(m => m.candidates.length > 0);
    
    setMatches([...bankVsPayments, ...bankVsInvoices]);
}, [bankTransactions, importedInvoices, importedPayments]);
```

### 6. ImportResults.tsx

**Entrada:** `importResult: ImportResult, sessionId: string`
**Saída:** Resumo e ações próximas

```typescript
interface ImportResultsProps {
    result: ImportResult;
    sessionId: string;
    onComplete: () => void;
}

// Renderiza:
// 1. Resumo de estatísticas (gráficos)
// 2. Checklist de próximos passos
// 3. Links para revisão de dados
// 4. Ação de fecho/conclusão
```

---

## 🔧 SERVIÇOS

### 1. historicalImportService.ts

```typescript
export const historicalImportService = {
    // === SESSÃO ===
    createSession: async (
        year: number,
        sources: SourceType[]
    ): Promise<string> => {
        const sessionId = generateId();
        const session: HistoricalImportSession = {
            id: sessionId,
            createdAt: new Date().toISOString(),
            year,
            sources: sources.map(s => s),
            status: 'in_progress',
            summary: {
                totalRecords: 0,
                validRecords: 0,
                errorRecords: 0,
                matches: 0,
                newTransactions: 0,
                duplicatesRemoved: 0,
            },
            files: [],
            logs: [],
        };
        
        // Guardar em IndexedDB como cache local
        await importCache.saveSession(session);
        
        return sessionId;
    },

    // === PROCESSAMENTO ===
    processFile: async (
        sessionId: string,
        file: File,
        sourceType: SourceType,
        mapping: ColumnMapping
    ): Promise<ImportProcessingResult> => {
        const log = (msg: string) =>
            importCache.appendLog(sessionId, { level: 'info', message: msg });

        log(`Processando ficheiro: ${file.name}`);

        try {
            // 1. Parse do ficheiro
            log('Lendo ficheiro...');
            const rawData = await parseFile(file, sourceType);
            log(`Detectadas ${rawData.length} linhas`);

            // 2. Mapeamento e normalização
            log('Mapeando colunas...');
            let normalizedData: any[];
            
            if (sourceType === 'bank') {
                normalizedData = bankStatementProcessor.mapRows(rawData, mapping);
            } else if (sourceType === 'invoices') {
                normalizedData = invoiceProcessor.mapRows(rawData, mapping);
            } else {
                normalizedData = paymentProcessor.mapRows(rawData, mapping);
            }

            // 3. Validação
            log('Validando dados...');
            const validationResult = await historicalImportValidators
                .validateBatch(normalizedData, sourceType);

            const validRecords = normalizedData.filter(
                (_, i) => !validationResult.errors.some(e => e.line === i)
            );

            log(`Validação concluída: ${validRecords.length}/${normalizedData.length} válidos`);

            // 4. Detecção de duplicatas
            log('Detectando duplicatas...');
            const { unique: uniqueRecords, duplicates } =
                deduplicateExact(validRecords);

            log(`Duplicatas detectadas: ${duplicates.length}`);

            // 5. Preview
            const preview = uniqueRecords.slice(0, 10);

            const result: ImportProcessingResult = {
                source: sourceType,
                status: validationResult.errors.length === 0 ? 'success' : 'partial',
                recordsTotal: rawData.length,
                recordsValid: uniqueRecords.length,
                recordsErrors: validationResult.errors.length,
                recordsWarnings: validationResult.warnings.length,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
                preview,
            };

            // Guardar em cache
            await importCache.saveProcessed(sessionId, sourceType, {
                rawData,
                normalized: normalizedData,
                valid: uniqueRecords,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
            });

            return result;

        } catch (error) {
            log(`ERRO ao processar: ${error.message}`, 'error');
            throw error;
        }
    },

    // === RECONCILIAÇÃO ===
    reconcile: async (
        sessionId: string,
        sourceType: SourceType,
        existingData: any[]
    ): Promise<ReconciliationMatch[]> => {
        const cached = await importCache.getProcessed(sessionId, sourceType);
        const importedData = cached.valid;

        const matches: ReconciliationMatch[] = [];

        // Reconciliar cada registo importado com dados existentes
        for (const imported of importedData) {
            const candidates = reconciliationEngine.findMatches(
                imported,
                existingData,
                50  // score mínimo
            );

            matches.push(...candidates);
        }

        // Ordenar por score decrescente
        matches.sort((a, b) => b.confidence - a.confidence);

        return matches;
    },

    // === CONFIRMAÇÃO ===
    confirmImport: async (
        sessionId: string,
        confirmedMatches: ReconciliationMatch[]
    ): Promise<ImportResult> => {
        const session = await importCache.getSession(sessionId);
        
        try {
            const result: ImportResult = {
                sessionId,
                status: 'success',
                imported: { reconciled: 0, newTransactions: 0, duplicates: 0 },
                errors: [],
            };

            // Para cada fonte, gerar movimentos contabilísticos
            for (const source of session.sources) {
                const cached = await importCache.getProcessed(sessionId, source);

                if (source === 'bank') {
                    const transactions = bankStatementProcessor
                        .generateTransactions(cached.valid);
                    
                    // Inserir em DB
                    await db.insertBankTransactions(transactions);
                    result.imported.newTransactions += transactions.length;

                } else if (source === 'invoices') {
                    const invoices = invoiceProcessor
                        .generateInvoices(cached.valid);
                    
                    await db.insertInvoices(invoices);
                    result.imported.newTransactions += invoices.length;

                } else if (source === 'payments') {
                    const { payables, receivables } = paymentProcessor
                        .generateTransactions(cached.valid);
                    
                    await db.insertTransactions([...payables, ...receivables]);
                    result.imported.newTransactions += payables.length + receivables.length;
                }
            }

            // Marcar como concluído
            session.status = 'completed';
            session.completedAt = new Date().toISOString();
            session.summary.newTransactions = result.imported.newTransactions;
            
            await importCache.saveSession(session);

            return result;

        } catch (error) {
            console.error('Erro ao confirmar importação:', error);
            session.status = 'failed';
            await importCache.saveSession(session);
            throw error;
        }
    },

    // === UTILITÁRIOS ===
    getHistory: async (): Promise<HistoricalImportSession[]> => {
        return await importCache.getAllSessions();
    },

    cancelSession: async (sessionId: string): Promise<void> => {
        await importCache.deleteSession(sessionId);
    },
};
```

### 2. bankStatementProcessor.ts

```typescript
export const bankStatementProcessor = {
    mapRows: (
        rawData: any[],
        mapping: BankColumnMapping
    ): NormalizedBankStatement[] => {
        return rawData.map((row, idx) => {
            const getValue = (columnKey: string) => {
                const colName = mapping[columnKey];
                return findValueByKey(row, colName);
            };

            const dateVal = getValue('dateColumn');
            const debitVal = getValue('debitColumn');
            const creditVal = getValue('creditColumn');

            const amount = (
                (parseNumber(creditVal) || 0) -
                (parseNumber(debitVal) || 0)
            );

            return {
                line: idx + 2,
                date: parseDate(dateVal),
                description: String(getValue('descriptionColumn') || 'N/A'),
                amount: amount,  // Positivo = crédito, negativo = débito
                balance: parseNumber(getValue('balanceColumn')),
                bank: String(getValue('bankColumn') || 'N/A'),
                reference: getValue('referenceColumn'),
                sourceFile: 'bank_statement.xlsx',
            };
        });
    },

    generateTransactions: (
        validated: NormalizedBankStatement[]
    ): BankTransaction[] => {
        return validated.map(stmt => ({
            id: generateId(),
            date: stmt.date,
            amount: Math.abs(stmt.amount),
            type: stmt.amount >= 0 ? 'credit' : 'debit',
            description: stmt.description,
            reference: stmt.reference || undefined,
            bank: stmt.bank,
            reconciled: false,
            createdFrom: 'historical_import_2025',
            metadata: {
                importLine: stmt.line,
                importFile: stmt.sourceFile,
            },
        }));
    },
};
```

### 3. invoiceProcessor.ts

```typescript
export const invoiceProcessor = {
    mapRows: (
        rawData: any[],
        mapping: InvoiceColumnMapping
    ): NormalizedInvoiceRecord[] => {
        return rawData.map((row, idx) => ({
            line: idx + 2,
            date: parseDate(findValue(row, mapping.dateColumn)),
            reference: String(findValue(row, mapping.referenceColumn) || ''),
            clientNif: normalizeNif(findValue(row, mapping.clientNifColumn)),
            clientName: String(findValue(row, mapping.clientNameColumn) || ''),
            amount: parseNumber(findValue(row, mapping.amountColumn)) || 0,
            description: String(findValue(row, mapping.descriptionColumn) || ''),
            dueDate: mapping.dueDateColumn
                ? parseDate(findValue(row, mapping.dueDateColumn))
                : undefined,
            sourceFile: 'invoices_import.xlsx',
        }));
    },

    generateInvoices: async (
        validated: NormalizedInvoiceRecord[],
        existingClients: Client[]
    ): Promise<Invoice[]> => {
        const invoices: Invoice[] = [];

        for (const record of validated) {
            // Procurar cliente existente
            let client = existingClients.find(c => c.nif === record.clientNif);

            if (!client) {
                // Criar novo cliente
                client = {
                    id: generateId(),
                    nif: record.clientNif,
                    company: record.clientName,
                    // ... outros campos com defaults
                };
            }

            // Gerar fatura
            const invoice: Invoice = {
                id: generateId(),
                reference: record.reference,
                clientId: client.id,
                date: record.date,
                dueDate: record.dueDate || addDays(record.date, 30),
                items: [
                    {
                        description: record.description,
                        quantity: 1,
                        unitPrice: record.amount,
                        taxRate: 15,  // Default
                        discount: 0,
                    },
                ],
                total: record.amount,
                status: 'issued',
                createdFrom: 'historical_import_2025',
                createdAt: new Date().toISOString(),
                metadata: {
                    importLine: record.line,
                    importFile: record.sourceFile,
                },
            };

            invoices.push(invoice);
        }

        return invoices;
    },
};
```

### 4. reconciliationEngine.ts

```typescript
export const reconciliationEngine = {
    calculateMatchScore: (
        record1: any,
        record2: any,
        options: ScoringOptions = {}
    ): number => {
        let score = 0;

        // === PESO 1: DATA (40%) ===
        const dateDiff = Math.abs(
            new Date(record1.date).getTime() - new Date(record2.date).getTime()
        ) / (1000 * 60 * 60 * 24);  // em dias

        if (dateDiff === 0) {
            score += 40;  // Mesma data
        } else if (dateDiff <= 1) {
            score += 30;  // 1 dia de diferença
        } else if (dateDiff <= 3) {
            score += 20;  // 3 dias
        } else if (dateDiff <= 7) {
            score += 10;  // 7 dias
        } else {
            score += 0;   // Mais de 7 dias
        }

        // === PESO 2: VALOR (40%) ===
        const amount1 = Math.abs(record1.amount || 0);
        const amount2 = Math.abs(record2.amount || 0);

        if (amount1 === 0 || amount2 === 0) {
            // score += 0;
        } else {
            const diff = Math.abs(amount1 - amount2) / amount1;

            if (diff === 0) {
                score += 40;  // Valor exacto
            } else if (diff <= 0.01) {
                score += 30;  // 1% diferença
            } else if (diff <= 0.05) {
                score += 20;  // 5% diferença
            } else if (diff <= 0.1) {
                score += 10;  // 10% diferença
            } else {
                score += 0;   // > 10%
            }
        }

        // === PESO 3: DESCRIÇÃO (20%) ===
        const desc1 = String(record1.description || '').toLowerCase();
        const desc2 = String(record2.description || '').toLowerCase();

        const similarity = calculateSimilarity(desc1, desc2);

        if (similarity >= 0.95) {
            score += 20;
        } else if (similarity >= 0.8) {
            score += 10;
        } else if (similarity >= 0.6) {
            score += 5;
        } else {
            score += 0;
        }

        // === PENALIDADES ===
        // Se tipo de transação é oposto (crédito vs débito)
        if (record1.type !== record2.type && record1.type && record2.type) {
            score *= 0.5;  // Reduzir score em 50%
        }

        return Math.min(score, 100);
    },

    findMatches: (
        record: any,
        candidates: any[],
        minScore: number = 50
    ): ReconciliationMatch[] => {
        const matches: ReconciliationMatch[] = [];

        for (const candidate of candidates) {
            const score = reconciliationEngine.calculateMatchScore(
                record,
                candidate
            );

            if (score >= minScore) {
                matches.push({
                    id: generateId(),
                    confidence: score,
                    source1: { ...record },
                    source2: { ...candidate },
                    matchType: score >= 95 ? 'exact' : score >= 80 ? 'fuzzy' : 'partial',
                    reasoning: buildReasoningString(record, candidate, score),
                    status: score >= 95 ? 'confirmed' : 'pending_review',
                });
            }
        }

        return matches.sort((a, b) => b.confidence - a.confidence);
    },

    findExactDuplicates: (records: any[]): Duplicate[] => {
        const duplicates: Duplicate[] = [];
        const seen = new Map<string, any>();

        for (const record of records) {
            const key = `${record.date}|${record.amount}|${record.description}`;

            if (seen.has(key)) {
                duplicates.push({
                    line1: record.line,
                    line2: seen.get(key).line,
                    record1: record,
                    record2: seen.get(key),
                });
            } else {
                seen.set(key, record);
            }
        }

        return duplicates;
    },
};
```

---

## 📊 TIPOS DE DADOS

### Core Types

```typescript
// historical-import.types.ts

// === CONFIGURAÇÃO ===

export type SourceType = 'bank' | 'invoices' | 'payments';

export interface BankColumnMapping {
    dateColumn: string;
    descriptionColumn: string;
    debitColumn: string;
    creditColumn: string;
    balanceColumn?: string;
    bankColumn?: string;
    referenceColumn?: string;
}

export interface InvoiceColumnMapping {
    dateColumn: string;
    referenceColumn: string;
    clientNifColumn: string;
    clientNameColumn: string;
    amountColumn: string;
    descriptionColumn?: string;
    dueDateColumn?: string;
}

export interface PaymentColumnMapping {
    dateColumn: string;
    entityColumn: string;
    typeColumn: string;
    descriptionColumn: string;
    amountColumn: string;
    statusColumn?: string;
    methodColumn?: string;
    referenceColumn?: string;
}

export type ColumnMapping = BankColumnMapping | InvoiceColumnMapping | PaymentColumnMapping;

export interface ColumnMappingConfig {
    bank?: BankColumnMapping;
    invoices?: InvoiceColumnMapping;
    payments?: PaymentColumnMapping;
}

// === DADOS NORMALIZADOS ===

export interface NormalizedBankStatement {
    line: number;
    date: string;
    description: string;
    amount: number;  // +ve = credit, -ve = debit
    balance?: number;
    bank: string;
    reference?: string;
    sourceFile: string;
}

export interface NormalizedInvoiceRecord {
    line: number;
    date: string;
    reference: string;
    clientNif: string;
    clientName: string;
    amount: number;
    description: string;
    dueDate?: string;
    sourceFile: string;
}

export interface NormalizedPaymentRecord {
    line: number;
    date: string;
    entity: string;
    type: 'payment' | 'receipt';
    amount: number;
    description: string;
    status: 'paid' | 'pending';
    method?: string;
    reference?: string;
    sourceFile: string;
}

// === VALIDAÇÃO ===

export interface ImportError {
    line: number;
    field?: string;
    code: string;
    message: string;
    severity: 'error' | 'warning';
    suggestion?: string;
}

export interface ImportWarning {
    line: number;
    field?: string;
    message: string;
    suggestion?: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ImportError[];
    warnings: ImportWarning[];
    recordsProcessed: number;
    recordsValid: number;
}

// === RESULTADO PROCESSAMENTO ===

export interface ImportProcessingResult {
    source: SourceType;
    status: 'success' | 'partial' | 'error';
    recordsTotal: number;
    recordsValid: number;
    recordsErrors: number;
    recordsWarnings: number;
    errors: ImportError[];
    warnings: ImportWarning[];
    preview: any[];
}

// === RECONCILIAÇÃO ===

export interface ReconciliationMatch {
    id: string;
    confidence: number;
    source1: {
        type: SourceType;
        id?: string;
        date: string;
        amount: number;
        description: string;
    };
    source2: {
        type: 'system' | SourceType;
        id?: string;
        date: string;
        amount: number;
        description: string;
    };
    matchType: 'exact' | 'fuzzy' | 'partial';
    reasoning: string;
    status: 'pending_review' | 'confirmed' | 'rejected';
}

// === SESSÃO ===

export interface HistoricalImportSession {
    id: string;
    createdAt: string;
    completedAt?: string;
    year: number;
    sources: SourceType[];
    status: 'in_progress' | 'completed' | 'failed' | 'aborted';
    
    summary: {
        totalRecords: number;
        validRecords: number;
        errorRecords: number;
        matches: number;
        newTransactions: number;
        duplicatesRemoved: number;
    };
    
    files: {
        name: string;
        type: SourceType;
        hash: string;
        uploadedAt: string;
        processedAt?: string;
        status: 'uploaded' | 'processing' | 'processed' | 'error';
    }[];
    
    logs: {
        timestamp: string;
        level: 'info' | 'warning' | 'error';
        message: string;
        details?: any;
    }[];
}

// === RESULTADO FINAL ===

export interface ImportResult {
    sessionId: string;
    status: 'success' | 'partial' | 'error';
    imported: {
        reconciled: number;
        newTransactions: number;
        duplicates: number;
    };
    errors: ImportError[];
}
```

---

## 🔄 FLUXO DE DADOS

### Fluxo Completo: De Ficheiro a DB

```
┌──────────────┐
│  Ficheiro    │
│  Excel/CSV   │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  1. PARSE        │ → rawData: any[]
│  Ler ficheiro    │
└──────┬───────────┘
       │
       ▼
┌──────────────────────────┐
│  2. MAPEAMENTO           │ → normalizedData: Normalized[]
│  Aplicar ColumnMapping   │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  3. VALIDAÇÃO            │ → ValidationResult
│  Regras de negócio       │    - valid: [], errors: []
│  Formato, ranges, etc    │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  4. DEDUPLICAÇÃO         │ → Duplicates removidas
│  Exatas + parciais       │    Registos únicos
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  5. CACHE LOCAL              │ → IndexedDB
│  Guardar em memory para UI   │    (salvamento local)
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  6. RECONCILIAÇÃO                │ → ReconciliationMatch[]
│  Match com dados existentes      │    Score 0-100
│  Auto (score > 95%) ou manual    │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  7. CONFIRMAÇÃO DO UTILIZADOR    │ → confirmedMatches[]
│  Review matches duvidosos        │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  8. GERAÇÃO DE TRANSAÇÕES        │ → BankTransaction[]
│  Converter dados em entities     │    Invoice[]
│                                  │    Transaction[]
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  9. INSERÇÃO EM DB               │ → Supabase
│  Guardar em DB permanente       │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  10. LIMPEZA LOCAL               │ → IndexedDB
│  Remover cache da sessão         │
└──────────────────────────────────┘
```

### Estado React (Wizard)

```typescript
const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 0,
    
    // Step 0: Seleção
    sources: { bank: false, invoices: false, payments: false },
    
    // Step 1: Upload & Mapping
    uploads: [],  // UploadedFile[]
    mappings: {},
    
    // Step 2: Validação
    validationResults: [],
    
    // Step 3: Reconciliação
    reconciliationMatches: [],
    
    // Step 4: Resultado
    importResult: undefined,
    
    // Global
    isLoading: false,
    error: undefined,
});

// Transições
const goToStep = (step: number) => {
    setWizardState(prev => ({ ...prev, currentStep: step }));
};

const selectSource = (source: SourceType) => {
    setWizardState(prev => ({
        ...prev,
        sources: { ...prev.sources, [source]: !prev.sources[source] }
    }));
};

const confirmMappings = (mappings: ColumnMappingConfig) => {
    setWizardState(prev => ({
        ...prev,
        mappings,
        currentStep: 2,  // Ir a validação
    }));
};
```

---

## 🧮 ALGORITMOS PRINCIPAIS

### 1. Algoritmo de Detecção de Colunas

```typescript
// columnDetection.ts

export const columnDetection = {
    detectColumns: (
        headerRow: any,
        sampleRows: any[][],
        type: SourceType
    ): DetectedColumns => {
        const columnNames = Object.keys(headerRow);
        const detected: DetectedColumns = {};

        // Padrões de espera por tipo
        const patterns: Record<SourceType, Record<string, string[]>> = {
            bank: {
                date: ['data', 'date', 'data_operacao', 'dia', 'data_transacao'],
                description: ['descricao', 'description', 'motivo', 'operacao'],
                debit: ['debito', 'debit', 'saida', 'debitado'],
                credit: ['credito', 'credit', 'entrada', 'acreditado'],
                balance: ['saldo', 'balance', 'saldo_acumulado'],
                bank: ['banco', 'bank', 'instituicao'],
            },
            invoices: {
                date: ['data', 'date', 'data_emissao', 'dia'],
                reference: ['referencia', 'reference', 'numero', 'numero_fatura', 'ref', 'id'],
                clientNif: ['nif', 'client_nif', 'contribuinte', 'nif_cliente', 'vat'],
                clientName: ['nome', 'name', 'cliente', 'client', 'entidade', 'client_name'],
                amount: ['valor', 'amount', 'total', 'montante', 'price'],
                description: ['descricao', 'description', 'item', 'produto', 'servico'],
            },
            payments: {
                date: ['data', 'date', 'data_pagamento'],
                entity: ['entidade', 'entity', 'fornecedor', 'cliente', 'nome'],
                type: ['tipo', 'type', 'tipo_movimento'],
                description: ['descricao', 'description', 'motivo'],
                amount: ['valor', 'amount', 'montante'],
                status: ['estado', 'status', 'situacao'],
            },
        };

        const typePatterns = patterns[type];

        // Para cada campo esperado
        for (const [fieldKey, alternatives] of Object.entries(typePatterns)) {
            // Procurar match exato ou fuzzy
            for (const colName of columnNames) {
                const match = alternatives.find(alt =>
                    colName.toLowerCase().includes(alt) ||
                    alt.includes(colName.toLowerCase())
                );

                if (match) {
                    detected[fieldKey] = colName;
                    break;
                }
            }

            // Se não encontrado, procurar por posição (heurística)
            if (!detected[fieldKey]) {
                // TBD: Análise de conteúdo (type inference)
            }
        }

        return detected;
    },

    suggestMapping: (
        detected: DetectedColumns,
        type: SourceType
    ): ColumnMapping => {
        // Converter detected em ColumnMapping tipado
        // Com defaults se campos não encontrados
    },
};
```

### 2. Algoritmo de Reconciliação (Scoring)

Já documentado na seção de `reconciliationEngine.ts` acima.

### 3. Algoritmo de Deduplicação

```typescript
export const deduplicateExact = (records: any[]): {
    unique: any[];
    duplicates: Array<{line1: number; line2: number; record1: any; record2: any}>;
} => {
    const unique: any[] = [];
    const duplicates: Array<any> = [];
    const seen = new Map<string, any>();

    for (const record of records) {
        // Criar chave: data + valor + descrição (3 componentes)
        const key = [
            record.date,
            record.amount?.toString(),
            record.description?.toLowerCase(),
        ].join('|');

        if (seen.has(key)) {
            duplicates.push({
                line1: seen.get(key).line,
                line2: record.line,
                record1: seen.get(key),
                record2: record,
            });
        } else {
            unique.push(record);
            seen.set(key, record);
        }
    }

    return { unique, duplicates };
};
```

---

## 🔌 INTEGRAÇÃO COM MÓDULOS EXISTENTES

### 1. Integração com FinancialModule

```typescript
// FinancialModule.tsx - adicionar botão

<button onClick={() => setShowHistoricalImport(true)}>
    📥 Importar Dados 2025
</button>

{showHistoricalImport && (
    <HistoricalImportWizard
        isOpen={showHistoricalImport}
        onClose={() => setShowHistoricalImport(false)}
        onComplete={async (sessionId) => {
            // Recarregar transações
            const updated = await db.getTransactions();
            setTransactions(updated);
            
            // Recarregar extratos bancários
            const bankTxs = await db.getBankTransactions();
            setBankTransactions(bankTxs);
            
            // Show success toast
            notify('success', 'Dados históricos importados com sucesso!');
        }}
    />
)}
```

### 2. Integração com InvoicingModule

```typescript
// InvoicingModule.tsx - verificar invoices importadas

useEffect(() => {
    // Após importação, mostrar invoices de 2025
    const invoices2025 = invoices.filter(inv =>
        inv.createdFrom === 'historical_import_2025'
    );
    
    if (invoices2025.length > 0) {
        notify('info', `${invoices2025.length} faturas importadas de 2025`);
    }
}, [invoices]);
```

### 3. Integração com PurchasingModule

```typescript
// Similar para contas a pagar
const purchases2025 = purchases.filter(p =>
    p.createdFrom === 'historical_import_2025'
);
```

---

## ⚡ PERFORMANCE E ESCALABILIDADE

### Otimizações

#### 1. Parse de Excel
```typescript
// Usar lazy loading para ficheiros grandes
const parseFilePreview = async (file: File, maxRows: number = 1000) => {
    // Ler apenas as primeiras 1000 linhas
};

const parseFileFull = async (file: File) => {
    // Ler completo em background com ProgressBar
};
```

#### 2. Processamento em Lotes
```typescript
const processBatch = async (records: any[], batchSize: number = 100) => {
    const results: ProcessedRecord[] = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const processed = await processBatchInternal(batch);
        results.push(...processed);
        
        // Atualizar progresso
        setProgress((i + batchSize) / records.length);
    }
    
    return results;
};
```

#### 3. Cache Local (IndexedDB)
```typescript
// Guardar dados em IndexedDB para:
// - Recuperação em caso de erro
// - Permitir offline review
// - Não reprocessar ficheiros

const importCache = {
    saveSession: (session: HistoricalImportSession) =>
        db.historical_sessions.put(session),
    
    getSession: (id: string) =>
        db.historical_sessions.get(id),
    
    saveProcessed: (sessionId: string, type: SourceType, data: any) =>
        db.historical_data.put({
            sessionId,
            type,
            data,
            timestamp: Date.now(),
        }),
};
```

#### 4. Validação Incremental
```typescript
// Validar durante o upload, não depois
const validateAsTyping = (record: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    if (!record.date) errors.push({...});
    if (!isValidDate(record.date)) errors.push({...});
    if (record.amount <= 0) errors.push({...});
    
    return errors;
};
```

### Limites Recomendados

| Métrica | Limite | Ação |
|---------|--------|------|
| Linhas por ficheiro | 10.000 | Batch processing |
| Tempo de validação | < 5s | Mostrar progresso |
| Matches para reconciliar | < 100 | Paginar |
| Sessões em memória | 5 | Arquivo automático |

---

## 🧪 TESTES

### Testes Unitários

```typescript
// __tests__/reconciliationEngine.test.ts

describe('reconciliationEngine.calculateMatchScore', () => {
    test('exact match returns 100', () => {
        const record1 = {
            date: '2025-01-02',
            amount: 1500,
            description: 'TRF Fornecedor ABC',
        };
        const record2 = {
            date: '2025-01-02',
            amount: 1500,
            description: 'TRF Fornecedor ABC',
        };
        
        const score = reconciliationEngine.calculateMatchScore(record1, record2);
        expect(score).toBe(100);
    });

    test('1 day diff + exact amount returns 70+', () => {
        const record1 = {
            date: '2025-01-02',
            amount: 1500,
            description: 'TRF ABC',
        };
        const record2 = {
            date: '2025-01-03',
            amount: 1500,
            description: 'Pagto ABC',
        };
        
        const score = reconciliationEngine.calculateMatchScore(record1, record2);
        expect(score).toBeGreaterThan(70);
        expect(score).toBeLessThan(100);
    });
});

describe('columnDetection.detectColumns', () => {
    test('detects bank statement columns', () => {
        const header = {
            'Data': '2025-01-02',
            'Descrição': 'TRF',
            'Débito': '1500',
            'Crédito': '',
        };
        const detected = columnDetection.detectColumns(header, [], 'bank');
        
        expect(detected.date).toBeDefined();
        expect(detected.debit).toBeDefined();
    });
});
```

### Testes de Integração

```typescript
// __tests__/integration/import-flow.test.ts

describe('Historical Import Flow', () => {
    test('complete flow: upload → validate → reconcile → import', async () => {
        // 1. Create session
        const sessionId = await historicalImportService.createSession(2025, ['bank']);
        
        // 2. Upload file
        const file = new File(['...'], 'bank.xlsx', { type: 'application/xlsx' });
        const result = await historicalImportService.processFile(
            sessionId,
            file,
            'bank',
            bankMapping
        );
        
        expect(result.status).toBe('success');
        
        // 3. Reconcile
        const matches = await historicalImportService.reconcile(
            sessionId,
            'bank',
            existingTransactions
        );
        
        // 4. Confirm
        const importResult = await historicalImportService.confirmImport(
            sessionId,
            matches
        );
        
        expect(importResult.status).toBe('success');
    });
});
```

---

## 🚀 DEPLOYMENT

### Checklist Pre-Deploy

- [ ] Todos os testes passam (unitários + integração)
- [ ] Coverage > 80%
- [ ] Performance < 5s para 10K linhas
- [ ] Documentação completa
- [ ] User guide em PDF
- [ ] Rollback plan documentado

### Build

```bash
npm run build
# Resulta em /dist/

# Test
npm run test
npm run test:integration

# Deploy
npm run deploy
```

---

**FIM DO DOCUMENTO TÉCNICO**

Data: 2 de Janeiro de 2026  
Versão: 1.0  
Status: Pronto para Desenvolvimento
