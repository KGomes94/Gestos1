# 📊 MÓDULO PROVISÓRIO DE IMPORTAÇÃO DE DADOS HISTÓRICOS (2025)

**Data:** Janeiro 2, 2026  
**Versão:** 1.0  
**Objetivo:** Importar dados dispersos de 2025 para permanecer com fecho contabilístico seguro e confiável em 2026

---

## 📋 SUMÁRIO EXECUTIVO

A aplicação Gestos1 foi desenvolvida para registar despesas de 2026, porém a empresa tem registos dispersos de 2025 que necessitam ser consolidados. Este documento especifica um **módulo provisório de importação histórica** que permitirá:

1. ✅ **Importar três fontes de dados** (extrato bancário, faturas emitidas, registos em Excel)
2. ✅ **Validar e reconciliar** dados com segurança e confiança
3. ✅ **Gerar movimentos contabilísticos** automáticos (contas a pagar, contas a receber, tesouraria)
4. ✅ **Permitir fecho contabilístico** mensal e anual com certeza e clareza
5. ✅ **Interface intuitiva e visual** com feedback em tempo real

---

## 🎯 CONTEXTO EMPRESARIAL

### 2025: Estado Atual
- Registos **dispersos em múltiplas fontes** (Excel, email, papéis, extratos bancários)
- Sem **centralização contabilística**
- Fecho mensal e anual **incerto** (gap de reconciliação)
- Dificuldade em **rastrear fluxos de caixa**

### 2026: Visão Futura
- App registra **todas as despesas em tempo real**
- Dados históricos (2025) **migrados e consolidados**
- Possibilidade de **fechar contabilidade com confiança**
- **Auditoria transparente** de movimentos históricos

---

## 🏗️ ARQUITETURA GERAL

### Fluxo de Dados (Alto Nível)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MÓDULO DE IMPORTAÇÃO HISTÓRICA (2025)               │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │
│  │  Extrato Banco  │  │  Faturas (CSV)  │  │ Excel Pagtos/   │       │
│  │                 │  │                 │  │   Recebimentos  │       │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘       │
│           │                    │                     │                │
│           └────────────────────┼─────────────────────┘                │
│                                │                                      │
│                  ┌─────────────▼──────────────┐                      │
│                  │  UNIFIED IMPORT PROCESSOR  │                      │
│                  │  (Parse, Map, Validate)    │                      │
│                  └─────────────┬──────────────┘                      │
│                                │                                      │
│                  ┌─────────────▼──────────────┐                      │
│                  │  RECONCILIATION ENGINE     │                      │
│                  │  (Match, Deduplicate)      │                      │
│                  └─────────────┬──────────────┘                      │
│                                │                                      │
│            ┌───────────────────┼───────────────────┐                 │
│            │                   │                   │                 │
│       ┌────▼─────┐        ┌────▼─────┐       ┌────▼─────┐          │
│       │ Treasury  │        │  A/P     │       │  A/R     │          │
│       │ Movements │        │ (Débitos)│       │(Créditos)│          │
│       └──────────┘        └──────────┘       └──────────┘          │
│                                │                                      │
│                  ┌─────────────▼──────────────┐                      │
│                  │  FINANCIAL STATEMENTS      │                      │
│                  │  (Monthly Close, Reports)  │                      │
│                  └────────────────────────────┘                      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Componentes Principais

#### 1. **Procesador de Importação Unificado**
- Parser flexível para Excel/CSV
- Mapeamento de colunas automático e manual
- Validação robusta de dados
- Previsão antes de confirmar

#### 2. **Motor de Reconciliação**
- Matching automático de transações
- Deduplicação inteligente
- Detecção de anomalias
- Confirmação manual para casos duvidosos

#### 3. **Geradores de Movimentos**
- Conversão de dados em lançamentos contabilísticos
- Criação automática de contas a pagar/receber
- Movimentos de tesouraria sincronizados

#### 4. **Relatórios e Fecho**
- Visualização de saldos por período
- Reconciliação de contas
- Certificação de fecho mensal

---

## 📥 FONTE 1: IMPORTAÇÃO DE EXTRATO BANCÁRIO

### Objetivo
Importar o "livro de verdade financeira" - extrato bancário de 2025 que reflete fluxos reais de caixa.

### Formato Esperado (CSV/XLSX)
```
┌──────────┬──────────┬─────────────────┬──────────┬────────────────┬────────────┐
│   Data   │  Banco   │  Descrição      │ Débito   │  Crédito       │ Saldo      │
├──────────┼──────────┼─────────────────┼──────────┼────────────────┼────────────┤
│2025-01-02│Bank ABC  │TRF Fornecedor 1 │1,500.00  │                │15,000.00   │
│2025-01-03│Bank ABC  │Receita Cliente 1│          │2,500.00        │17,500.00   │
│2025-01-05│Bank ABC  │Comissão Banco   │15.00     │                │17,485.00   │
└──────────┴──────────┴─────────────────┴──────────┴────────────────┴────────────┘
```

