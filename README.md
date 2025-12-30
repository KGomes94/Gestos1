 GestOs ERP - Sistema de Gestão Empresarial (Serverless / Google Drive)

 📖 Visão Geral
O GestOs é um ERP (Enterprise Resource Planning) modular, desenvolvido especificamente para pequenas e microempresas (foco no mercado de Cabo Verde). 

A sua arquitetura é Serverless Frontend-Only: toda a lógica de negócio corre no browser do cliente e a persistência de dados é feita diretamente no Google Drive pessoal do utilizador, eliminando custos de servidores backend e garantindo a soberania dos dados.

---

 🏗️ Arquitetura Técnica

 Stack Tecnológica
*   Core: React 18, TypeScript, Vite.
*   Estilo: Tailwind CSS (Design System personalizado).
*   Persistência: Google Drive API v3 (JSON Storage).
*   Gráficos: Recharts.
*   PDFs: jsPDF + AutoTable.
*   Excel: XLSX (SheetJS).

 Estrutura de Dados (Sharding v2.0)
A base de dados não é um monólito. Para garantir performance e segurança, os dados são fragmentados em ficheiros JSON independentes na pasta `GestOs_Data_v2` do Google Drive:

1.  `config.json`: Definições, Utilizadores, Plano de Contas.
2.  `crm.json`: Clientes, Funcionários e interações.
3.  `finance.json`: Faturas, Transações Bancárias, Compras e Avenças (O ficheiro mais pesado).
4.  `operations.json`: Propostas, Agenda, Materiais e Stock.

 Sistema de Segurança e Backup
*   Autenticação: OAuth2 via Google Identity Services.
*   Backups: O sistema executa um backup automático diário de todos os ficheiros JSON para a pasta `/Backups` no arranque da aplicação.
*   Concorrência: Sistema otimizado de escritas granulares para minimizar colisões entre utilizadores simultâneos.

---

 📦 Documentação dos Módulos

 1. 📊 Dashboard
*   Função: Visão geral da saúde da empresa.
*   Cálculos:
    *   *Fluxo de Caixa Real:* Entradas vs Saídas efetivamente pagas.
    *   *EBITDA:* Lucro antes de juros e impostos (Receita Operacional - Custos).
    *   *Alertas:* Deteta automaticamente faturas vencidas, agendamentos atrasados e stock baixo.

 2. 💰 Financeiro (Hub Central)
Este módulo é o coração do sistema, dividido em três vertentes:

*   Contas a Receber (Faturação):
    *   Emissão de Faturas (FTE), Recibos (FRE), Talões (TVE) e Notas de Crédito (NCE).
    *   Geração de IUD (Identificador Único) e algoritmo Luhn conforme regras da DNRE (Cabo Verde).
    *   Gestão de Avenças (Recorrentes): Processamento automático de contratos mensais.
*   Contas a Pagar (Compras):
    *   Registo de despesas e compras a fornecedores.
    *   Integração direta com o stock (entrada de material ao lançar compra).
    *   Gestão de pagamentos recorrentes (ex: Renda, Internet).
*   Tesouraria (Bancos):
    *   Registo de movimentos bancários reais.
    *   Smart Match (Conciliação): Algoritmo que sugere automaticamente a correspondência entre uma transação bancária e uma fatura/despesa baseando-se em data e valor.

 3. 📅 Agenda & Serviços
*   Função: Gestão de equipas técnicas e ordens de serviço.
*   Fluxo: Agendamento -> Execução -> Assinatura Digital do Cliente (no tablet/móvel) -> Conversão para Fatura.
*   Deteção de Conflitos: O sistema avisa se um técnico for agendado para dois serviços sobrepostos.

 4. 🤝 Propostas Comerciais
*   Função: Criação de orçamentos (Pipeline de Vendas).
*   Cálculo de Margem: O sistema estima o lucro da proposta baseando-se no Preço de Custo dos materiais vs Preço de Venda.
*   Conversão: Botão de "um clique" para transformar uma proposta aceite numa Fatura Rascunho.

 5. 📦 Catálogo & Stock
*   Função: Gestão de produtos e serviços.
*   Custo Médio (PMP): O sistema recalcula o preço médio ponderado a cada nova entrada de stock para valorização correta do inventário.
*   Histórico: Rastreabilidade completa de todas as entradas e saídas (quem fez, quando e porquê).

 6. 👥 Entidades & RH
*   Entidades: Base de dados unificada de Clientes e Fornecedores com validação de NIF.
*   RH: Ficha de funcionários, processamento de salários base e gestão de contratos.

 7. ⚙️ Configurações
*   Fiscalidade: Definição de séries de faturação, taxas de IVA e Retenção na Fonte.
*   Utilizadores: Gestão de permissões baseada em cargos (Admin, Gestor, Financeiro, Técnico).
*   Manutenção: Ferramentas para limpeza de dados, download de JSONs e reset de sistema.

---

 📜 Log de Versões (Changelog)

 v2.2.1-UI (Atual)
*   Melhoria UI: Otimização do espaçamento nas tabelas de "Contas a Pagar" para maior densidade de informação.
*   Fix: Correção do problema de scroll que cortava o último registo nas listagens.
*   Refactor: Consolidação das interfaces de TypeScript para prevenir erros de tipagem em `RecurringPurchase`.

 v2.2.0 - Módulo de Compras Avançado
*   Novo: Módulo completo de Gestão de Compras (Contas a Pagar).
*   Feature: Processamento em lote de despesas recorrentes.
*   Feature: Integração automática de compras com entrada de Stock.

 v2.1.0 - Performance & Sharding
*   Arquitetura: Fragmentação da base de dados (`database.json` único -> múltiplos ficheiros) para suportar milhares de registos sem lentidão.
*   Segurança: Implementação de sistema de Backups Automáticos Diários.
*   Feature: Ferramenta de deteção e remoção de duplicados bancários.

 v2.0.0 - Interface & UX (Major Release)
*   UI: Redesign completo para interface moderna e responsiva (Tailwind CSS).
*   Feature: Introdução do "Financial Hub" unificando Faturação e Tesouraria.
*   Feature: Assinatura digital em Ordens de Serviço.

 v1.5.0 - Faturação & Fiscalidade
*   Core: Implementação do motor de cálculo fiscal (IVA, Retenção, IUD).
*   Feature: Geração de PDFs profissionais (A4 e Térmico).
*   Feature: Módulo de Avenças (Contratos Recorrentes).

 v1.2.0 - Integração Google Drive
*   Backend: Migração de `localStorage` para API do Google Drive.
*   Auth: Implementação de Login com Google.

 v1.0.0 - MVP (Versão Inicial)
*   Funcionalidades: Registo simples de Receitas/Despesas e Base de Dados de Clientes.
*   Armazenamento: Local (Browser).
