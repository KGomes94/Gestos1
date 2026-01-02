# 📐 GUIA DE PADRÕES E BEST PRACTICES

**Objetivo:** Padronizar arquitetura e padrões de código para a aplicação Gestos1.

---

## 1️⃣ ARQUITETURA E ESTRUTURA

### 1.1 Padrão de Componentes

**Estrutura recomendada para cada módulo:**

```
src/
  [module]/
    components/
      [Module]List.tsx         # Lista/tabela principal
      [Module]Modal.tsx        # Modal CRUD
      [Module]ImportModal.tsx  # Modal de importação (usar BaseImportModal)
      [Module]Stats.tsx        # Estatísticas/dashboard
    hooks/
      use[Module]Import.ts     # Hook de importação (usar useBaseImport)
      use[Module]Crud.ts       # Hook para CRUD (criar quando necessário)
    services/
      [module]Service.ts       # Lógica principal
      [module]Validators.ts    # Validações
      [module]ImportService.ts # Importação (usar baseImportService)
    types.ts                   # Tipos específicos do módulo
    index.ts                   # Exports públicos
```

### 1.2 Exemplo Completo: Cliente

```
src/clients/
  components/
    ClientsList.tsx
    ClientModal.tsx
    ClientImportModal.tsx      ← Usa BaseImportModal
  hooks/
    useClientImport.ts         ← Usa useBaseImport
  services/
    clientService.ts
    clientValidators.ts
    clientImportService.ts     ← Usa baseImportService
  types.ts
  index.ts
```

---

## 2️⃣ PADRÕES DE COMPONENTES

### 2.1 Componente Funcional Padrão

```typescript
import React from 'react';
import { useNotification } from '../../contexts/NotificationContext';

interface MyComponentProps {
    /**
     * Descrição do prop
     * @example "example-value"
     */
    title: string;
    
    /**
     * Callback executado ao salvar
     */
    onSave?: (data: any) => void;
}

/**
 * MyComponent - Componente para [funcionalidade]
 * 
 * @component
 * @example
 * <MyComponent title="Meu Título" onSave={handleSave} />
 */
export const MyComponent: React.FC<MyComponentProps> = ({ title, onSave }) => {
    const { notify } = useNotification();
    
    // State
    const [data, setData] = React.useState('');
    
    // Handlers
    const handleSubmit = React.useCallback(() => {
        // Validar
        if (!data.trim()) {
            notify('warning', 'Preencha os campos obrigatórios');
            return;
        }
        
        // Executar
        try {
            onSave?.(data);
            notify('success', 'Operação realizada com sucesso');
        } catch (error) {
            notify('error', error instanceof Error ? error.message : 'Erro');
        }
    }, [data, onSave, notify]);
    
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            {/* Conteúdo */}
        </div>
    );
};
```

### 2.2 Componente com Estado Complexo

Usar `useReducer` para estado complexo:

```typescript
type FormAction = 
    | { type: 'SET_FIELD'; field: string; value: any }
    | { type: 'SET_ERROR'; field: string; error: string | null }
    | { type: 'RESET' };

interface FormState {
    name: string;
    email: string;
    errors: Record<string, string | null>;
}

const initialState: FormState = {
    name: '',
    email: '',
    errors: {}
};

const formReducer = (state: FormState, action: FormAction): FormState => {
    switch (action.type) {
        case 'SET_FIELD':
            return {
                ...state,
                [action.field]: action.value,
                errors: { ...state.errors, [action.field]: null }
            };
        case 'SET_ERROR':
            return {
                ...state,
                errors: { ...state.errors, [action.field]: action.error }
            };
        case 'RESET':
            return initialState;
        default:
            return state;
    }
};

export const MyFormComponent: React.FC = () => {
    const [form, dispatch] = useReducer(formReducer, initialState);
    
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch({ type: 'SET_FIELD', field: 'name', value: e.target.value });
    };
    
    return (
        <form>
            <input
                value={form.name}
                onChange={handleNameChange}
            />
            {form.errors.name && <span>{form.errors.name}</span>}
        </form>
    );
};
```

---

## 3️⃣ PADRÕES DE HOOKS

### 3.1 Hook Customizado Padrão