### Mapeamento de Colunas (Flexível)
```typescript
interface BankStatementMapping {
    // Obrigatório
    dateColumn: string;      // "Data", "date", "data_operacao", etc.
    descriptionColumn: string; // "Descrição", "description", "motivo", etc.
    debitColumn: string;     // "Débito", "debit", "saída", etc.
    creditColumn: string;    // "Crédito", "credit", "entrada", etc.
    
    // Opcional
    balanceColumn?: string;  // "Saldo", "balance" (apenas para validação)
    bankColumn?: string;     // "Banco", "bank_name"
    referenceColumn?: string; // "Referência", "reference" (para matching)
}
```

### Processamento

#### Passo 1: Parse e Normalização
```typescript
interface ParsedBankTransaction {
    date: string;                  // YYYY-MM-DD
    description: string;
    amount: number;                // Positivo = crédito, negativo = débito
    balance?: number;              // Saldo acumulado (se fornecido)
    bank: string;                  // Nome do banco
    reference?: string;            // Ref da transação (se fornecido)
    lineIndex: number;             // Para rastreabilidade
    sourceFile: string;            // Nome do ficheiro Excel/CSV
}
```

#### Passo 2: Validação
```
✓ Data válida (formato YYYY-MM-DD, deve estar em 2025)
✓ Descrição não vazia (mín. 3 caracteres)
✓ Débito XOR Crédito (um dos dois, não ambos)
✓ Valor positivo (> 0)
✓ Saldo coerente (se fornecido)

Erros Possíveis:
- Data inválida ou fora de 2025
- Ambos débito e crédito preenchidos
- Valor zero ou negativo
- Saldo descontinuado
```

#### Passo 3: Reconciliação
```
1. Agrupar por data + descrição + valor
   → Detectar duplicatas exatas

2. Buscar em BankTransactions existentes
   → Se encontrado: marcar como "reconciliado com histórico"
   → Se não encontrado: marcar como "novo" ou "pendente match"

3. Sugerir match automático
   → Buscar transações do sistema com ±3 dias e valor próximo
   → Calcular score de confiança
   → Se score > 95%: auto-reconciliar
   → Se 50% < score < 95%: pedir confirmação manual
   → Se score < 50%: marcar como "requer revisão"
```

### Saída
```typescript
interface BankStatementImportResult {
    imported: {
        reconciled: number;        // Já combinados com registos do sistema
        newTransactions: number;   // Novos, não encontrados no sistema
        duplicates: number;        // Duplicatas removidas
    };
    pendingReview: {
        ambiguousMatches: number;  // Match incerto, precisa confirmação
        noMatch: number;           // Sem corresponência no sistema
    };
    errors: ImportError[];
    transactions: BankTransaction[]; // Prontos para inserir em DB
}
```

---

## 📄 FONTE 2: IMPORTAÇÃO DE FATURAS EMITIDAS

### Objetivo
Importar faturas emitidas em 2025 para criar **Contas a Receber** (clientes que devem à empresa).

### Formato Esperado
```
┌──────────┬──────┬──────────────┬──────────────┬──────────┬──────────┐
│   Data   │ Ref# │  Cliente NIF │ Nome Cliente │ Valor    │ Descrição│
├──────────┼──────┼──────────────┼──────────────┼──────────┼──────────┤
│2025-01-02│  FT1 │500123456     │ Cliente ABC  │1,500.00  │Serviços │
│2025-01-05│  FT2 │500654321     │ Cliente XYZ  │2,000.00  │Material  │
└──────────┴──────┴──────────────┴──────────────┴──────────┴──────────┘
```

### Mapeamento
```typescript
interface InvoiceImportMapping {
    dateColumn: string;           // "Data", "data_emissao"
    referenceColumn: string;      // "Ref#", "numero_fatura"
    clientNifColumn: string;      // "Cliente NIF", "nif"
    clientNameColumn: string;     // "Nome Cliente", "cliente"
    amountColumn: string;         // "Valor", "total"
    descriptionColumn?: string;   // Descrição dos serviços
    dueDateColumn?: string;       // Data vencimento (se disponível)
}
```

### Processamento

#### Passo 1: Parse
```typescript
interface ParsedInvoiceRecord {
    date: string;                 // YYYY-MM-DD
    reference: string;            // FT001, INV-2025-001, etc.
    clientNif: string;            // Sem pontuação
    clientName: string;
    amount: number;               // Valor bruto
    description: string;
    dueDate?: string;             // Se fornecido
    lineIndex: number;
    sourceFile: string;
}
```

