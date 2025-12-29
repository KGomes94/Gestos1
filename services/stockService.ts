
import { Material, StockMovement, StockMovementType } from '../types';
import { currency } from '../utils/currency';

export interface StockOperationResult {
    success: boolean;
    updatedMaterial?: Material;
    movement?: StockMovement;
    message: string;
    alertType?: 'warning' | 'error' | 'success' | 'info';
}

export const stockService = {
    /**
     * Calcula o novo Preço Médio Ponderado (PMP) após uma entrada de stock.
     * Fórmula: ((QtdAtual * CustoAtual) + (QtdEntrada * CustoEntrada)) / (QtdAtual + QtdEntrada)
     */
    calculateNewAverageCost: (
        currentStock: number, 
        currentAvgCost: number, 
        entryQty: number, 
        entryCost: number
    ): number => {
        // Se stock atual for negativo ou zero, o custo médio passa a ser o da nova entrada
        if (currentStock <= 0) return entryCost;

        const currentTotalValue = currency.mul(currentStock, currentAvgCost);
        const entryTotalValue = currency.mul(entryQty, entryCost);
        const newTotalQty = currentStock + entryQty;

        if (newTotalQty <= 0) return entryCost;

        return currency.div(currency.add(currentTotalValue, entryTotalValue), newTotalQty);
    },

    /**
     * Gera um movimento de stock e retorna o material atualizado e o registo do movimento.
     */
    processMovement: (
        material: Material, 
        qty: number, 
        type: StockMovementType, 
        reason: string,
        user: string,
        documentRef?: string,
        entryPrice?: number // Apenas para ENTRADA
    ): StockOperationResult => {
        
        let newStock = material.stock || 0;
        let newAvgCost = material.avgCost || 0; // Usamos avgCost se existir, senão 0
        let alertType: 'success' | 'warning' | 'error' | 'info' = 'success';
        let alertMsg = 'Movimento registado com sucesso.';

        // 1. Validar Saída (Stock Insuficiente)
        if (type === 'SAIDA') {
            if (newStock < qty) {
                // Dependendo da regra de negócio, poderiamos bloquear (return success: false).
                // Aqui permitimos ficar negativo, mas emitimos um aviso grave.
                alertType = 'warning';
                alertMsg = `Atenção: Stock insuficiente para ${material.name}. Ficou negativo!`;
            }
        }

        // 2. Calcular Novos Valores
        if (type === 'ENTRADA') {
            // Se for entrada e tivermos preço de custo, recalculamos o PMP
            if (entryPrice !== undefined && entryPrice > 0) {
                newAvgCost = stockService.calculateNewAverageCost(newStock, newAvgCost, qty, entryPrice);
            }
            newStock += qty;
        } else {
            // SAIDA ou AJUSTE (Negativo)
            newStock -= qty;
        }

        // 3. Verificações de Nível de Stock Pós-Movimento
        if (type !== 'ENTRADA') {
            if (newStock === 0) {
                alertType = 'warning';
                alertMsg = `Stock Esgotado: ${material.name} atingiu zero unidades.`;
            } else if (newStock < 0) {
                alertType = 'error';
                alertMsg = `Stock Negativo: ${material.name} está com ${newStock} unidades.`;
            } else if (newStock <= (material.minStock || 0)) {
                alertType = 'warning';
                alertMsg = `Alerta de Stock Mínimo: ${material.name} (${newStock} un).`;
            }
        }

        // 4. Criar Registo
        const movement: StockMovement = {
            id: `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            materialId: material.id,
            materialName: material.name,
            date: new Date().toISOString().split('T')[0],
            type,
            quantity: qty,
            reason,
            documentRef,
            user,
            stockAfter: newStock,
            createdAt: new Date().toISOString()
        };

        // 5. Atualizar Material
        const updatedMaterial: Material = {
            ...material,
            stock: newStock,
            avgCost: newAvgCost,
            updatedAt: new Date().toISOString()
        };

        return { 
            success: true, 
            updatedMaterial, 
            movement,
            message: alertMsg,
            alertType
        };
    }
};
