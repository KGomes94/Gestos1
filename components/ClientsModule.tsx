

import React, { useState } from 'react';
import { Client, ClientInteraction } from '../types';
import { Building2, Phone, Mail, MapPin, History, User, Plus, Search, Home, Upload, CheckCircle2, XCircle, FileText } from 'lucide-react';
import Modal from './Modal';
import { ClientFormModal } from '../clients/components/ClientFormModal';
import { ClientImportModal } from '../clients/components/ClientImportModal';
import { useClientImport } from '../clients/hooks/useClientImport';

interface ClientsModuleProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}

const ClientsModule: React.FC<ClientsModuleProps> = ({ clients, setClients }) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create/Edit State
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Import Hook
  const importHook = useClientImport(clients, setClients);

  // Interaction Form State
  const [newInteraction, setNewInteraction] = useState<Partial<ClientInteraction>>({ type: 'Telefone', date: new Date().toISOString().split('T')[0] });

  const handleSaveClient = (clientData: Partial<Client>) => {
    if (editingClient) {
        // Update Logic
        setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...clientData } as Client : c));
        if (selectedClient?.id === editingClient.id) {
            setSelectedClient({ ...editingClient, ...clientData } as Client);
        }
    } else {
        // Create Logic
        const newClient: Client = {
            ...clientData as Client,
            id: Date.now(),
            history: [],
            // Garantir que company está preenchido
            company: clientData.company || clientData.name || 'Cliente'
        };
        setClients(prev => [newClient, ...prev]);
        setSelectedClient(newClient);
    }
    setIsClientModalOpen(false);
    setEditingClient(null);
  };

  const handleEditClient = (client: Client) => {
      setEditingClient(client);
      setIsClientModalOpen(true);
  };

  const handleNewClient = () => {
      setEditingClient(null);
      setIsClientModalOpen(true);
  };

  const handleSaveInteraction = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedClient) return;

      const interaction: ClientInteraction = {
          id: Date.now(),
          date: newInteraction.date || new Date().toISOString(),
          type: newInteraction.type as any,
          notes: newInteraction.notes || ''
      };

      const updatedClient = {
          ...selectedClient,
          history: [interaction, ...selectedClient.history]
      };

      setClients(clients.map(c => c.id === selectedClient.id ? updatedClient : c));
      setSelectedClient(updatedClient);
      setIsInteractionModalOpen(false);
      setNewInteraction({ type: 'Telefone', date: new Date().toISOString().split('T')[0] });
  };

  const filteredClients = clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.nif?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Gestão de Clientes</h2>
           <p className="text-gray-500 text-sm">Base de dados de clientes e histórico</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <input 
                    type="text" 
                    placeholder="Pesquisar nome, NIF ou telefone..." 
                    className="pl-8 pr-3 py-2 border border-gray-300 rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-green-500 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search size={14} className="absolute left-2.5 top-3 text-gray-400" />
             </div>
             <button 
                onClick={importHook.openModal}
                className="bg-white text-gray-700 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-wider"
            >
                <Upload size={16} /> Importar
            </button>
             <button 
                onClick={handleNewClient}
                className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center gap-2 whitespace-nowrap font-bold"
            >
                <Plus size={18} />
                Novo Cliente
            </button>
        </div>
      </div>

      {clients.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-200 text-center flex flex-col items-center">
              <div className="bg-gray-100 p-6 rounded-full mb-6">
                  <User size={48} className="text-gray-400"/>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Sem clientes registados</h3>
              <p className="text-gray-500 mb-8 max-w-md">Comece por adicionar a sua base de clientes manualmente ou importe um ficheiro Excel existente.</p>
              <div className="flex gap-4">
                  <button onClick={importHook.openModal} className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors">Importar Excel</button>
                  <button onClick={handleNewClient} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg">Criar Cliente</button>
              </div>
          </div>
      ) : (
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)]">
        {/* Client List Table */}
        <div className={`transition-all duration-300 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${selectedClient ? 'lg:w-1/3' : 'lg:w-full'}`}>
             <div className="overflow-y-auto flex-1">
                 <table className="min-w-full text-sm">
                     <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                         <tr>
                             <th className="px-4 py-3 text-left font-black text-gray-400 uppercase text-[10px]">Cliente / Empresa</th>
                             {!selectedClient && (
                                 <>
                                    <th className="px-4 py-3 text-left font-black text-gray-400 uppercase text-[10px]">Tipo</th>
                                    <th className="px-4 py-3 text-left font-black text-gray-400 uppercase text-[10px]">Contacto</th>
                                    <th className="px-4 py-3 text-left font-black text-gray-400 uppercase text-[10px]">Morada</th>
                                 </>
                             )}
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                         {filteredClients.map(client => (
                             <tr 
                                key={client.id} 
                                onClick={() => setSelectedClient(client)}
                                className={`cursor-pointer transition-colors group ${selectedClient?.id === client.id ? 'bg-green-50 border-l-4 border-green-500' : 'hover:bg-gray-50'}`}
                             >
                                 <td className="px-4 py-3">
                                     <div className="font-bold text-gray-800 flex items-center gap-2">
                                         {client.company}
                                         {client.active === false && <span title="Inativo"><XCircle size={12} className="text-red-400"/></span>}
                                     </div>
                                     {client.type === 'Empresarial' && client.name !== client.company && (
                                         <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><User size={10}/> {client.name}</div>
                                     )}
                                 </td>
                                 {!selectedClient && (
                                     <>
                                        <td className="px-4 py-3">
                                            <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${client.type === 'Empresarial' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {client.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1 font-medium"><Phone size={12}/> {client.phone}</div>
                                                <div className="flex items-center gap-1 text-[10px] text-gray-400"><Mail size={10}/> {client.email}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 truncate max-w-[150px] text-xs">{client.address}</td>
                                     </>
                                 )}
                             </tr>
                         ))}
                     </tbody>
                 </table>
                 {filteredClients.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">Nenhum cliente encontrado.</div>}
             </div>
        </div>

        {/* Client Details Panel */}
        {selectedClient && (
            <div className="lg:w-2/3 bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col animate-fade-in-up overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className={`p-3 rounded-2xl h-14 w-14 flex items-center justify-center shadow-sm ${selectedClient.type === 'Empresarial' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                {selectedClient.type === 'Empresarial' ? <Building2 size={28}/> : <Home size={28}/>}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-800 leading-none mb-1">{selectedClient.company}</h2>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${selectedClient.type === 'Empresarial' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{selectedClient.type}</span>
                                    {selectedClient.nif && <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 rounded">NIF: {selectedClient.nif}</span>}
                                    {selectedClient.active === false && <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase bg-red-100 text-red-600">Inativo</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEditClient(selectedClient)} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors">Editar</button>
                            <button onClick={() => setSelectedClient(null)} className="text-gray-400 hover:text-gray-600 lg:hidden">
                                <XCircle size={24}/>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid md:grid-cols-2 gap-8 h-full">
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><User size={14}/> Dados de Contacto</h3>
                                <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-3 text-gray-700">
                                        <div className="bg-green-50 p-2 rounded-lg text-green-600"><Phone size={18}/></div>
                                        <span className="font-bold">{selectedClient.phone || 'Sem telefone'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-700">
                                        <div className="bg-green-50 p-2 rounded-lg text-green-600"><Mail size={18}/></div>
                                        <span className="truncate">{selectedClient.email || 'Sem email'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-700">
                                        <div className="bg-green-50 p-2 rounded-lg text-green-600"><MapPin size={18}/></div>
                                        <span className="text-sm leading-tight">{selectedClient.address || 'Sem morada'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {selectedClient.notes && (
                                <div>
                                     <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2"><FileText size={14}/> Notas Internas</h3>
                                     <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-sm text-gray-600 italic">
                                         "{selectedClient.notes}"
                                     </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col h-full">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-4">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><History size={14}/> Histórico de Interações</h3>
                                <button onClick={() => setIsInteractionModalOpen(true)} className="text-[10px] font-bold uppercase bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors">Nova Interação</button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                {selectedClient.history.length > 0 ? selectedClient.history.map(item => (
                                    <div key={item.id} className="relative pl-4 border-l-2 border-green-200 pb-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-500">{new Date(item.date).toLocaleDateString('pt-PT')}</span>
                                            <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase font-bold">{item.type}</span>
                                        </div>
                                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">{item.notes}</p>
                                    </div>
                                )) : (
                                    <div className="text-center py-10 text-gray-300 text-sm flex flex-col items-center gap-2">
                                        <History size={32} />
                                        <p>Sem histórico registado.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
      )}

        <ClientFormModal 
            isOpen={isClientModalOpen}
            onClose={() => setIsClientModalOpen(false)}
            client={editingClient}
            onSave={handleSaveClient}
        />

        <ClientImportModal
            isOpen={importHook.isModalOpen}
            onClose={() => importHook.setIsModalOpen(false)}
            isLoading={importHook.isLoading}
            result={importHook.result}
            onConfirm={importHook.confirmImport}
            onFileSelect={importHook.handleFileSelect}
            fileInputRef={importHook.fileInputRef}
        />

        {/* Modal Nova Interação */}
        <Modal isOpen={isInteractionModalOpen} onClose={() => setIsInteractionModalOpen(false)} title="Registar Interação">
             <form onSubmit={handleSaveInteraction} className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Data</label>
                        <input type="date" required className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={newInteraction.date || ''} onChange={e => setNewInteraction({...newInteraction, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Tipo</label>
                         <select className="w-full border rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none" value={newInteraction.type} onChange={e => setNewInteraction({...newInteraction, type: e.target.value as any})}>
                            <option>Telefone</option>
                            <option>Email</option>
                            <option>Reunião</option>
                            <option>Outro</option>
                        </select>
                    </div>
                </div>
                 <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Resumo da Interação</label>
                    <textarea required className="w-full border rounded-xl p-3 text-sm h-32 focus:ring-2 focus:ring-green-500 outline-none resize-none" value={newInteraction.notes || ''} onChange={e => setNewInteraction({...newInteraction, notes: e.target.value})} placeholder="Resumo do que foi tratado..." />
                </div>
                 <div className="pt-4 flex justify-end gap-3 border-t">
                    <button type="button" onClick={() => setIsInteractionModalOpen(false)} className="px-6 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50">Cancelar</button>
                    <button type="submit" className="px-8 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-green-700">Guardar</button>
                </div>
             </form>
        </Modal>

    </div>
  );
};

export default ClientsModule;