
import React, { useState, useEffect } from 'react';
import { StickyNote, Plus, X, Trash2, CheckSquare, Square, Slash, Save } from 'lucide-react';
import { db } from '../services/db';
import { DevNote, DevNoteStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useConfirmation } from '../contexts/ConfirmationContext';

export const DevNotes: React.FC = () => {
    const { user } = useAuth();
    const { requestConfirmation } = useConfirmation();
    const [isOpen, setIsOpen] = useState(false);
    const [notes, setNotes] = useState<DevNote[]>([]);
    const [newNoteText, setNewNoteText] = useState('');
    const [newNoteDate, setNewNoteDate] = useState('');

    useEffect(() => {
        const loadNotes = async () => {
            const data = await db.devNotes.getAll();
            // Normalize legacy notes that used `completed: boolean` to new `status` shape
            const normalized = (data || []).map((n: any) => {
                if (n.status) return n as DevNote;
                const status: DevNoteStatus = (n.completed === true) ? 'completed' : 'pending';
                const mapped: DevNote = { ...n, status } as DevNote;
                delete (mapped as any).completed;
                return mapped;
            });
            setNotes(normalized);
        };
        loadNotes();
    }, [isOpen]); // Reload when opened to get fresh data if synced

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNoteText.trim()) return;

        const newNote: DevNote = {
            id: Date.now(),
            text: newNoteText,
            status: 'pending',
            createdAt: new Date().toISOString(),
            scheduledFor: newNoteDate ? new Date(newNoteDate).toISOString() : undefined,
            author: user?.name || 'Desconhecido'
        };

        const updated = [newNote, ...notes];
        setNotes(updated);
        await db.devNotes.save(updated);
        setNewNoteText('');
        setNewNoteDate('');
    };

    const toggleCompleted = async (id: number) => {
        const updated = notes.map(n => n.id === id ? { ...n, status: (n.status === 'completed' ? 'pending' : 'completed') as DevNoteStatus } : n);
        setNotes(updated);
        await db.devNotes.save(updated);
    };

    const toggleCancelled = async (id: number) => {
        const updated = notes.map(n => n.id === id ? { ...n, status: (n.status === 'cancelled' ? 'pending' : 'cancelled') as DevNoteStatus } : n);
        setNotes(updated);
        await db.devNotes.save(updated);
    };

    const deleteNote = async (id: number) => {
        requestConfirmation({
            title: "Apagar Nota",
            message: "Deseja remover esta nota?",
            confirmText: "Apagar",
            variant: "danger",
            onConfirm: async () => {
                const updated = notes.filter(n => n.id !== id);
                setNotes(updated);
                await db.devNotes.save(updated);
            }
        });
    };

    const pendingCount = notes.filter(n => n.status === 'pending').length;

    return (
        <>
            <div className="fixed bottom-4 left-32 z-[120]">
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 shadow-lg border border-yellow-500 rounded-full p-2 transition-all hover:scale-110 relative" 
                    title="Bloco de Notas / Melhorias"
                >
                    <StickyNote size={20} />
                    {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                            {pendingCount}
                        </span>
                    )}
                </button>
            </div>

            {isOpen && (
                <div className="fixed bottom-16 left-4 w-80 bg-yellow-50 rounded-2xl shadow-2xl border border-yellow-200 z-[120] flex flex-col max-h-[500px] animate-fade-in-up">
                    <div className="p-4 border-b border-yellow-200 bg-yellow-100/50 rounded-t-2xl flex justify-between items-center">
                        <div>
                            <h3 className="font-black text-yellow-800 text-sm">Roadmap & Melhorias</h3>
                            <p className="text-[10px] text-yellow-700">Pré-produção v2.1</p>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-yellow-700 hover:text-yellow-900"><X size={18}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {notes.length === 0 && (
                            <div className="text-center text-yellow-600/50 text-xs py-8 italic">
                                Nenhuma nota registada.<br/>Registe bugs ou ideias aqui.
                            </div>
                        )}
                        {notes.map(note => {
                            const isCompleted = note.status === 'completed';
                            const isCancelled = note.status === 'cancelled';
                            return (
                                <div key={note.id} className={`p-3 rounded-lg border flex gap-3 group transition-all ${isCancelled ? 'bg-white border-red-100 opacity-60 text-red-500' : isCompleted ? 'bg-yellow-100/50 border-yellow-100 opacity-60' : 'bg-white border-yellow-200 shadow-sm'}`}>
                                    <button onClick={() => toggleCompleted(note.id)} className="mt-0.5 text-yellow-600 hover:text-green-600 transition-colors">
                                        {isCompleted ? <CheckSquare size={16}/> : <Square size={16}/>} 
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs leading-relaxed break-words ${isCompleted || isCancelled ? 'line-through' : ''} ${isCancelled ? 'text-red-500' : 'text-gray-800'}`}>{note.text}</p>
                                        <div className="flex justify-between items-center mt-1 gap-2">
                                            <span className="text-[9px] text-gray-400">
                                                {note.author} • {new Date(note.createdAt).toLocaleDateString()}
                                                {note.scheduledFor && (
                                                    <span className="ml-2 text-[9px] text-yellow-600">• Agendado: {new Date(note.scheduledFor).toLocaleDateString()}</span>
                                                )}
                                            </span>

                                            <div className="flex items-center gap-2">
                                                <button onClick={() => toggleCancelled(note.id)} className="text-yellow-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title={isCancelled ? 'Reativar' : 'Cancelar'}>
                                                    <Slash size={12}/>
                                                </button>
                                                <button onClick={() => deleteNote(note.id)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Apagar">
                                                    <Trash2 size={12}/>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-3 border-t border-yellow-200 bg-white rounded-b-2xl">
                        <form onSubmit={handleAddNote} className="flex gap-2">
                            <input 
                                type="text" 
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-yellow-400"
                                placeholder="Nova ideia ou correção..."
                                value={newNoteText}
                                onChange={e => setNewNoteText(e.target.value)}
                            />
                            <input type="date" value={newNoteDate} onChange={e => setNewNoteDate(e.target.value)} className="text-[11px] px-2 py-1 border border-gray-200 rounded-lg bg-gray-50" />
                            <button type="submit" disabled={!newNoteText.trim()} className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 p-2 rounded-lg disabled:opacity-50">
                                <Plus size={16}/>
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};