#### Passo 2: Validação
```
✓ Data válida (2025)
✓ Referência única (não duplicada no sistema)
✓ Cliente NIF válido (Portugal: 9 dígitos)
✓ Valor > 0
✓ Cliente existe em sistema (match por NIF/nome)

Avisos:
- Cliente não encontrado → Sugerir criação automática
- Referência duplicada → Avisar antes de importar
- Data vencimento anterior a hoje → Marcado como "atrasado"
```

#### Passo 3: Matching de Clientes
```
Para cada fatura:
1. Procurar cliente por NIF exato
   → Se encontrado: usar cliente existente
   
2. Se não encontrado, procurar por nome similar
   → Usar Levenshtein distance para match fuzzy
   
3. Se nenhum match acima de 90%:
   → Sugerir criação de novo cliente
   → Mostrar dados pre-preenchidos da fatura
```

### Saída
```typescript
interface InvoiceImportResult {
    importedCount: number;
    matchedClients: number;       // Clientes que já existem no sistema
    newClientsNeeded: number;     // Novos clientes a criar
    errors: ImportError[];
    
    invoiceDrafts: {
        invoices: Invoice[];       // Prontos para inserir
        newClients: Client[];      // Clientes a criar
    };
}
```

---

## 💰 FONTE 3: IMPORTAÇÃO DE PAGAMENTOS/RECEBIMENTOS EM EXCEL

### Objetivo
Importar registos manuais de pagamentos (contas a pagar) e recebimentos (contas a receber) de 2025.

### Formato Esperado
```
┌──────────┬──────────────┬──────────┬──────────────┬───────────┬──────────────┐
│   Data   │   Entidade   │  Tipo    │ Descrição    │  Valor    │   Status     │
├──────────┼──────────────┼──────────┼──────────────┼───────────┼──────────────┤
│2025-01-02│Fornec. ABC   │Pagamento │Compra mat.   │1,500.00   │Pago          │
│2025-01-05│Cliente XYZ   │Recebim.  │Fatura FT-001 │2,500.00   │Pendente      │
│2025-01-08│Fornec. DEF   │Pagamento │Serviços      │  800.00   │Pago          │
└──────────┴──────────────┴──────────┴──────────────┴───────────┴──────────────┘
```

### Mapeamento
```typescript
interface PaymentImportMapping {
    dateColumn: string;           // "Data"
    entityColumn: string;         // "Entidade" (quem paga/recebe)
    typeColumn: string;           // "Tipo" (Pagamento/Recebimento)
    descriptionColumn: string;    // "Descrição" (para que/de quem)
    amountColumn: string;         // "Valor"
    statusColumn?: string;        // "Status" (Pago/Pendente)
    methodColumn?: string;        // "Método" (Cheque, Transferência, Dinheiro)
    referenceColumn?: string;     // "Referência" (NIF, número cheque, etc.)
}
```

### Processamento

#### Passo 1: Classificação
```typescript
interface ClassifiedPayment {
    // Identificação
    date: string;
    entity: string;               // Nome fornecedor/cliente
    amount: number;
    description: string;
    reference?: string;           // NIF, número cheque, etc.
    
    // Classificação automática
    type: 'payment' | 'receipt';  // Deduzido do campo "Tipo"
    status: 'paid' | 'pending';   // Do campo "Status" ou da data
    method?: string;              // Cheque, Transferência, Dinheiro, etc.
    
    // Rastreabilidade
    lineIndex: number;
    sourceFile: string;
}
```

#### Passo 2: Validação
```
✓ Data válida (2025)
✓ Tipo é Pagamento ou Recebimento
✓ Valor > 0
✓ Entidade não vazia
✓ Descrição indicadora do propósito

Avisos:
- Status "Pendente" com data anterior a 3 meses → "Possível atraso"
- Entidade não identificada → "Entidade desconhecida"
- Valor inconsistente (muito alto/baixo) → "Verificar valor"
```

#### Passo 3: Linking com Outras Fontes
```
Pagamento → Procurar correspondência em:
1. Faturas/Notas de Débito de fornecedores (A/P)
2. Extrato bancário (match por data ±3 dias, valor próximo)

Recebimento → Procurar correspondência em:
1. Faturas emitidas (A/R)
2. Extrato bancário (match por data ±3 dias, valor próximo)

Resultado:
- Linked: Transação combinada com outras fontes
- Orphan: Nenhuma correspondência encontrada
- Duplicate: Já existe no sistema
```

### Saída
```typescript
interface PaymentImportResult {
    importedCount: number;
    linked: number;               // Combinados com outras fontes
    orphan: number;               // Sem correspondência
    conflicts: number;            // Possíveis duplicatas
    errors: ImportError[];
    
    transactions: {
        payables: Transaction[];   // Contas a Pagar
        receivables: Transaction[];// Contas a Receber
    };
}
```

