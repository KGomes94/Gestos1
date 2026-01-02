# 🚀 GUIA DE IMPLEMENTAÇÃO - MÓDULO IMPORTAÇÃO HISTÓRICA

**Data:** Janeiro 2, 2026  
**Versão:** 1.0  
**Público:** Developers  
**Tempo de Implementação:** 6 semanas

---

## 📋 ÍNDICE RÁPIDO

1. [Preparação do Ambiente](#preparação-do-ambiente)
2. [Estrutura de Pastas](#estrutura-de-pastas)
3. [Implementação Fase por Fase](#implementação-fase-por-fase)
4. [Código Base para Iniciar](#código-base-para-iniciar)
5. [Checklist de Desenvolvimento](#checklist-de-desenvolvimento)

---

## 🔧 PREPARAÇÃO DO AMBIENTE

### Dependências Necessárias (Já Instaladas)

```json
{
  "react": "^18.3.1",
  "xlsx": "^0.18.5",
  "lucide-react": "^0.344.0",
  "recharts": "^2.12.0",
  "@supabase/supabase-js": "^2.39.7"
}
```

### Ferramentas Adicionais (Se necessário)

```bash
# Para testes
npm install --save-dev vitest @testing-library/react

# Para validação de schema
npm install zod

# Para geração de IDs
npm install nanoid
```

### Estrutura Git

```bash
# Feature branch
git checkout -b feature/historical-import-2025

# Commits semânticos
git commit -m "feat: implement bank statement processor"
git commit -m "fix: reconciliation algorithm scoring"
git commit -m "test: add validation unit tests"
```

---

## 📁 ESTRUTURA DE PASTAS

```
/workspaces/Gestos1/
├── import-history/                    # 🆕 Novo módulo
│   ├── components/
│   │   ├── HistoricalImportWizard.tsx
│   │   ├── DataSourceSelector.tsx
│   │   ├── ColumnMappingUI.tsx
│   │   ├── ValidationPreview.tsx
│   │   ├── ReconciliationMatrix.tsx
│   │   └── ImportResults.tsx
│   │
│   ├── hooks/
│   │   ├── useHistoricalImport.ts      # Estado global do wizard
│   │   ├── useBankImport.ts
│   │   ├── useInvoiceImport.ts
│   │   └── usePaymentImport.ts
│   │
│   ├── services/
│   │   ├── historicalImportService.ts  # Orquestrador
│   │   ├── bankStatementProcessor.ts
│   │   ├── invoiceProcessor.ts
│   │   ├── paymentProcessor.ts
│   │   ├── reconciliationEngine.ts
│   │   └── historicalImportValidators.ts
│   │
│   ├── types/
│   │   └── historical-import.types.ts
│   │
│   ├── utils/
│   │   ├── columnDetection.ts
│   │   ├── matchingAlgorithm.ts
│   │   └── reconciliationHelpers.ts
│   │
│   ├── cache/
│   │   └── importCache.ts             # IndexedDB wrapper
│   │
│   └── __tests__/
│       ├── reconciliation.test.ts
│       ├── validators.test.ts
│       └── integration.test.ts
│
├── components/
│   └── HistoricalImportModule.tsx     # Integração no Menu
│
└── DOCUMENTAÇÃO/
    ├── MODULO_IMPORTACAO_HISTORICA.md
    ├── ESPECIFICACAO_TECNICA_DETALHADA.md
    └── RESUMO_EXECUTIVO_IMPORTACAO.md
```

---

## 📝 IMPLEMENTAÇÃO FASE POR FASE

### FASE 1: Setup Base (Dia 1-2)

#### 1.1 Criar Tipos TypeScript

**Ficheiro:** `import-history/types/historical-import.types.ts`

```typescript
// Tipos já documentados em ESPECIFICACAO_TECNICA_DETALHADA.md
// Copiar completo para este ficheiro
```

#### 1.2 Setup IndexedDB Cache

**Ficheiro:** `import-history/cache/importCache.ts`

```typescript
import Dexie, { Table } from 'dexie';

interface ImportSession {
    id: string;
    year: number;
    createdAt: string;
    status: 'in_progress' | 'completed' | 'failed';
    data?: any;
}

export class ImportDatabase extends Dexie {
    sessions!: Table<ImportSession>;

    constructor() {
        super('GestosImportDB');
        this.version(1).stores({
            sessions: '++id, year'
        });
    }
}

export const importDb = new ImportDatabase();

export const importCache = {
    async saveSession(session: ImportSession) {
        return await importDb.sessions.put(session);
    },

    async getSession(id: string) {
        return await importDb.sessions.get(id);
    },

    async getAllSessions() {
        return await importDb.sessions.toArray();
    },
};
```

#### 1.3 Criar Hook Principal

**Ficheiro:** `import-history/hooks/useHistoricalImport.ts`

```typescript
import { useState } from 'react';
import type { HistoricalImportSession, WizardState } from '../types/historical-import.types';

export const useHistoricalImport = () => {
    const [wizardState, setWizardState] = useState<WizardState>({
        currentStep: 0,
        sources: { bank: false, invoices: false, payments: false },
        uploads: [],
        mappings: {},
        validationResults: [],
        reconciliationMatches: [],
        importResult: undefined,
        isLoading: false,
        error: undefined,
    });

    const goToStep = (step: number) => {
        setWizardState(prev => ({ ...prev, currentStep: step }));
    };

    const selectSource = (source: 'bank' | 'invoices' | 'payments') => {
        setWizardState(prev => ({
            ...prev,
            sources: { ...prev.sources, [source]: !prev.sources[source] }
        }));
    };

    const setError = (error: Error | null) => {
        setWizardState(prev => ({ ...prev, error }));
    };

    return {
        wizardState,
        goToStep,
        selectSource,
        setError,
        setWizardState,
    };
};
```

---

### FASE 2: Processadores (Dia 3-6)

#### 2.1 Processador de Extrato Bancário

**Ficheiro:** `import-history/services/bankStatementProcessor.ts`

```typescript
import type { 
    NormalizedBankStatement, 
    BankColumnMapping 
} from '../types/historical-import.types';

export const bankStatementProcessor = {
    mapRows(
        rawData: any[],
        mapping: BankColumnMapping
    ): NormalizedBankStatement[] {
        return rawData.map((row, idx) => {
            const dateVal = row[mapping.dateColumn];
            const debitVal = parseNumber(row[mapping.debitColumn]);
            const creditVal = parseNumber(row[mapping.creditColumn]);

            return {
                line: idx + 2,
                date: parseDate(dateVal),
                description: String(row[mapping.descriptionColumn] || 'N/A'),
                amount: creditVal - debitVal,  // +ve = credit, -ve = debit
                balance: parseNumber(row[mapping.balanceColumn]),
                bank: String(row[mapping.bankColumn] || 'Unknown'),
                reference: row[mapping.referenceColumn],
                sourceFile: 'bank_statement.xlsx',
            };
        });
    },

    generateTransactions(validated: NormalizedBankStatement[]) {
        // Implementado em FASE 4
        return [];
    },
};

// Helpers
const parseNumber = (val: any): number => {
    if (!val) return NaN;
    const num = parseFloat(String(val).replace(',', '.'));
    return isNaN(num) ? NaN : num;
};

const parseDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    
    if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }
    
    return String(val).split('T')[0];
};
```

#### 2.2 Validadores

**Ficheiro:** `import-history/services/historicalImportValidators.ts`

```typescript
import type { 
    ImportError, 
    NormalizedBankStatement,
    ValidationResult 
} from '../types/historical-import.types';

export const historicalImportValidators = {
    validateBankStatement(records: NormalizedBankStatement[]): ValidationResult {
        const errors: ImportError[] = [];
        let validCount = 0;

        records.forEach(record => {
            // Data válida?
            if (!record.date || isNaN(new Date(record.date).getTime())) {
                errors.push({
                    line: record.line,
                    field: 'date',
                    code: 'INVALID_DATE_FORMAT',
                    message: 'Data inválida',
                    severity: 'error',
                });
                return;
            }

            // Valor válido?
            if (isNaN(record.amount) || record.amount === 0) {
                errors.push({
                    line: record.line,
                    field: 'amount',
                    code: 'INVALID_AMOUNT',
                    message: 'Valor inválido ou zero',
                    severity: 'error',
                });
                return;
            }

            validCount++;
        });

        return {
            isValid: errors.length === 0,
            errors,
            warnings: [],
            recordsProcessed: records.length,
            recordsValid: validCount,
        };
    },

    validateInvoiceRecord(record: any): ImportError[] {
        const errors: ImportError[] = [];

        if (!record.date || isNaN(new Date(record.date).getTime())) {
            errors.push({
                line: record.line,
                field: 'date',
                code: 'INVALID_DATE_FORMAT',
                message: 'Data da fatura inválida',
                severity: 'error',
            });
        }

        if (!record.clientNif || record.clientNif.length !== 9) {
            errors.push({
                line: record.line,
                field: 'clientNif',
                code: 'INVALID_NIF_FORMAT',
                message: 'NIF deve ter 9 dígitos',
                severity: 'error',
            });
        }

        if (!record.amount || record.amount <= 0) {
            errors.push({
                line: record.line,
                field: 'amount',
                code: 'INVALID_AMOUNT',
                message: 'Valor deve ser positivo',
                severity: 'error',
            });
        }

        return errors;
    },
};
```

#### 2.3 Motor de Reconciliação

**Ficheiro:** `import-history/services/reconciliationEngine.ts`

```typescript
import type { ReconciliationMatch } from '../types/historical-import.types';

export const reconciliationEngine = {
    calculateMatchScore(
        record1: any,
        record2: any
    ): number {
        let score = 0;

        // === Data (40%) ===
        const dateDiff = Math.abs(
            new Date(record1.date).getTime() - 
            new Date(record2.date).getTime()
        ) / (1000 * 60 * 60 * 24);

        if (dateDiff === 0) score += 40;
        else if (dateDiff <= 1) score += 30;
        else if (dateDiff <= 3) score += 20;
        else if (dateDiff <= 7) score += 10;

        // === Valor (40%) ===
        const amount1 = Math.abs(record1.amount || 0);
        const amount2 = Math.abs(record2.amount || 0);

        if (amount1 === amount2) {
            score += 40;
        } else if (Math.abs(amount1 - amount2) / amount1 <= 0.01) {
            score += 30;
        } else if (Math.abs(amount1 - amount2) / amount1 <= 0.05) {
            score += 20;
        }

        // === Descrição (20%) ===
        const desc1 = String(record1.description || '').toLowerCase();
        const desc2 = String(record2.description || '').toLowerCase();
        const similarity = calculateSimilarity(desc1, desc2);

        if (similarity >= 0.95) score += 20;
        else if (similarity >= 0.8) score += 10;
        else if (similarity >= 0.6) score += 5;

        return Math.min(score, 100);
    },

    findMatches(
        record: any,
        candidates: any[],
        minScore: number = 50
    ): ReconciliationMatch[] {
        return candidates
            .map(candidate => ({
                id: generateId(),
                confidence: this.calculateMatchScore(record, candidate),
                source1: record,
                source2: candidate,
                matchType: 'fuzzy' as const,
                reasoning: `Score baseado em data, valor e descrição`,
                status: 'pending_review' as const,
            }))
            .filter(m => m.confidence >= minScore)
            .sort((a, b) => b.confidence - a.confidence);
    },
};

// Helpers
const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
};

const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
```

---

### FASE 3: Componentes UI (Dia 7-11)

#### 3.1 Wizard Principal

**Ficheiro:** `import-history/components/HistoricalImportWizard.tsx`

```typescript
import React from 'react';
import { useHistoricalImport } from '../hooks/useHistoricalImport';
import { DataSourceSelector } from './DataSourceSelector';
import { ValidationPreview } from './ValidationPreview';
import { ImportResults } from './ImportResults';

interface HistoricalImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: (sessionId: string) => void;
}

export const HistoricalImportWizard: React.FC<HistoricalImportWizardProps> = ({
    isOpen,
    onClose,
    onComplete,
}) => {
    const { wizardState, goToStep, selectSource, setError } = 
        useHistoricalImport();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-blue-600 text-white p-6 flex justify-between items-center">
                    <h1 className="text-2xl font-bold">
                        📥 Importar Dados Históricos 2025
                    </h1>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-blue-700 p-2 rounded"
                    >
                        ✕
                    </button>
                </div>

                {/* Conteúdo por Step */}
                <div className="p-8">
                    {wizardState.currentStep === 0 && (
                        <DataSourceSelector
                            selected={wizardState.sources}
                            onSelect={selectSource}
                            onContinue={() => goToStep(1)}
                            onCancel={onClose}
                        />
                    )}

                    {wizardState.currentStep === 2 && (
                        <ValidationPreview
                            validationResults={wizardState.validationResults}
                            onContinue={() => goToStep(3)}
                            onCancel={onClose}
                        />
                    )}

                    {wizardState.currentStep === 4 && (
                        <ImportResults
                            result={wizardState.importResult}
                            onComplete={() => {
                                onComplete?.(wizardState.importResult?.sessionId || '');
                                onClose();
                            }}
                        />
                    )}
                </div>

                {/* Progresso */}
                <div className="bg-gray-100 p-4 flex justify-between items-center">
                    <div className="flex gap-2">
                        {[0, 1, 2, 3, 4].map(step => (
                            <div
                                key={step}
                                className={`h-2 w-8 rounded ${
                                    step <= wizardState.currentStep
                                        ? 'bg-blue-600'
                                        : 'bg-gray-300'
                                }`}
                            />
                        ))}
                    </div>
                    <span className="text-sm text-gray-600">
                        Passo {wizardState.currentStep + 1} de 5
                    </span>
                </div>
            </div>
        </div>
    );
};
```

#### 3.2 Seletor de Fontes

**Ficheiro:** `import-history/components/DataSourceSelector.tsx`

```typescript
import React from 'react';
import { Database, FileText, DollarSign } from 'lucide-react';

interface DataSourceSelectorProps {
    selected: Record<string, boolean>;
    onSelect: (source: string) => void;
    onContinue: () => void;
    onCancel: () => void;
}

export const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({
    selected,
    onSelect,
    onContinue,
    onCancel,
}) => {
    const sources = [
        {
            id: 'bank',
            name: 'Extrato Bancário',
            icon: Database,
            description: 'Movimentos bancários de 2025 (verdade financeira)',
            color: 'blue',
        },
        {
            id: 'invoices',
            name: 'Faturas Emitidas',
            icon: FileText,
            description: 'Faturas emitidas aos clientes em 2025',
            color: 'green',
        },
        {
            id: 'payments',
            name: 'Pagtos/Recebimentos',
            icon: DollarSign,
            description: 'Registos manuais de pagamentos e recebimentos',
            color: 'purple',
        },
    ];

    const hasSelected = Object.values(selected).some(v => v);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">
                Selecione as fonte(s) de dados para importar:
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-8">
                {sources.map(source => {
                    const Icon = source.icon;
                    const isSelected = selected[source.id];

                    return (
                        <div
                            key={source.id}
                            onClick={() => onSelect(source.id)}
                            className={`p-6 rounded-lg cursor-pointer border-2 transition ${
                                isSelected
                                    ? `border-${source.color}-600 bg-${source.color}-50`
                                    : 'border-gray-300 hover:border-gray-400'
                            }`}
                        >
                            <Icon className={`h-12 w-12 mb-4 text-${source.color}-600`} />
                            <h3 className="font-bold mb-2">{source.name}</h3>
                            <p className="text-sm text-gray-600">{source.description}</p>
                            {isSelected && (
                                <div className="mt-4 text-green-600 font-bold">✓ Selecionado</div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-4 justify-end">
                <button
                    onClick={onCancel}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    Cancelar
                </button>
                <button
                    onClick={onContinue}
                    disabled={!hasSelected}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
                >
                    Continuar →
                </button>
            </div>
        </div>
    );
};
```

---

### FASE 4: Integração (Dia 12-14)

#### 4.1 Integração no Menu Principal

**Ficheiro:** `components/HistoricalImportModule.tsx`

```typescript
import React, { useState } from 'react';
import { HistoricalImportWizard } from '../import-history/components/HistoricalImportWizard';
import { useNotification } from '../contexts/NotificationContext';

export const HistoricalImportModule: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { notify } = useNotification();

    const handleComplete = async (sessionId: string) => {
        notify('success', '✅ Dados históricos importados com sucesso!');
        // Recarregar dados do módulo financeiro
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
                📥 Importar 2025
            </button>

            <HistoricalImportWizard
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onComplete={handleComplete}
            />
        </>
    );
};
```

#### 4.2 Adicionar ao FinancialModule

**Em:** `components/FinancialModule.tsx`

```typescript
// Adicionar na barra de ferramentas:
<HistoricalImportModule />

// E importar:
import { HistoricalImportModule } from './HistoricalImportModule';
```

---

## 🧪 TESTES

### Testes Unitários

**Ficheiro:** `import-history/__tests__/reconciliation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { reconciliationEngine } from '../services/reconciliationEngine';

describe('reconciliationEngine.calculateMatchScore', () => {
    it('should return 100 for exact match', () => {
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

    it('should handle fuzzy matching', () => {
        const record1 = {
            date: '2025-01-02',
            amount: 1500,
            description: 'TRF ABC',
        };
        const record2 = {
            date: '2025-01-03',
            amount: 1500,
            description: 'TRF ABC Fornecedor',
        };

        const score = reconciliationEngine.calculateMatchScore(record1, record2);
        expect(score).toBeGreaterThan(70);
        expect(score).toBeLessThan(100);
    });
});
```

---

## ✅ CHECKLIST DE DESENVOLVIMENTO

### Semana 1: Setup
- [ ] Tipos TypeScript criados
- [ ] IndexedDB configurado
- [ ] Hook principal implementado
- [ ] Estrutura de pastas criada

### Semana 2: Lógica
- [ ] Processador banco implementado
- [ ] Processador faturas implementado
- [ ] Validadores implementados
- [ ] Motor reconciliação funcionando
- [ ] Testes unitários passando

### Semana 3: UI
- [ ] HistoricalImportWizard funcional
- [ ] DataSourceSelector renderizando
- [ ] ColumnMappingUI completo
- [ ] ValidationPreview mostrando dados

### Semana 4: Integração
- [ ] Componentes integrados com App.tsx
- [ ] Botão no FinancialModule
- [ ] Notificações funcionando
- [ ] Dados sendo salvos em DB

### Semana 5: Testes
- [ ] Testes unitários: 80%+ coverage
- [ ] Testes integração passando
- [ ] Performance: < 5s para 10K linhas
- [ ] Documentação completa

### Semana 6: Deploy
- [ ] Build produção sem erros
- [ ] Staging testado
- [ ] Deploy em produção
- [ ] Monitoramento ativo

---

## 🚀 PRÓXIMOS PASSOS

1. **Approvar especificação**
2. **Criar feature branch**
3. **Iniciar FASE 1 (tipos + setup)**
4. **Daily standups** (15 min)
5. **Code reviews** após cada fase
6. **Testes contínuos**

---

## 📞 SUPORTE

- **Documentação:** Ver [MODULO_IMPORTACAO_HISTORICA.md](MODULO_IMPORTACAO_HISTORICA.md)
- **Técnico:** Ver [ESPECIFICACAO_TECNICA_DETALHADA.md](ESPECIFICACAO_TECNICA_DETALHADA.md)
- **Executivo:** Ver [RESUMO_EXECUTIVO_IMPORTACAO.md](RESUMO_EXECUTIVO_IMPORTACAO.md)

---

**Versão:** 1.0  
**Data:** 2 de Janeiro de 2026  
**Status:** Pronto para Desenvolvimento