```typescript
import { useCallback, useState, useRef } from 'react';
import { useNotification } from '../contexts/NotificationContext';

interface UseMyHookOptions {
    /**
     * Descrição da opção
     */
    onSuccess?: (data: any) => void;
}

/**
 * useMyHook - Hook customizado para [funcionalidade]
 * 
 * @param options - Configurações do hook
 * @returns Objeto com estado e métodos
 * 
 * @example
 * ```
 * const { isLoading, data, fetchData } = useMyHook({ onSuccess: console.log });
 * ```
 */
export const useMyHook = (options: UseMyHookOptions = {}) => {
    const { notify } = useNotification();
    
    // State
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState<string | null>(null);
    
    // Refs para cleanup
    const abortControllerRef = useRef<AbortController | null>(null);
    
    // Methods
    const fetchData = useCallback(async (id: string) => {
        setIsLoading(true);
        setError(null);
        
        try {
            // Abort previous request
            abortControllerRef.current?.abort();
            abortControllerRef.current = new AbortController();
            
            // Simular fetch
            const result = await new Promise(resolve => setTimeout(resolve, 1000));
            
            setData(result);
            options.onSuccess?.(result);
            notify('success', 'Dados carregados');
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                const message = err.message || 'Erro ao carregar dados';
                setError(message);
                notify('error', message);
            }
        } finally {
            setIsLoading(false);
        }
    }, [notify, options]);
    
    // Cleanup
    const cleanup = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);
    
    return {
        isLoading,
        data,
        error,
        fetchData,
        cleanup
    };
};
```

### 3.2 Hook para Importação (Template)

```typescript
import { useCallback, useRef, useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { useBaseImport } from './useBaseImport';

interface UseMyImportProps<T> {
    data: T[];
    setData: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * useMyImport - Hook específico para importação de [entidade]
 */
export const useMyImport = <T,>({
    data,
    setData
}: UseMyImportProps<T>) => {
    const { notify } = useNotification();
    
    // Usar hook base reutilizável
    const baseImport = useBaseImport({
        data,
        setData,
        processImport: (rawData) => {
            // Lógica específica de importação
            return {
                drafts: [],
                errors: [],
                summary: { total: 0, valid: 0, invalid: 0 }
            };
        },
        convertToEntity: (draft) => {
            // Converter draft para entity
            return draft as T;
        },
        onImportSuccess: (count) => {
            notify('success', `${count} registos importados`);
        }
    });
    
    return {
        ...baseImport,
        // Adicionar métodos/estado específicos se necessário
    };
};
```

---

## 4️⃣ PADRÕES DE VALIDAÇÃO

### 4.1 Validadores Reutilizáveis

```typescript
/**
 * Validators - Funções reutilizáveis para validação
 */
export const validators = {
    /**
     * Valida campo obrigatório
     * @returns erro ou null se válido
     */
    required: (value: any, fieldName: string): string | null => {
        if (!value || (typeof value === 'string' && !value.trim())) {
            return `${fieldName} é obrigatório.`;
        }
        return null;
    },

    /**
     * Valida comprimento mínimo
     */
    minLength: (value: string, min: number, fieldName: string): string | null => {
        if (value.length < min) {
            return `${fieldName} deve ter pelo menos ${min} caracteres.`;
        }
        return null;
    },

    /**
     * Valida email
     */
    email: (value: string): string | null => {
        if (!value) return null;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return 'Email inválido.';
        }
        return null;
    },

    /**
     * Valida NIF
     */
    nif: (value: string): string | null => {
        if (!value) return null;
        const clean = value.replace(/[^0-9]/g, '');
        if (clean.length !== 9) {
            return 'NIF deve ter 9 dígitos.';
        }
        return null;
    },

    /**
     * Valida número positivo
     */
    positiveNumber: (value: number, fieldName: string): string | null => {
        if (value < 0) {
            return `${fieldName} não pode ser negativo.`;
        }
        return null;
    }
};

// Uso:
const validationErrors = {
    name: validators.required(form.name, 'Nome'),
    email: validators.email(form.email),
    amount: validators.positiveNumber(form.amount, 'Valor')
};

const isValid = Object.values(validationErrors).every(e => e === null);
```

### 4.2 Schema de Validação

