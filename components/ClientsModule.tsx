import React, { useState } from 'react';
import { Client, ClientInteraction, ClientType } from '../types';
import { Building2, Phone, Mail, MapPin, History, User, Plus, Search, Home } from 'lucide-react';
import Modal from './Modal';

interface ClientsModuleProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}

const ClientsModule: React.FC<ClientsModuleProps> = ({ clients, setClients }) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Forms State
  const [newClient, setNewClient] = useState<Partial<Client>>({ type: 'Doméstico' });
  const [newInteraction, setNewInteraction] = useState<Partial<ClientInteraction>>({ type: 'Telefone', date: new Date().toISOString().split('T')[0] });

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    const isDomestic = newClient.type === 'Doméstico';
    const clientName = newClient.name || 'Sem Nome';
    const companyName = isDomestic ? clientName : (newClient.company || clientName);
    
    // Validar se já existe? Opcional
    
    const client: Client = {
        id: Date.now(),
        type: newClient.type as ClientType,
        name: clientName,
        company: companyName, 
        email: newClient.email || '',
        phone: newClient.phone || '',
        address: newClient.address || '',
        nif: newClient.nif || '',
        notes: newClient.notes || '',
        history: []
    };
    setClients(prev => [...prev, client]);
    setIsClientModalOpen(false);
    setNewClient({ type: 'Doméstico' });
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
      c.phone.includes(searchTerm)
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
                    placeholder="Pesquisar..." 
                    className="pl-8 pr-3 py-2 border border-gray-300 rounded text-sm w-full outline-none focus:ring-2 focus:ring-green-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search size={14} className="absolute left-2.5 top-3 text-gray-400" />
             </div>
             <button 
                onClick={() => setIsClientModalOpen(true)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
            >
                <Plus size={16} />
                Novo Cliente
            </button>
        </div>
      </div>

      {clients.length === 0 ? (
          <div className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 text-center">
              <div className="bg-gray-100 p-4 rounded-full inline-block mb-4">
                  <User size={32} className="text-gray-400"/>
              </div>
              <h3 className="text-lg font-bold text-gray-700">Sem clientes registados</h3>
              <p className="text-gray-500 mb-6">Adicione clientes para gerir contactos e histórico.</p>
              <button 
                onClick={() => setIsClientModalOpen(true)}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition-colors"
            >
                Adicionar Primeiro Cliente
            </button>
          </div>
      ) : (
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Client List Table (Updated Layout) */}
        <div className={`lg:w-${selectedClient ? '1/3' : 'full'} transition-all duration-300 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col`}>
             <div className="overflow-x-auto">
                 <table className="min-w-full text-sm">
                     <thead className="bg-gray-50">
                         <tr>
                             <th className="px-4 py-3 text-left font-medium text-gray-500">Cliente / Empresa</th>
                             {!selectedClient && (
                                 <>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Tipo</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Contacto</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Morada</th>
                                 </>
                             )}
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                         {filteredClients.map(client => (
                             <tr 
                                key={client.id} 
                                onClick={() => setSelectedClient(client)}
                                className={`cursor-pointer hover:bg-green-50 transition-colors ${selectedClient?.id === client.id ? 'bg-green-50 border-l-4 border-green-500' : ''}`}
                             >
                                 <td className="px-4 py-3">
                                     <div className="font-bold text-gray-800">{client.company}</div>
                                     {client.type === 'Empresarial' && client.name !== client.company && (
                                         <div className="text-xs text-gray-500 flex items-center gap-1"><User size={10}/> {client.name}</div>
                                     )}
                                 </td>
                                 {!selectedClient && (
                                     <>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase ${client.type === 'Empresarial' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {client.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1"><Phone size={12}/> {client.phone}</div>
                                                <div className="flex items-center gap-1 text-xs text-gray-400"><Mail size={12}/> {client.email}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 truncate max-w-[150px]">{client.address}</td>
                                     </>
                                 )}
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
        </div>

        {/* Client Details Panel */}
        {selectedClient && (
            <div className="lg:w-2/3 bg-white rounded-lg shadow-md border border-gray-200 flex flex-col animate-fade-in-up">
                <div className="p-6 border-b border-gray-100 bg-green-50/50">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className={`p-3 rounded-full h-12 w-12 flex items-center justify-center ${selectedClient.type === 'Empresarial' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                {selectedClient.type === 'Empresarial' ? <Building2 size={24}/> : <Home size={24}/>}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 leading-none">{selectedClient.company}</h2>
                                <p className="text-gray-500 text-sm mt-1">{selectedClient.name} • {selectedClient.type}</p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedClient(null)} className="text-gray-400 hover:text-gray-600 lg:hidden">
                            Fechar
                        </button>
                    </div>
                </div>

                <div className="p-6 grid md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Informações Principais</h3>
                            <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-3 text-gray-700">
                                    <Phone size={18} className="text-green-600" />
                                    <span className="font-medium">{selectedClient.phone || 'Sem telefone'}</span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-700">
                                    <MapPin size={18} className="text-green-600" />
                                    <span className="font-medium">{selectedClient.address || 'Sem morada'}</span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-600">
                                    <Mail size={18} className="text-gray-400" />
                                    <span>{selectedClient.email || 'Sem email'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Dados Adicionais</h3>
                             <div className="space-y-2 text-sm text-gray-600 px-1">
                                 <div><span className="font-semibold">NIF:</span> {selectedClient.nif || '-'}</div>
                                 <div className="mt-2 pt-2 border-t border-gray-100">
                                     <span className="font-semibold block mb-1">Notas:</span>
                                     <p className="italic text-gray-500">{selectedClient.notes || "Sem notas registadas."}</p>
                                 </div>
                             </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Histórico de Interações</h3>
                            <button onClick={() => setIsInteractionModalOpen(true)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 border border-green-200">Adicionar</button>
                        </div>
                        
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {selectedClient.history.length > 0 ? selectedClient.history.map(item => (
                                <div key={item.id} className="relative pl-4 border-l-2 border-green-200 pb-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-gray-600">{new Date(item.date).toLocaleDateString('pt-PT')}</span>
                                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase">{item.type}</span>
                                    </div>
                                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{item.notes}</p>
                                </div>
                            )) : (
                                <div className="text-center py-6 text-gray-400 text-sm flex flex-col items-center gap-2">
                                    <History size={24} />
                                    Sem interações registadas.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
      )}

        {/* Modal Novo Cliente (Updated Form) */}
        <Modal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Adicionar Novo Cliente">
            <form onSubmit={handleSaveClient} className="space-y-5">
                {/* Type Selector */}
                <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Cliente</label>
                     <div className="flex gap-4">
                         <label className={`flex-1 border rounded p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors ${newClient.type === 'Doméstico' ? 'bg-orange-50 border-orange-300 text-orange-800 ring-1 ring-orange-300' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                             <input type="radio" name="clientType" className="hidden" checked={newClient.type === 'Doméstico'} onChange={() => setNewClient({...newClient, type: 'Doméstico'})} />
                             <Home size={18}/> Doméstico
                         </label>
                         <label className={`flex-1 border rounded p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors ${newClient.type === 'Empresarial' ? 'bg-blue-50 border-blue-300 text-blue-800 ring-1 ring-blue-300' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                             <input type="radio" name="clientType" className="hidden" checked={newClient.type === 'Empresarial'} onChange={() => setNewClient({...newClient, type: 'Empresarial'})} />
                             <Building2 size={18}/> Empresarial
                         </label>
                     </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {newClient.type === 'Empresarial' && (
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Nome da Empresa</label>
                            <input required className="mt-1 block w-full border border-gray-300 rounded p-2" value={newClient.company || ''} onChange={e => setNewClient({...newClient, company: e.target.value})} placeholder="Ex: TecnoLda" />
                        </div>
                    )}
                    <div className={newClient.type === 'Doméstico' ? "md:col-span-2" : ""}>
                        <label className="block text-sm font-medium text-gray-700">{newClient.type === 'Empresarial' ? 'Pessoa de Contacto' : 'Nome Completo'}</label>
                        <input required className="mt-1 block w-full border border-gray-300 rounded p-2" value={newClient.name || ''} onChange={e => setNewClient({...newClient, name: e.target.value})} />
                    </div>
                </div>

                 <div className="bg-gray-50 p-4 rounded border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Telefone <span className="text-red-500">*</span></label>
                        <input required className="mt-1 block w-full border border-gray-300 rounded p-2 bg-white" value={newClient.phone || ''} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Morada / Zona <span className="text-red-500">*</span></label>
                        <input required className="mt-1 block w-full border border-gray-300 rounded p-2 bg-white" value={newClient.address || ''} onChange={e => setNewClient({...newClient, address: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                         <label className="block text-sm font-medium text-gray-700">Email</label>
                         <input type="email" className="mt-1 block w-full border border-gray-300 rounded p-2 bg-white" value={newClient.email || ''} onChange={e => setNewClient({...newClient, email: e.target.value})} />
                    </div>
                </div>

                 <div className="border-t pt-4">
                    <button type="button" className="text-sm text-green-600 font-medium mb-2 flex items-center gap-1 hover:underline" onClick={(e) => {
                        const target = document.getElementById('optionalFields');
                        if(target) target.classList.toggle('hidden');
                    }}>+ Mostrar Campos Opcionais</button>
                    
                    <div id="optionalFields" className="hidden space-y-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700">NIF (Contribuinte)</label>
                            <input className="mt-1 block w-full border border-gray-300 rounded p-2" value={newClient.nif || ''} onChange={e => setNewClient({...newClient, nif: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Notas</label>
                            <textarea className="mt-1 block w-full border border-gray-300 rounded p-2" value={newClient.notes || ''} onChange={e => setNewClient({...newClient, notes: e.target.value})} />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                    <button type="button" onClick={() => setIsClientModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded text-gray-700">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Salvar Cliente</button>
                </div>
            </form>
        </Modal>

        {/* Modal Nova Interação */}
        <Modal isOpen={isInteractionModalOpen} onClose={() => setIsInteractionModalOpen(false)} title="Registar Interação">
             <form onSubmit={handleSaveInteraction} className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Data</label>
                        <input type="date" required className="mt-1 block w-full border border-gray-300 rounded p-2" value={newInteraction.date || ''} onChange={e => setNewInteraction({...newInteraction, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tipo</label>
                         <select className="mt-1 block w-full border border-gray-300 rounded p-2" value={newInteraction.type} onChange={e => setNewInteraction({...newInteraction, type: e.target.value as any})}>
                            <option>Telefone</option>
                            <option>Email</option>
                            <option>Reunião</option>
                            <option>Outro</option>
                        </select>
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Notas da Interação</label>
                    <textarea required className="mt-1 block w-full border border-gray-300 rounded p-2 h-24" value={newInteraction.notes || ''} onChange={e => setNewInteraction({...newInteraction, notes: e.target.value})} placeholder="Resumo do que foi tratado..." />
                </div>
                 <div className="pt-4 flex justify-end gap-2">
                    <button type="button" onClick={() => setIsInteractionModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded text-gray-700">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Salvar</button>
                </div>
             </form>
        </Modal>

    </div>
  );
};

export default ClientsModule;