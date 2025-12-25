
// AI Service temporariamente desativado para corrigir erros de build
export const aiService = {
  /**
   * Envia uma mensagem para o Gemini (Desativado)
   */
  askAssistant: async (
    message: string, 
    contextData: string, 
    viewName: string,
    history: any[]
  ) => {
    console.log("AI Assistant is disabled.");
    return {
      text: "O assistente de IA está temporariamente indisponível.",
      groundingMetadata: null
    };
  },

  /**
   * Analisa transações (Desativado)
   */
  reconcileTransactions: async (bankTxs: any[], sysTxs: any[]) => {
    console.log("AI Reconciliation is disabled.");
    return [];
  }
};