---

## 🔄 RECONCILIAÇÃO E VALIDAÇÃO

### Motor de Matching Inteligente

#### Algoritmo de Score
```
Para cada par (banco, fatura/pagamento):
    score = 0
    
    // Matching de data (peso: 40%)
    if date_diff <= 1 day:
        score += 40
    elif date_diff <= 3 days:
        score += 20
    elif date_diff <= 7 days:
        score += 10
    
    // Matching de valor (peso: 40%)
    if amount_match == 100%:
        score += 40
    elif amount_match >= 99%:
        score += 30
    elif amount_match >= 95%:
        score += 20
    elif amount_match >= 90%:
        score += 10
    
    // Matching de descrição (peso: 20%)
    if description_similarity >= 95%:
        score += 20
    elif description_similarity >= 80%:
        score += 10
    elif description_similarity >= 60%:
        score += 5

    return score  // 0-100
```

#### Decisão de Matching
```
score >= 95% → ✅ Auto-reconciliar (confiança muito alta)
80% <= score < 95% → ⚠️  Pedir confirmação manual
50% <= score < 80% → 🔍 Marcar como "revisar" (possível match)
score < 50% → ❌ Rejeitar (sem confiança suficiente)
```

### Deduplicação

#### Detecção de Duplicatas Exatas
```
Mesma data + mesma descrição + mesmo valor = possível duplicata

Mostrar para confirmação manual:
- Origem (ficheiro 1, ficheiro 2)
- Data e hora de importação
- Botão: "Manter ambos" ou "Remover duplicata"
```

#### Detecção de Duplicatas Parciais
```
Mesma data + valor similar (±5%) + descrição parcial = aviso

Exemplo:
- Extrato: "TRF Fornecedor ABC | 1,500.00"
- Pagamento: "Pagamento Fornecedor ABC | 1,500.00"
→ Provável duplicata, pedir confirmação
```

---

## 💾 INTEGRAÇÃO COM MÓDULOS EXISTENTES

### Geração de Contas a Pagar (A/P)

Quando importar pagamentos ou extratos com débitos identificados como despesas:

```typescript
interface GeneratedPayableTransaction {
    // Identificação
    id: string;                   // Auto-gerado
    referenceSource: {
        type: 'bank_statement' | 'import_payment';
        sourceDate: string;
        sourceFile: string;
    };
    
    // Movimentação
    date: string;                 // Data do pagamento/débito
    dueDate: string;              // Mesma que date ou data fornecida
    
    // Contabilização
    amount: number;
    vendor: string;               // Entidade/Fornecedor
    description: string;
    category: string;             // Conta contabilística (3.x, 2.x, etc.)
    
    // Status
    status: 'paid' | 'pending';
    reconciled: boolean;          // True se combinado com banco
    
    // Auditoria
    createdAt: string;
    createdBy: string;            // Identificação: "import_2025"
    paymentProof?: {
        file: string;
        date: string;
    };
}
```

### Geração de Contas a Receber (A/R)

Quando importar faturas emitidas:

```typescript
interface GeneratedReceivableTransaction {
    // Identificação
    id: string;
    referenceSource: {
        type: 'invoice_import';
        invoiceNumber: string;
        sourceFile: string;
    };
    
    // Movimentação
    date: string;                 // Data emissão
    dueDate: string;              // Vencimento (if available) ou +30 dias
    
    // Contabilização
    amount: number;               // Valor bruto da fatura
    client: string;               // Cliente
    description: string;
    category: string;             // Conta 1.x (Receita)
    
    // Status
    status: 'pending' | 'partial' | 'paid';
    reconciled: boolean;          // True se recebimento no banco confirmado
    paidAmount?: number;          // Se já parcialmente recebido
    
    // Auditoria
    createdAt: string;
    createdBy: string;            // "import_2025"
}
```

### Geração de Movimentos de Tesouraria

Quando extrato bancário importado:

```typescript
interface GeneratedTreasuryMovement {
    // Identificação
    id: string;
    bankStatementLineIndex: number;
    
    // Movimentação
    date: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    
    // Contabilização
    account: 'bank' | 'cash';
    bankName?: string;
    
    // Reconciliação
    reconciled: boolean;
    linkedTo?: {
        type: 'payable' | 'receivable' | 'other';
        id: string;
    };
    
    // Auditoria
    importedAt: string;
    source: string;               // Nome ficheiro extrato
}
```

---

## 📊 INTERFACE DO MÓDULO (Fluxo Visual)

### Tela 1: Seleção de Fonte de Dados

