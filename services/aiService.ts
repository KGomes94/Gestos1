
import { GoogleGenAI, Type } from "@google/genai";
import { SystemSettings, BankTransaction, Transaction } from "../types";

export const aiService = {
  /**
   * Envia uma mensagem para o Gemini com o contexto atual da aplicação
   */
  askAssistant: async (
    message: string, 
    contextData: string, 
    viewName: string,
    history: {role: 'user' | 'model', parts: {text: string}[]}[]
  ) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const systemInstruction = `
        Você é o GestOs Intelligence, um consultor empresarial sénior integrado num ERP.
        
        O utilizador está atualmente a visualizar o ecrã: "${viewName}".
        
        Abaixo estão os dados brutos (JSON) do que o utilizador está a ver ou dados relevantes do sistema para este contexto:
        ${contextData}

        O seu objetivo:
        1. Analisar os dados fornecidos para encontrar padrões, anomalias ou oportunidades de poupança/melhoria.
        2. Responder às perguntas do utilizador com base nestes dados.
        3. Se necessário, cruze com conhecimentos gerais de gestão, leis de Cabo Verde (se aplicável ao contexto financeiro/RH) e melhores práticas.
        4. Seja conciso, profissional e use formatação Markdown para listas e negrito.
        5. Se os dados estiverem vazios, dê dicas genéricas sobre como usar este módulo.
      `;

      const modelId = 'gemini-3-flash-preview';

      const response = await ai.models.generateContent({
        model: modelId,
        contents: [
            ...history,
            { role: 'user', parts: [{ text: message }] }
        ],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
          tools: [{ googleSearch: {} }] // Enable Search Grounding for updated info
        }
      });

      return {
        text: response.text || "Não consegui gerar uma resposta neste momento.",
        groundingMetadata: response.candidates?.[0]?.groundingMetadata
      };

    } catch (error) {
      console.error("Erro no Gemini:", error);
      return { 
        text: "Desculpe, ocorreu um erro ao contactar a inteligência artificial. Verifique a sua chave de API ou conexão." 
      };
    }
  },

  /**
   * Analisa transações bancárias e do sistema para sugerir conciliações
   */
  reconcileTransactions: async (bankTxs: BankTransaction[], sysTxs: Transaction[]) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const modelId = 'gemini-3-flash-preview';

        // Prepara os dados minificados para poupar tokens
        const bankData = bankTxs.map(b => ({ id: b.id, dt: b.date, desc: b.description, val: b.amount }));
        const sysData = sysTxs.map(t => ({ id: t.id, dt: t.date, desc: t.description, val: (t.income || 0) - (t.expense || 0) }));

        const prompt = `
            Atue como um motor de Conciliação Bancária Rigoroso.
            
            Entrada:
            1. Lista de Transações Bancárias (Bank).
            2. Lista de Registos Internos (System).

            ALGORITMO DE CORRESPONDÊNCIA (Siga nesta ordem):
            
            PASSO 1: VALOR (Obrigatório)
            - O valor da transação bancária DEVE ser igual ao valor da transação do sistema (ou soma de várias).
            - Margem de tolerância máxima: 0.05.

            PASSO 2: DATA vs DESCRIÇÃO (Critério de Desempate)
            - CASO A (Mesma Data): Se o valor bate e a data é EXATAMENTE a mesma, a descrição pode variar (assuma match).
            - CASO B (Data Próxima): Se o valor bate mas a data varia (+/- 5 dias), a descrição DEVE TER SEMELHANÇA SEMÂNTICA (ex: "Restaurante" vs "Almoço", "Cliente X" vs "Recebimento X").
            
            PASSO 3: MANY-TO-ONE
            - Verifique se a soma de vários registos do sistema corresponde a um único movimento bancário no mesmo dia.

            Retorne APENAS um JSON com as correspondências de alta e média confiança.
            
            Dados Banco: ${JSON.stringify(bankData)}
            Dados Sistema: ${JSON.stringify(sysData)}
        `;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            bankId: { type: Type.STRING, description: "ID da transação bancária" },
                            systemIds: { 
                                type: Type.ARRAY, 
                                items: { type: Type.NUMBER },
                                description: "Array de IDs das transações do sistema que correspondem" 
                            },
                            confidence: { type: Type.STRING, description: "Deve ser 'Alta' ou 'Média'" },
                            reason: { type: Type.STRING, description: "Explique o match (Ex: 'Valor exato e mesma data', 'Valor exato e descrição similar')" }
                        },
                        required: ["bankId", "systemIds", "confidence", "reason"]
                    }
                }
            }
        });

        return JSON.parse(response.text || "[]");

    } catch (error) {
        console.error("Erro na Auto-Conciliação:", error);
        return [];
    }
  }
};
