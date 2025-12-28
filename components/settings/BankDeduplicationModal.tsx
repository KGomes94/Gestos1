
import React, { useState, useEffect } from 'react';
import { BankTransaction } from '../../types';
import Modal from '../Modal';
import { CheckCircle2, Split, Check, Square, AlertTriangle } from 'lucide-react';

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

    useEffect(() => {
        if (isOpen) {
            const grouped: Record<string, BankTransaction[]> = {};
            
            // FILTRAR ELIMINADOS NA ANÁLISE
            const activeTxs = transactions.filter(tx => !tx._deleted);

            activeTxs.forEach(tx => {
                const cleanDesc = tx.description.trim().replace(/\s+/g, ' ').toLowerCase();
                const key = `${tx.date}|${Number(tx.amount).toFixed(2)}|${cleanDesc}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(tx);
            });

            const duplicates = Object.entries(grouped)
                .filter(([_, items]) => items.length > 1)
                .map(([key, items]) => ({ key, items }));

            setGroups(duplicates);

            // Sugerir remoção: manter o primeiro (ou conciliado) e marcar o resto
            const suggestion = new Set<string>();
            duplicates.forEach(group => {
                const sorted = [...group.items].sort((a, b) => {
                    if (a.reconciled && !b.reconciled) return -1;
                    if (!a.reconciled && b.reconciled) return 1;
                    return 0;
                });
                for (let i = 1; i < sorted.length; i++) suggestion.add(sorted[i].id);
            });
            setSelectedIds(suggestion);
        }
    }, [isOpen, transactions]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gestão de Duplicados Bancários">
            <div className="flex flex-col h-[80vh]">
                <div className="bg-blue-50 p-4 mb-4 rounded-xl border border-blue-100 flex items-start gap-3 text-sm text-blue-900 shrink-0">
                    <Split className="text-blue-600 shrink-0 mt-0.5" size={20}/>
                    <div>
                        <p className="font-bold mb-1">Análise de Duplicados</p>
                        <p className="text-xs opacity-80">Transações com mesma Data, Valor e Descrição similar. Registos selecionados serão marcados como eliminados para persistência na nuvem.</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50 border rounded-xl p-4 space-y-4">
                    {groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <CheckCircle2 size={48} className="mb-4 opacity-20 text-green-500"/>
                            <p className="font-bold">Tudo limpo!</p>
                            <p className="text-xs">Não foram encontrados duplicados ativos.</p>
                        </div>
                    ) : (
                        groups.map((group, idx) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center text-xs font-bold text-gray-600">
                                    <span>GRUPO {idx + 1}</span>
                                    <span>{group.items[0].date} • {Number(group.items[0].amount).toLocaleString()} CVE</span>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {group.items.map(tx => (
                                        <div key={tx.id} onClick={() => toggleSelection(tx.id)} className={`p-4 flex items-center gap-4 cursor-pointer transition-colors ${selectedIds.has(tx.id) ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedIds.has(tx.id) ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                                                {selectedIds.has(tx.id) ? <Check size={14} className="text-white"/> : <Square size={14} className="text-transparent"/>}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-800">{tx.description}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {tx.reconciled && <span className="bg-blue-100 text-blue-700 text-[9px] font-black uppercase px-1 rounded">Conciliado</span>}
                                                    <span className="text-[9px] text-gray-400 font-mono">ID: {tx.id}</span>
                                                </div>
                                            </div>
                                            {selectedIds.has(tx.id) && <span className="text-[10px] font-bold text-red-600 uppercase">Eliminar</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="pt-6 border-t mt-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 text-xs text-orange-600 font-bold">
                        <AlertTriangle size={14}/> {selectedIds.size} registos serão marcados para eliminação.
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2 border rounded-xl font-bold text-gray-500">Cancelar</button>
                        <button onClick={() => onConfirm(Array.from(selectedIds))} disabled={selectedIds.size === 0} className="px-8 py-2 bg-red-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-red-700 disabled:opacity-50">Eliminar Selecionados</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