```
┌─────────────────────────────────────────────────────────────┐
│  IMPORTAR DADOS HISTÓRICOS 2025                             │
│                                                             │
│  Selecione a(s) fonte(s) de dados para importar:           │
│                                                             │
│  ┌───────────────────┐  ┌───────────────────┐              │
│  │ 🏦 EXTRATO BANCO  │  │ 📄 FATURAS        │              │
│  │                   │  │ EMITIDAS          │              │
│  │ Verdade financeir │  │                   │              │
│  │ Fluxos de caixa   │  │ Contas a Receber  │              │
│  │                   │  │                   │              │
│  │ [ Upload arquivo] │  │ [ Upload arquivo] │              │
│  └───────────────────┘  └───────────────────┘              │
│                                                             │
│  ┌───────────────────┐                                     │
│  │ 💰 PAGTOS/RECEBIM │                                     │
│  │ EM EXCEL          │                                     │
│  │                   │                                     │
│  │ Registos manuais  │                                     │
│  │ Contas a Pagar    │                                     │
│  │                   │                                     │
│  │ [ Upload arquivo] │                                     │
│  └───────────────────┘                                     │
│                                                             │
│  [ Continuar ] [ Cancelar ]                               │
└─────────────────────────────────────────────────────────────┘
```

### Tela 2: Configuração de Mapeamento

```
┌──────────────────────────────────────────────────────────────┐
│  CONFIGURAR MAPEAMENTO DE COLUNAS                            │
│  Ficheiro: banco_2025.xlsx                                   │
│                                                              │
│  A aplicação detectou as seguintes colunas:                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Data         : [ Data        ▼ ]  (jan/02/2025)  ✓  │  │
│  │ Descrição    : [ Descrição   ▼ ]  ("TRF Fornec") ✓  │  │
│  │ Débito       : [ Débito      ▼ ]  (1500.00)     ✓  │  │
│  │ Crédito      : [ Crédito     ▼ ]  (2500.00)     ✓  │  │
│  │ Saldo        : [ Saldo       ▼ ]  (15000.00)    ✓  │  │
│  │ Banco        : [ Banco       ▼ ]  ("Bank ABC")  ✓  │  │
│  │                                                      │  │
│  │ Pré-visualização (primeiras 3 linhas):            │  │
│  │ ┌─────────┬─────────────────┬────────┬────────┐  │  │
│  │ │ Data    │ Descrição       │Débito  │Crédito│  │  │
│  │ ├─────────┼─────────────────┼────────┼────────┤  │  │
│  │ │2025-01-2│TRF Fornecedor ABC│1500.00│       │  │  │
│  │ │2025-01-3│Receita Cliente  │        │2500.00│  │  │
│  │ └─────────┴─────────────────┴────────┴────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  [ Continuar ] [ Ajustar Manualmente ] [ Cancelar ]   │
└──────────────────────────────────────────────────────────┘
```

### Tela 3: Validação e Preview

```
┌──────────────────────────────────────────────────────────────┐
│  VALIDAÇÃO E PREVIEW                                         │
│  Ficheiro: banco_2025.xlsx                                   │
│                                                              │
│  ╭─────────────────────────────────────────────────────╮    │
│  │ 📊 RESUMO DE IMPORTAÇÃO                              │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ Total de linhas:        127                         │    │
│  │ ✅ Válidas:             125 (98.4%)                 │    │
│  │ ⚠️  Avisos:             2                           │    │
│  │ ❌ Erros:              0                           │    │
│  │                                                     │    │
│  │ Débitos totais:        45,320.50 CVE               │    │
│  │ Créditos totais:       87,654.00 CVE               │    │
│  │ Saldo final:          +42,333.50 CVE               │    │
│  ╰─────────────────────────────────────────────────────╯    │
│                                                              │
│  📋 REGISTOS COM AVISOS:                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Linha 45: ⚠️  Data sem ano (assumido 2025)          │   │
│  │ Linha 78: ⚠️  Valor muito alto (100,000) - revisar │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  🔗 RECONCILIAÇÃO INICIAL:                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Transações já no sistema:    45 (35.3%)              │   │
│  │ Transações novas:            75 (58.6%)              │   │
│  │ Possíveis duplicatas:        5  (3.9%)               │   │
│  │ Requer revisão manual:       2  (1.6%)               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [ ✅ CONFIRMAR E IMPORTAR ]                               │
│  [ 🔄 REVISAR REGISTOS ]                                   │
│  [ ❌ CANCELAR ]                                           │
└──────────────────────────────────────────────────────────────┘
```

### Tela 4: Reconciliação Manual (Possíveis Matches)

