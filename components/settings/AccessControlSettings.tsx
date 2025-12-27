
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { UserCog, Plus, Lock, UserCheck, UserX, Edit2, Trash2, RefreshCw } from 'lucide-react';
import Modal from '../Modal';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/db';

interface AccessControlSettingsProps {
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>; // Mantido para compatibilidade, mas vamos recarregar do DB
}

export const AccessControlSettings: React.FC<AccessControlSettingsProps> = ({ users: initialUsers, setUsers: setParentUsers }) => {
    const { notify } = useNotification();
    const { user: currentUser } = useAuth();
    
    const [localUsers, setLocalUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<User>>({ role: 'TECNICO', active: true });

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const data = await db.users.getAll();
            setLocalUsers(data);
            setParentUsers(data); // Sincroniza estado pai se necessário
        } catch (error) {
            console.error(error);
            notify('error', 'Erro ao carregar utilizadores.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingUser.name) {
            notify('error', 'Nome é obrigatório.');
            return;
        }

        if (!editingUser.id) {
            // Criação
            if (!editingUser.email || !editingUser.password) {
                notify('error', 'Email e Palavra-passe são obrigatórios para novos utilizadores.');
                return;
            }
            
            setIsLoading(true);
            const res = await db.users.create(editingUser);
            setIsLoading(false);

            if (res.success) {
                notify('success', 'Utilizador criado com sucesso.');
                setIsUserModalOpen(false);
                fetchUsers();
            } else {
                notify('error', (res as any).error || 'Erro ao criar utilizador.');
            }

        } else {
            // Atualização
            setIsLoading(true);
            const res = await db.users.update(editingUser as User);
            setIsLoading(false);

            if (res.success) {
                notify('success', 'Utilizador atualizado.');
                setIsUserModalOpen(false);
                fetchUsers();
            } else {
                notify('error', (res as any).error || 'Erro ao atualizar.');
            }
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (id === currentUser?.id) {
            notify('error', 'Não pode eliminar o seu próprio utilizador.');
            return;
        }
        if (confirm('Tem a certeza que deseja desativar este utilizador? Ele perderá o acesso ao sistema.')) {
            await db.users.delete(id);
            notify('success', 'Utilizador desativado.');
            fetchUsers();
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="border-b pb-4 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <UserCog size={20} className="text-green-600"/> Gestão de Utilizadores
                    </h3>
                    <p className="text-sm text-gray-500">Controlo de acesso e contas reais do sistema.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchUsers} className="p-2 text-gray-500 hover:text-green-600 rounded-lg bg-gray-100 hover:bg-green-50 transition-colors">
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button onClick={() => { setEditingUser({ role: 'TECNICO', active: true }); setIsUserModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 hover:bg-green-700 transition-all shadow-sm">
                        <Plus size={16}/> Novo Utilizador
                    </button>
                </div>
            </div>

            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-[10px] font-black uppercase text-gray-500">
                        <tr>
                            <th className="px-6 py-3 text-left">Nome / Email</th>
                            <th className="px-6 py-3 text-left">Cargo</th>
                            <th className="px-6 py-3 text-center">Estado</th>
                            <th className="px-6 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {localUsers.map(u => (
                            <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.active ? 'opacity-60 bg-gray-50' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-800">{u.name}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-1"><Lock size={10}/> {u.email || u.username}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : u.role === 'GESTOR' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {u.active ? 
                                        <span className="text-green-600 flex items-center justify-center gap-1 text-xs font-bold"><UserCheck size={14}/> Ativo</span> : 
                                        <span className="text-red-400 flex items-center justify-center gap-1 text-xs font-bold"><UserX size={14}/> Inativo</span>
                                    }
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors" title="Editar"><Edit2 size={16}/></button>
                                        {u.active && u.id !== currentUser?.id && (
                                            <button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Desativar"><Trash2 size={16}/></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {localUsers.length === 0 && !isLoading && (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">Nenhum utilizador encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={editingUser.id ? "Editar Utilizador" : "Criar Novo Utilizador"}>
                <form onSubmit={handleSaveUser} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nome Completo</label>
                            <input required className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={editingUser.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Email (Login)</label>
                            <input 
                                required 
                                type="email"
                                disabled={!!editingUser.id}
                                className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100 disabled:text-gray-500" 
                                value={editingUser.email || editingUser.username || ''} 
                                onChange={e => setEditingUser({...editingUser, email: e.target.value, username: e.target.value})} 
                            />
                        </div>
                        {!editingUser.id && (
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Palavra-passe Inicial</label>
                                <input 
                                    type="password" 
                                    required
                                    className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                                    placeholder="Mínimo 6 caracteres"
                                    value={editingUser.password || ''} 
                                    onChange={e => setEditingUser({...editingUser, password: e.target.value})} 
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cargo / Permissões</label>
                            <select className="w-full border rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}>
                                <option value="TECNICO">Técnico (Agenda, Materiais)</option>
                                <option value="FINANCEIRO">Financeiro (Tesouraria, Faturas)</option>
                                <option value="GESTOR">Gestor (Acesso Total)</option>
                                <option value="ADMIN">Administrador (Configurações)</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-xl w-full hover:bg-gray-50 transition-colors">
                                <input type="checkbox" className="w-5 h-5 text-green-600 rounded focus:ring-green-500" checked={editingUser.active ?? true} onChange={e => setEditingUser({...editingUser, active: e.target.checked})} />
                                <span className="text-sm font-bold text-gray-700">Utilizador Ativo</span>
                            </label>
                        </div>
                    </div>
                    
                    {editingUser.id && (
                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs text-yellow-800">
                            <strong>Nota:</strong> Não é possível alterar email ou palavra-passe aqui. O utilizador deve usar a opção "Recuperar Senha" no login.
                        </div>
                    )}

                    <div className="pt-6 border-t flex justify-end gap-3">
                        <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancelar</button>
                        <button type="submit" disabled={isLoading} className="px-8 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-green-700 flex items-center gap-2">
                            {isLoading ? 'A Processar...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
