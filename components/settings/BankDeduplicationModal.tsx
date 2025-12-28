
import React, { useState, useEffect, useMemo } from 'react';
import { BankTransaction } from '../../types';
import Modal from '../Modal';
import { AlertTriangle, CheckCircle2, Trash2, Split, CheckSquare, Square, Info } from 'lucide-react';

interface BankDeduplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: BankTransaction[];
    onConfirm: (idsToRemove: string[]) => void;
}

interface DuplicateGroup {
    key: string;
    items: BankTransaction[];
}

export const BankDeduplicationModal: React.FC<BankDeduplicationModalProps> = ({
    isOpen, onClose, transactions, onConfirm
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [groups, setGroups] = useState<DuplicateGroup[]>([]);

    // Lógica de Deteção Inteligente
    useEffect(() => {
        if (isOpen) {
            const grouped: Record<string, BankTransaction[]> = {};
            
            transactions.forEach(tx => {
                // Cria uma assinatura única normalizada
                // Remove espaços extra e converte para minúsculas para comparação
                const cleanDesc = tx.description.trim().replace(/\s+/g, ' ').toLowerCase();
                const key = `${tx.date}|${Number(tx.amount).toFixed(2)}|${cleanDesc}`;
                
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(tx);
            });

            // Filtrar apenas grupos com mais de 1 item (duplicados)
            const duplicates = Object.entries(grouped)
                .filter(([_, items]) => items.length > 1)
                .map(([key, items]) => ({ key, items }));

            setGroups(duplicates);

            // Sugerir remoção automática
            const suggestion = new Set<string>();
            duplicates.forEach(group => {
                // Ordenar: 
                // 1. Manter Conciliados (reconciled = true vem primeiro)
                // 2. Manter IDs mais curtos (geralmente originais manuais) ou mais antigos
                const sorted = [...group.items].sort((a, b) => {
                    if (a.reconciled && !b.reconciled) return -1; // a vem primeiro (manter)
                    if (!a.reconciled && b.reconciled) return 1;  // b vem primeiro (manter)
                    return 0; // Se igual, mantém ordem original
                });

                // Selecionar todos para apagar, EXCETO o primeiro (o "Melhor" candidato a manter)
                for (let i = 1; i < sorted.length; i++) {
                    suggestion.add(sorted[i].id);
                }
            });

            setSelectedIds(suggestion);
        }
    }, [isOpen, transactions]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleConfirm = () => {
        onConfirm(Array.from(selectedIds));
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gestão de Duplicados Bancários">
            <div className="flex flex-col h-[80vh]">
                <div className="bg-blue-50 p-4 mb-4 rounded-xl border border-blue-100 flex items-start gap-3 text-sm text-blue-900 shrink-0">
                    <Split className="text-blue-600 shrink-0 mt-0.5" size={20}/>
                    <div>
                        <p className="font-bold mb-1">Análise Inteligente</p>
                        <p className="text-xs opacity-80">
                            O sistema agrupou transações com a mesma <strong>Data</strong>, <strong>Valor</strong> e <strong>Descrição</strong> similar.
                            <br/>Sugestão automática: Mantém registos conciliados, marca os restantes para eliminar.
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50 border rounded-xl p-4 space-y-4">
                    {groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <CheckCircle2 size={48} className="mb-4 opacity-20 text-green-500"/>
                            <p className="font-bold">Tudo limpo!</p>
                            <p className="text-xs">Não foram encontrados duplicados exatos.</p>
                        </div>
                    ) : (
                        groups.map((group, idx) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center text-xs font-bold text-gray-600">
                                    <span>GRUPO {idx + 1}</span>
                                    <span>{group.items[0].date} • {Number(group.items[0].amount).toLocaleString()} CVE</span>
                                </div>
                                <div>
                                    {group.items.map(tx => {
                                        const isSelected = selectedIds.has(tx.id);
                                        return (
                                            <div 
                                                key={tx.id} 
                                                onClick={() => toggleSelection(tx.id)}
                                                className={`p-3 flex items-center justify-between cursor-pointer transition-colors border-b last:border-0 ${isSelected ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-green-50'}`}
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className={`shrink-0 ${isSelected ? 'text-red-500' : 'text-green-500'}`}>
                                                        {isSelected ? <CheckSquare size={18}/> : <Square size={18}/>}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                                            {tx.description}
                                                        </p>
                                                        <div className="flex gap-2 text-[10px] uppercase font-bold mt-0.5">
                                                            <span className="text-gray-400">{tx.id}</span>
                                                            {tx.reconciled && (
                                                                <span className="bg-green-100 text-green-700 px-1.5 rounded flex items-center gap-1">
                                                                    <CheckCircle2 size={10}/> Conciliado
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-xs font-bold shrink-0">
                                                    {isSelected ? <span className="text-red-600">Eliminar</span> : <span className="text-green-600">Manter</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="pt-4 border-t mt-4 flex justify-between items-center shrink-0 gap-4">
                    <div className="text-xs text-gray-500">
                        <strong>{selectedIds.size}</strong> registos selecionados para remoção.
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50 text-xs uppercase">Cancelar</button>
                        <button 
                            onClick={handleConfirm} 
                            disabled={selectedIds.size === 0}
                            className="px-6 py-2 bg-red-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs"
                        >
                            <Trash2 size={14}/> Eliminar Selecionados
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