```typescript
interface ValidationSchema<T> {
    [K in keyof T]: Array<(value: T[K]) => string | null>;
}

/**
 * Validador genérico baseado em schema
 */
const validate = <T extends Record<string, any>>(
    data: T,
    schema: ValidationSchema<T>
): Record<keyof T, string | null> => {
    const errors = {} as Record<keyof T, string | null>;
    
    for (const field in schema) {
        const validators = schema[field as keyof T];
        errors[field as keyof T] = null;
        
        for (const validator of validators) {
            const error = validator(data[field]);
            if (error) {
                errors[field as keyof T] = error;
                break;
            }
        }
    }
    
    return errors;
};

// Uso:
const schema: ValidationSchema<ClientForm> = {
    name: [
        (v) => validators.required(v, 'Nome'),
        (v) => validators.minLength(v, 3, 'Nome')
    ],
    email: [
        (v) => validators.email(v)
    ],
    nif: [
        (v) => validators.nif(v)
    ]
};

const errors = validate(formData, schema);
```

---

## 5️⃣ PADRÕES DE ESTADO

### 5.1 Compartilhamento de Estado

**Opção 1: Context API (simples, não frequentemente muda)**

```typescript
interface AppContextType {
    settings: SystemSettings;
    updateSettings: (settings: Partial<SystemSettings>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
    
    const updateSettings = useCallback((partial: Partial<SystemSettings>) => {
        setSettings(prev => ({ ...prev, ...partial }));
    }, []);
    
    const value: AppContextType = {
        settings,
        updateSettings
    };
    
    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp deve ser usado dentro de AppProvider');
    return context;
};
```

**Opção 2: useReducer (estado complexo)**

```typescript
const appReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'UPDATE_SETTINGS':
            return { ...state, settings: { ...state.settings, ...action.payload } };
        case 'ADD_TRANSACTION':
            return { ...state, transactions: [action.payload, ...state.transactions] };
        default:
            return state;
    }
};

export const useAppReducer = () => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    return { state, dispatch };
};
```

### 5.2 Local Storage Persistence

```typescript
/**
 * Hook para persistência em localStorage com validação
 */
export const useLocalStorage = <T>(key: string, initialValue: T) => {
    const [value, setValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            console.error(`Erro ao ler localStorage[${key}]`);
            return initialValue;
        }
    });
    
    const setStoredValue = useCallback((newValue: T | ((prev: T) => T)) => {
        try {
            const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
            setValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`Erro ao escrever localStorage[${key}]`, error);
        }
    }, [key, value]);
    
    return [value, setStoredValue] as const;
};

// Uso:
const [filter, setFilter] = useLocalStorage<FilterState>('invoicing_filter', defaultFilter);
```

---

## 6️⃣ PADRÕES DE ERRO E TRATAMENTO

### 6.1 Error Boundary com Fallback

```typescript
interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    onError?: (error: Error) => void;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({
    children,
    fallback,
    onError
}) => {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
    useEffect(() => {
        const handler = (e: ErrorEvent) => {
            setHasError(true);
            setError(e.error);
            onError?.(e.error);
        };
        
        window.addEventListener('error', handler);
        return () => window.removeEventListener('error', handler);
    }, [onError]);
    
    if (hasError) {
        return (
            fallback || (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                    <h3 className="font-bold text-red-700">Algo correu mal</h3>
                    <p className="text-sm text-red-600 mt-1">{error?.message}</p>
                </div>
            )
        );
    }
    
    return <>{children}</>;
};
```

### 6.2 Try-Catch com Notificação

```typescript
const handleAsyncOperation = async () => {
    try {
        // Validação
        if (!data) {
            notify('warning', 'Preecha os campos obrigatórios');
            return;
        }
        
        // Operação
        const result = await someAsyncOperation(data);
        
        // Sucesso
        notify('success', 'Operação realizada com sucesso');
        return result;
    } catch (error) {
        // Tratamento de erro
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        notify('error', message);
        console.error('Erro em operação:', error);
        
        return null;
    }
};
```

---

## 7️⃣ PADRÕES DE PERFORMANCE

### 7.1 Memoização Apropriada