```
┌──────────────────────────────────────────────────────────────┐
│  RECONCILIAÇÃO DE TRANSAÇÕES                                 │
│  5 possíveis matches encontrados. Revise e confirme:        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Match #1: Confiança 87%                             │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Extrato:   2025-01-05 | TRF Fornecedor ABC | 1,500 │   │
│  │ Sistema:   2025-01-04 | Pagto Fornec. ABC  | 1,500 │   │
│  │                                                     │   │
│  │ Diferença: 1 dia, valor 100% match                │   │
│  │                                                     │   │
│  │ [ ✅ SIM ] [ ❌ NÃO ] [ 🔍 REVISAR ]               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Match #2: Confiança 72%                             │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Extrato:   2025-01-08 | Cheque 001234     | 2,300  │   │
│  │ Sistema:   2025-01-10 | Pagto Fornec. XYZ | 2,350  │   │
│  │                                                     │   │
│  │ Diferença: 2 dias, valor 99.8% match              │   │
│  │                                                     │   │
│  │ [ ✅ SIM ] [ ❌ NÃO ] [ 🔍 REVISAR ]               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [ ✅ CONFIRMAR TUDO ]                                      │
│  [ 🔙 VOLTAR ]                                              │
└──────────────────────────────────────────────────────────────┘
```

### Tela 5: Resultado Final

```
┌──────────────────────────────────────────────────────────────┐
│  ✅ IMPORTAÇÃO CONCLUÍDA COM SUCESSO!                        │
│                                                              │
│  ╭─────────────────────────────────────────────────────╮    │
│  │ 📊 ESTATÍSTICAS FINAIS                              │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                     │    │
│  │ Transações importadas:     125 ✅                 │    │
│  │ Reconciliadas:              85 🔗                 │    │
│  │ Novas transações:           35 🆕                │    │
│  │ Duplicatas removidas:        5 ⚠️                 │    │
│  │ Requer revisão manual:       0 🔍                │    │
│  │                                                     │    │
│  │ Período coberto:    01-jan-2025 a 31-dez-2025    │    │
│  │ Saldo final:                42,333.50 CVE         │    │
│  │                                                     │    │
│  ╰─────────────────────────────────────────────────────╯    │
│                                                              │
│  📋 PRÓXIMOS PASSOS:                                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │ ☐ Importar Faturas Emitidas                       │    │
│  │ ☐ Importar Pagtos/Recebimentos                    │    │
│  │ ☐ Revisar Contas a Pagar                          │    │
│  │ ☐ Revisar Contas a Receber                        │    │
│  │ ☐ Gerar Relatórios de Fecho                       │    │
│  │ ☐ Certificar Fecho Mensal 2025                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  [ 📊 VER DETALHES ] [ 📥 PRÓXIMA IMPORTAÇÃO ]             │
│  [ 🏠 VOLTAR AO MENU ]                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ ESPECIFICAÇÃO TÉCNICA

### Estrutura de Diretórios

```
/workspaces/Gestos1/
├── import-history/
│   ├── components/
│   │   ├── HistoricalImportWizard.tsx      # Wizard principal (5 telas)
│   │   ├── DataSourceSelector.tsx          # Tela 1: Seleção
│   │   ├── ColumnMappingUI.tsx            # Tela 2: Mapeamento
│   │   ├── ValidationPreview.tsx          # Tela 3: Validação
│   │   ├── ReconciliationMatrix.tsx       # Tela 4: Reconciliação
│   │   ├── ImportResults.tsx              # Tela 5: Resultado
│   │   └── BankStatementUploader.tsx      # Componente upload
│   │
│   ├── hooks/
│   │   ├── useHistoricalImport.ts         # Orquestrador principal
│   │   ├── useBankImport.ts               # Lógica extrato banco
│   │   ├── useInvoiceImport.ts            # Lógica faturas
│   │   └── usePaymentImport.ts            # Lógica pagtos/recebim
│   │
│   ├── services/
│   │   ├── historicalImportService.ts     # Serviço base
│   │   ├── bankStatementProcessor.ts      # Processador extrato
│   │   ├── invoiceProcessor.ts            # Processador faturas
│   │   ├── paymentProcessor.ts            # Processador pagtos
│   │   ├── reconciliationEngine.ts        # Motor reconciliação
│   │   └── historicalImportValidators.ts  # Validações
│   │
│   ├── types/
│   │   └── historical-import.types.ts     # Tipos específicos
│   │
│   └── utils/
│       ├── columnDetection.ts             # Detecção inteligente colunas
│       ├── matchingAlgorithm.ts           # Algoritmo scoring
│       └── reconciliationHelpers.ts       # Funções suporte

├── components/
│   └── HistoricalImportModule.tsx         # Módulo wrapper (integrado na app)
```

### Tipos TypeScript Principais

```typescript
// historical-import.types.ts

// === CONFIGURAÇÃO ===

