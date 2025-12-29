
import React, { useState, useEffect } from 'react';
import { Client, ClientInteraction, EntityType } from '../types';
import { Building2, Phone, Mail, MapPin, History, User, Plus, Search, Home, Upload, CheckCircle2, XCircle, FileText, Briefcase, Truck } from 'lucide-react';
import Modal from './Modal';
import { ClientFormModal } from '../clients/components/ClientFormModal';
import { ClientImportModal } from '../clients/components/ClientImportModal';
import { useClientImport } from '../clients/hooks/useClientImport';

interface EntitiesModuleProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}

export const EntitiesModule: React.FC<EntitiesModuleProps> = ({ clients, setClients }) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Entity Type Filter
  const [activeType, setActiveType] = useState<EntityType | 'Todos'>('Todos');

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const importHook = useClientImport(clients, setClients);
  const [newInteraction, setNewInteraction] = useState<Partial<ClientInteraction>>({ type: 'Telefone', date: new Date().toISOString().split('T')[0] });

  // Auto select first client if none selected and list is available
  useEffect(() => {
      if (!selectedClient && clients.length > 0) {
          // Optional: setSelectedClient(clients[0]);
      }
  }, [clients]);

  const handleSaveClient = (clientData: Partial<Client>) => {
    if (editingClient) {
        setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...clientData } as Client : c));
        if (selectedClient?.id === editingClient.id) setSelectedClient({ ...editingClient, ...clientData } as Client);
    } else {
        const newClient: Client = {
            ...clientData as Client,
            id: Date.now(),
            history: [],
            company: clientData.company || clientData.name || 'Nova Entidade',
            entityType: clientData.entityType || 'Cliente' // Default
        };
        setClients(prev => [newClient, ...prev]);
        setSelectedClient(newClient);
    }
    setIsClientModalOpen(false);
    setEditingClient(null);
  };

  const handleEditClient = (client: Client) => { setEditingClient(client); setIsClientModalOpen(true); };
  const handleNewClient = () => { setEditingClient(null); setIsClientModalOpen(true); };

  const filteredClients = clients.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.nif?.includes(searchTerm);
      const matchType = activeType === 'Todos' ? true : (c.entityType || 'Cliente') === activeType || c.entityType === 'Ambos';
      return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Gestão de Entidades</h2>
           <p className="text-gray-500 text-sm">Clientes, Fornecedores e Parceiros</p>
        </div>
        
        {/* TABS DE TIPO */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setActiveType('Todos')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${activeType==='Todos' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Todos</button>
            <button onClick={() => setActiveType('Cliente')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${activeType==='Cliente' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Clientes</button>
            <button onClick={() => setActiveType('Fornecedor')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${activeType==='Fornecedor' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>Fornecedores</button>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <input type="text" placeholder="Pesquisar..." className="pl-8 pr-3 py-2 border border-gray-300 rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-green-500 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <Search size={14} className="absolute left-2.5 top-3 text-gray-400" />
             </div>
             
             {/* BOTÃO IMPORTAR RESTAURADO */}
             <button 
                onClick={importHook.openModal}
                className="bg-white text-gray-700 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-wider"
            >
                <Upload size={16} /> Importar
            </button>

             <button onClick={handleNewClient} className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center gap-2 whitespace-nowrap font-bold"><Plus size={18} /> Nova Entidade</button>
        </div>
      </div>

      {/* EMPTY STATE - RESTAURADO */}
      {clients.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-200 text-center flex flex-col items-center animate-fade-in-up">
              <div className="bg-gray-100 p-6 rounded-full mb-6">
                  <User size={48} className="text-gray-400"/>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Sem entidades registadas</h3>
              <p className="text-gray-500 mb-8 max-w-md">Comece por adicionar a sua base de clientes e fornecedores manualmente ou importe um ficheiro Excel existente.</p>
              <div className="flex gap-4">
                  <button onClick={importHook.openModal} className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors flex items-center gap-2">
                      <Upload size={18}/> Importar Excel
                  </button>
                  <button onClick={handleNewClient} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg flex items-center gap-2">
                      <Plus size={18}/> Criar Entidade
                  </button>
              </div>
          </div>
      ) : (
      /* VIEW DIVIDIDA FIXA */
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)]">
        {/* List */}
        <div className="lg:w-1/3 transition-all duration-300 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
             <div className="overflow-y-auto flex-1">
                 <table className="min-w-full text-sm">
                     <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                         <tr>
                             <th className="px-4 py-3 text-left font-black text-gray-400 uppercase text-[10px]">Entidade</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                         {filteredClients.map(client => (
                             <tr key={client.id} onClick={() => setSelectedClient(client)} className={`cursor-pointer transition-colors group ${selectedClient?.id === client.id ? 'bg-green-50 border-l-4 border-green-500' : 'hover:bg-gray-50'}`}>
                                 <td className="px-4 py-3">
                                     <div className="flex justify-between items-start">
                                         <div>
                                            <div className="font-bold text-gray-800">{client.company}</div>
                                            <div className="text-xs text-gray-500">{client.name !== client.company ? client.name : client.nif}</div>
                                         </div>
                                         {client.entityType === 'Fornecedor' ? <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase">Forn.</span> : <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">Cli.</span>}
                                     </div>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
                 {filteredClients.length === 0 && <div className="p-8 text-center text-gray-400 text-xs">Nenhuma entidade encontrada.</div>}
             </div>
        </div>

        {/* Details Panel */}
        <div className="lg:w-2/3 bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col animate-fade-in-up overflow-hidden">
            {selectedClient ? (
                <>
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-4">
                                <div className={`p-3 rounded-2xl h-14 w-14 flex items-center justify-center shadow-sm ${selectedClient.entityType === 'Fornecedor' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {selectedClient.entityType === 'Fornecedor' ? <Truck size={28}/> : <Briefcase size={28}/>}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-800 leading-none mb-1">{selectedClient.company}</h2>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <span className="font-bold">{selectedClient.entityType || 'Cliente'}</span>
                                        <span>•</span>
                                        <span>NIF: {selectedClient.nif || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => handleEditClient(selectedClient)} className="text-blue-600 font-bold text-sm bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100">Editar</button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-400 text-xs uppercase">Contactos</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2"><Phone size={16} className="text-gray-400"/> <span>{selectedClient.phone || '-'}</span></div>
                                    <div className="flex items-center gap-2"><Mail size={16} className="text-gray-400"/> <span>{selectedClient.email || '-'}</span></div>
                                    <div className="flex items-center gap-2"><MapPin size={16} className="text-gray-400"/> <span>{selectedClient.address || '-'}</span></div>
                                </div>
                            </div>
                            {/* ... History would go here ... */}
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <User size={48} className="opacity-20 mb-4"/>
                    <p className="text-sm font-medium">Selecione uma entidade para ver detalhes</p>
                </div>
            )}
        </div>
      </div>
      )}

      <ClientFormModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} client={editingClient} onSave={handleSaveClient} />
      
      {/* MODAL DE IMPORTAÇÃO RESTAURADA */}
      <ClientImportModal
            isOpen={importHook.isModalOpen}
            onClose={() => importHook.setIsModalOpen(false)}
            isLoading={importHook.isLoading}
            result={importHook.result}
            onConfirm={importHook.confirmImport}
            onFileSelect={importHook.handleFileSelect}
            fileInputRef={importHook.fileInputRef}
      />
    </div>
  );
};