```typescript
// ✅ BOM: Memoizar função complexa reutilizada
const filteredData = useMemo(() => {
    return data.filter(item => {
        // Lógica complexa de filtragem
        return item.status === filter && item.amount > threshold;
    }).sort((a, b) => b.date.localeCompare(a.date));
}, [data, filter, threshold]);

// ✅ BOM: Memoizar callback que tem dependências externas
const handleSubmit = useCallback(async () => {
    await api.save(data);
    notify('success', 'Salvo');
}, [data, notify]);

// ❌ EVITAR: Memoizar sempre
const userId = useMemo(() => currentUser.id, [currentUser]);

// ❌ EVITAR: useCallback em handlers simples
const handleClick = useCallback(() => setOpen(true), []); // Usar direto: () => setOpen(true)
```

### 7.2 Code Splitting

```typescript
// Lazy loading de componentes pesados
const FinancialDashboard = React.lazy(() => 
    import('./FinancialDashboard').then(m => ({ default: m.FinancialDashboard }))
);

// Com Suspense
<Suspense fallback={<LoadingScreen />}>
    <FinancialDashboard />
</Suspense>
```

---

## 8️⃣ PADRÕES DE NOMENCLATURA

### 8.1 Convenções

```typescript
// ✅ Componentes: PascalCase
const ClientList = () => { };
const ClientModal = () => { };

// ✅ Hooks: camelCase com prefixo "use"
const useClientImport = () => { };
const useFormValidation = () => { };

// ✅ Serviços: camelCase
const clientService = { /* ... */ };
const importService = { /* ... */ };

// ✅ Tipos/Interfaces: PascalCase
interface Client { }
interface ImportResult { }
type EntityStatus = 'active' | 'inactive';

// ✅ Constantes: UPPER_SNAKE_CASE
const DEFAULT_TIMEOUT = 5000;
const MAX_UPLOAD_SIZE = 10485760; // 10MB

// ✅ Variáveis privadas: prefixo _
const _internalState = { };

// ✅ Booleanos: prefixo is/has
const isLoading = false;
const hasError = true;
const canDelete = false;
```

### 8.2 Nomes Padronizados

```typescript
// ✅ PADRÃOnizado em toda app
interface ImportResult<T> {
    drafts: Partial<T>[];
    errors: ImportError[];
    summary: ImportSummary;
}

// ✅ Consistente: usar row_index, não rowIndex ou index
interface ImportRow {
    row_index: number;
}

// ✅ NÃO: invoice_ref em alguns, invoiceRef em outros
// Usar sempre invoice_ref ou sempre invoiceRef (escolher um)
```

---

## 9️⃣ PADRÕES DE STYLING

### 9.1 Tailwind CSS

```typescript
// ✅ BOM: Classes organizadas
<div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
    <h2 className="text-lg font-bold text-gray-800 mb-2">Título</h2>
    <p className="text-sm text-gray-600">Descrição</p>
</div>

// ❌ EVITAR: Classes bagunçadas
<div className="shadow-sm border border-gray-200 p-4 bg-white rounded-lg">

// ✅ BOM: Usar variáveis para cores recorrentes
const buttonClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700'
};

// ✅ BOM: Componentes para estilos comuns
<Button variant="primary">Salvar</Button>
```

---

## 🔟 PADRÕES DE TESTING

### 10.1 Teste Unitário

```typescript
describe('validators', () => {
    it('deve validar email corretamente', () => {
        expect(validators.email('test@example.com')).toBeNull();
        expect(validators.email('invalid')).not.toBeNull();
    });
    
    it('deve validar NIF', () => {
        expect(validators.nif('123456789')).toBeNull();
        expect(validators.nif('12345')).not.toBeNull();
    });
});
```

### 10.2 Teste de Hook

```typescript
describe('useMyHook', () => {
    it('deve retornar dados após fetch', async () => {
        const { result } = renderHook(() => useMyHook());
        
        await waitFor(() => {
            expect(result.current.data).toBeDefined();
        });
    });
});
```

---

## ✅ CHECKLIST DE QUALIDADE

Antes de fazer commit:

- [ ] Tipos TypeScript corretos
- [ ] Sem console.log em produção
- [ ] Sem `any` type
- [ ] Funciona offline/fallback
- [ ] Mensagens de erro clara
- [ ] Performance aceitável
- [ ] Código formatado com Prettier
- [ ] Sem imports não utilizados
- [ ] Acessibilidade básica (alt text, labels)
- [ ] Testes passando

---

**Última atualização:** Janeiro 2, 2026