export interface HistoricalImportConfig {
    year: number;                         // 2025
    sources: ('bank' | 'invoices' | 'payments')[];
    mappings: {
        bank?: BankColumnMapping;
        invoices?: InvoiceColumnMapping;
        payments?: PaymentColumnMapping;
    };
    validationRules: {
        allowFutureDates?: boolean;
        dateRangeStart: string;            // 2025-01-01
        dateRangeEnd: string;              // 2025-12-31
        strictClientMatch?: boolean;
    };
}

// === RESULTADOS PROCESSAMENTO ===

export interface ImportProcessingResult {
    source: 'bank' | 'invoices' | 'payments';
    status: 'success' | 'partial' | 'error';
    recordsTotal: number;
    recordsValid: number;
    recordsErrors: number;
    recordsWarnings: number;
    errors: ImportError[];
    warnings: ImportWarning[];
    preview: any[];  // Primeiros 10 registos para preview
}

// === RECONCILIAÇÃO ===

export interface ReconciliationMatch {
    id: string;
    confidence: number;               // 0-100
    source1: {
        type: 'bank' | 'invoices' | 'payments';
        id: string;
        date: string;
        amount: number;
        description: string;
    };
    source2: {
        type: 'system' | 'bank' | 'invoices' | 'payments';
        id: string;
        date: string;
        amount: number;
        description: string;
    };
    matchType: 'exact' | 'fuzzy' | 'partial';
    reasoning: string;
    status: 'pending_review' | 'confirmed' | 'rejected';
}

// === HISTÓRICO DE IMPORTAÇÃO ===

