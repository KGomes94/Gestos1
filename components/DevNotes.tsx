
import React, { useState, useEffect } from 'react';
import { StickyNote, Plus, X, Trash2, CheckSquare, Square, Save } from 'lucide-react';
import { db } from '../services/db';
import { DevNote } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const DevNotes: React.FC = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [notes, setNotes] = useState<DevNote[]>([]);
    const [newNoteText, setNewNoteText] = useState('');

    useEffect(() => {
        const loadNotes = async () => {
            const data = await db.devNotes.getAll();
            setNotes(data || []);
        };
        loadNotes();
    }, [isOpen]); // Reload when opened to get fresh data if synced

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNoteText.trim()) return;

        const newNote: DevNote = {
            id: Date.now(),
            text: newNoteText,
            completed: false,
            createdAt: new Date().toISOString(),
            author: user?.name || 'Desconhecido'
        };

        const updated = [newNote, ...notes];
        setNotes(updated);
        await db.devNotes.save(updated);
        setNewNoteText('');
    };

    const toggleNote = async (id: number) => {
        const updated = notes.map(n => n.id === id ? { ...n, completed: !n.completed } : n);
        setNotes(updated);
        await db.devNotes.save(updated);
    };

    const deleteNote = async (id: number) => {
        if(confirm('Apagar esta nota?')) {
            const updated = notes.filter(n => n.id !== id);
            setNotes(updated);
            await db.devNotes.save(updated);
        }
    };

    const pendingCount = notes.filter(n => !n.completed).length;

    return (
        <>
            <div className="fixed bottom-4 left-16 z-[120]">
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
                        {notes.map(note => (
                            <div key={note.id} className={`p-3 rounded-lg border flex gap-3 group transition-all ${note.completed ? 'bg-yellow-100/50 border-yellow-100 opacity-60' : 'bg-white border-yellow-200 shadow-sm'}`}>
                                <button onClick={() => toggleNote(note.id)} className="mt-0.5 text-yellow-600 hover:text-green-600 transition-colors">
                                    {note.completed ? <CheckSquare size={16}/> : <Square size={16}/>}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs text-gray-800 leading-relaxed break-words ${note.completed ? 'line-through text-gray-500' : ''}`}>{note.text}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-[9px] text-gray-400">{note.author} • {new Date(note.createdAt).toLocaleDateString()}</span>
                                        <button onClick={() => deleteNote(note.id)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={12}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
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