export interface HistoricalImportSession {
    id: string;
    createdAt: string;
    completedAt?: string;
    year: number;
    sources: string[];
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
        type: 'bank' | 'invoices' | 'payments';
        hash: string;                 // Para detecção duplicatas
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
```

### APIs Principais

#### 1. Serviço Base

```typescript
// historicalImportService.ts

export const historicalImportService = {
    /**
     * Inicia uma nova sessão de importação
     */
    createSession: (year: number, sources: string[]): Promise<string> => {},
    
    /**
     * Processa ficheiro e retorna preview
     */
    processFile: (
        file: File,
        type: 'bank' | 'invoices' | 'payments',
        mapping?: ColumnMapping
    ): Promise<ImportProcessingResult> => {},
    
    /**
     * Valida dados contra regras de negócio
     */
    validate: (
        data: any[],
        type: 'bank' | 'invoices' | 'payments'
    ): Promise<ValidationResult> => {},
    
    /**
     * Executa reconciliação inteligente
     */
    reconcile: (
        importedData: any[],
        existingData: any[],
        options: ReconciliationOptions
    ): Promise<ReconciliationMatch[]> => {},
    
    /**
     * Confirma importação e insere em DB
     */
    confirmImport: (
        sessionId: string,
        matches: ReconciliationMatch[]
    ): Promise<ImportResult> => {},
    
    /**
     * Cancela sessão
     */
    cancelSession: (sessionId: string): Promise<void> => {},
    
    /**
     * Obtém histórico de importações
     */
    getHistory: (): Promise<HistoricalImportSession[]> => {},
};
```

#### 2. Motor de Reconciliação

```typescript
// reconciliationEngine.ts

export const reconciliationEngine = {
    /**
     * Calcula score de compatibilidade entre dois registos
     */
    calculateMatchScore: (
        record1: any,
        record2: any,
        options: ScoringOptions
    ): number => {},
    
    /**
     * Encontra possíveis matches para um registo
     */
    findMatches: (
        record: any,
        candidateList: any[],
        minScore?: number
    ): ReconciliationMatch[] => {},
    
    /**
     * Detecta duplicatas exatas
     */
    findExactDuplicates: (records: any[]): Duplicate[] => {},
    
    /**
     * Cria matriz de reconciliação (3 fontes)
     */
    createReconciliationMatrix: (
        bankTransactions: any[],
        invoices: any[],
        payments: any[]
    ): ReconciliationMatrix => {},
};
```

#### 3. Detecção de Colunas

```typescript
// columnDetection.ts

export const columnDetection = {
    /**
     * Detecta automaticamente colunas em ficheiro Excel
     */
    detectColumns: (
        firstRow: any[],
        sampleRows: any[][],
        type: 'bank' | 'invoices' | 'payments'
    ): ColumnMapping => {},
    
    /**
     * Retorna sugestões de mapeamento
     */
    suggestMapping: (
        detectedColumns: string[],
        type: 'bank' | 'invoices' | 'payments'
    ): ColumnMapping => {},
    
    /**
     * Valida se mapeamento está completo
     */
    validateMapping: (mapping: ColumnMapping): ValidationResult => {},
};
```

### Tipos de Erro e Avisos

```typescript
// Códigos de erro

export const IMPORT_ERROR_CODES = {
    // Formato
    INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
    INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
    INVALID_NIF_FORMAT: 'INVALID_NIF_FORMAT',
    INVALID_AMOUNT: 'INVALID_AMOUNT',
    
    // Validação
    DUPLICATE_REFERENCE: 'DUPLICATE_REFERENCE',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
    VALUE_OUT_OF_RANGE: 'VALUE_OUT_OF_RANGE',
    
    // Reconciliação
    AMBIGUOUS_MATCH: 'AMBIGUOUS_MATCH',
    NO_MATCH_FOUND: 'NO_MATCH_FOUND',
    DUPLICATE_IN_IMPORT: 'DUPLICATE_IN_IMPORT',
    
    // Sistema
    FILE_READ_ERROR: 'FILE_READ_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    PERMISSION_ERROR: 'PERMISSION_ERROR',
};

export type ImportError = {
    code: string;
    line?: number;
    field?: string;
    message: string;
    severity: 'error' | 'warning';
    suggestion?: string;
};
```

---

## 🎯 FECHO CONTABILÍSTICO

### Preparação para Fecho Mensal

Após importar todos os dados de 2025, o sistema deve permitir:

#### 1. Verificação de Completude
```
Para cada mês de 2025:
- Todos os movimentos de tesouraria reconciliados? ✓
- Todas as contas a pagar contabilizadas? ✓
- Todas as contas a receber contabilizadas? ✓
- Saldo inicial = saldo anterior final? ✓
- Saldo final coerente? ✓
```

#### 2. Balanço de Verificação (Trial Balance)
```
Por cada conta contabilística:
- Saldo inicial (1 jan 2025)
- Débitos (período)
- Créditos (período)
- Saldo final (31 dez 2025)

Validação: Total Débitos = Total Créditos
```

#### 3. Relatórios de Certificação
```
Gerar:
- Diário de Tesouraria por período
- Razão (Ledger) por conta
- Extrato de Contas a Pagar
- Extrato de Contas a Receber
- Balanço por período
```

#### 4. Certificação de Fecho
```
Para cada mês:
- Data de fecho (último dia do mês)
- Utilizador que fechou
- Hash de integridade dos dados
- Status: "Aberto", "Pré-fecho", "Fechado"

Après fecho: Não permitir edição de registos do período
```

---

## 📋 PLANO DE IMPLEMENTAÇÃO

### Fase 1: Preparação (Semana 1)
- [ ] Criar tipos TypeScript específicos
- [ ] Implementar base de dados local (cache) para importações
- [ ] Criar hooks de estado para wizard
- [ ] Estruturar componentes vazios

### Fase 2: Processamento (Semana 2)
- [ ] Implementar parseadores (Excel/CSV)
- [ ] Detecção automática de colunas
- [ ] Validadores por tipo de fonte
- [ ] Motor de reconciliação básico

### Fase 3: UI/UX (Semana 3)
- [ ] Wizard visual (5 telas)
- [ ] Preview e validação em tempo real
- [ ] Modal reconciliação manual
- [ ] Resultado e estatísticas

### Fase 4: Integração (Semana 4)
- [ ] Integração com módulo financeiro
- [ ] Geração de transações
- [ ] Histórico de importações
- [ ] Testes e ajustes

### Fase 5: Fecho (Semana 5)
- [ ] Módulo de fecho mensal/anual
- [ ] Relatórios de certificação
- [ ] Documentação final
- [ ] Deploy

---

## ✅ CHECKLIST DE ACEITAÇÃO

- [ ] Importar extrato bancário 2025 com 100% dos dados
- [ ] Importar faturas emitidas com match automático de clientes
- [ ] Importar pagtos/recebimentos em Excel
- [ ] Reconciliar 95%+ transações automaticamente
- [ ] Detectar 100% das duplicatas
- [ ] Gerar contas a pagar corretas
- [ ] Gerar contas a receber corretas
- [ ] Gerar movimentos de tesouraria corretos
- [ ] Validar fecho mensal com 100% de certeza
- [ ] Gerar relatórios de certificação
- [ ] Documentação clara para utilizadores
- [ ] Performance < 5s para ficheiros até 10.000 linhas

---

## 📞 SUPORTE E DOCUMENTAÇÃO

### Para Utilizadores
- [ ] Manual de importação em PDF
- [ ] Vídeo tutorial de passo a passo
- [ ] FAQ com casos comuns

### Para Desenvolvedores
- [ ] Documentação de APIs
- [ ] Exemplos de uso
- [ ] Testes unitários
- [ ] Testes de integração

---

**FIM DO DOCUMENTO**

Data de criação: 2 de Janeiro de 2026  
Última atualização: 2 de Janeiro de 2026  
Estado: Pronto para Implementação
