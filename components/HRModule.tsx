
import React, { useState, useMemo } from 'react';
import { Employee } from '../types';
import { Mail, Briefcase, User, Users, Plus, Search, Calendar, CreditCard, FileText, AlertTriangle, CheckCircle2, XCircle, Phone, MapPin, Hash, GraduationCap } from 'lucide-react';
import Modal from './Modal';
import { useNotification } from '../contexts/NotificationContext';

interface HRModuleProps {
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
}

const HRModule: React.FC<HRModuleProps> = ({ employees, setEmployees }) => {
  const { notify } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEmp, setCurrentEmp] = useState<Partial<Employee>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [modalTab, setModalTab] = useState<'personal' | 'contract' | 'financial'>('personal');

  // Inicialização segura
  const openNewEmployee = () => {
      setCurrentEmp({ 
          status: 'Ativo', 
          contractType: 'Sem Termo',
          admissionDate: new Date().toISOString().split('T')[0],
          contractStart: new Date().toISOString().split('T')[0],
          idDocument: { type: 'CNI', number: '', validUntil: '' },
          bankInfo: { bankName: '', iban: '', swift: '' }
      });
      setModalTab('personal');
      setIsModalOpen(true);
  };

  const openEditEmployee = (emp: Employee) => {
      setCurrentEmp({ 
          ...emp,
          // Ensure nested objects exist for old records
          idDocument: emp.idDocument || { type: 'CNI', number: '', validUntil: '' },
          bankInfo: emp.bankInfo || { bankName: '', iban: '', swift: '' }
      });
      setModalTab('personal');
      setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!currentEmp.name || !currentEmp.role) {
          notify('error', 'Nome e Cargo são obrigatórios.');
          return;
      }

      const emp: Employee = {
          ...currentEmp as Employee,
          id: currentEmp.id || Date.now(),
          updatedAt: new Date().toISOString()
      };

      if (currentEmp.id) {
          setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
          notify('success', 'Funcionário atualizado com sucesso.');
      } else {
          setEmployees(prev => [...prev, emp]);
          notify('success', 'Novo funcionário registado.');
      }
      setIsModalOpen(false);
  };

  // Helper para verificar validade do contrato
  const getContractStatus = (emp: Employee) => {
      if (emp.contractType === 'Sem Termo') return { label: 'Sem Termo', color: 'text-green-600 bg-green-50' };
      if (!emp.contractEnd) return { label: 'Data Indefinida', color: 'text-gray-500 bg-gray-100' };

      const today = new Date();
      const end = new Date(emp.contractEnd);
      const diffTime = end.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return { label: 'Expirado', color: 'text-red-600 bg-red-50' };
      if (diffDays <= 30) return { label: `Renovar em ${diffDays} dias`, color: 'text-orange-600 bg-orange-50' };
      
      return { label: `Termina em ${new Date(emp.contractEnd).toLocaleDateString('pt-PT')}`, color: 'text-blue-600 bg-blue-50' };
  };

  const filteredEmployees = useMemo(() => {
      return employees.filter(e => 
          e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          e.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [employees, searchTerm]);

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-140px)]">
       <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Users className="text-green-600"/> Gestão de Recursos Humanos</h2>
           <p className="text-gray-500 text-sm">Contratos, processamento salarial e dados dos colaboradores</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <input 
                    type="text" 
                    placeholder="Pesquisar funcionário..." 
                    className="pl-9 pr-3 py-2 border rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            </div>
            <button onClick={openNewEmployee} className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2 font-bold shadow-lg shadow-green-100 text-sm uppercase tracking-wide">
                <Plus size={18} /> Novo
            </button>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="flex-1 overflow-auto">
              <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 sticky top-0 z-10 border-b">
                      <tr>
                          <th className="px-6 py-4 text-left">Colaborador</th>
                          <th className="px-6 py-4 text-left">Cargo / Dep.</th>
                          <th className="px-6 py-4 text-left">Contrato</th>
                          <th className="px-6 py-4 text-right">Salário</th>
                          <th className="px-6 py-4 text-center">Estado</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {filteredEmployees.map(emp => {
                          const contractStatus = getContractStatus(emp);
                          return (
                              <tr key={emp.id} className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => openEditEmployee(emp)}>
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm shrink-0">
                                              {emp.name.charAt(0)}
                                          </div>
                                          <div>
                                              <div className="font-bold text-gray-800">{emp.name}</div>
                                              <div className="text-xs text-gray-500 flex items-center gap-1"><Mail size={10}/> {emp.email}</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="font-medium text-gray-700">{emp.role}</div>
                                      <div className="text-xs text-gray-400 uppercase tracking-wider">{emp.department}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className={`text-xs px-2 py-1 rounded-lg w-fit font-bold flex items-center gap-1 ${contractStatus.color}`}>
                                          {contractStatus.label.includes('Expirado') || contractStatus.label.includes('Renovar') ? <AlertTriangle size={12}/> : <FileText size={12}/>}
                                          {contractStatus.label}
                                      </div>
                                      <div className="text-[9px] text-gray-400 mt-1 pl-1">Início: {new Date(emp.admissionDate || emp.contractStart).toLocaleDateString('pt-PT')}</div>
                                  </td>
                                  <td className="px-6 py-4 text-right font-mono font-bold text-gray-600">
                                      {emp.monthlySalary ? `${emp.monthlySalary.toLocaleString()} CVE` : '-'}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                          emp.status === 'Ativo' ? 'bg-green-100 text-green-800' : 
                                          emp.status === 'Férias' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                          {emp.status}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      <button className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors">
                                          Editar
                                      </button>
                                  </td>
                              </tr>
                          );
                      })}
                      {filteredEmployees.length === 0 && (
                          <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">
                                  Nenhum colaborador encontrado.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentEmp.id ? `Ficha de Colaborador: ${currentEmp.name}` : "Adicionar Novo Colaborador"}>
          <form onSubmit={handleSave} className="flex flex-col h-[75vh]">
              {/* Tabs */}
              <div className="flex border-b mb-6 bg-gray-50 rounded-t-lg shrink-0 overflow-x-auto">
                  <button type="button" onClick={() => setModalTab('personal')} className={`px-6 py-3 text-xs font-black uppercase border-b-2 transition-all flex items-center gap-2 ${modalTab === 'personal' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-400'}`}>
                      <User size={16}/> Dados Pessoais
                  </button>
                  <button type="button" onClick={() => setModalTab('contract')} className={`px-6 py-3 text-xs font-black uppercase border-b-2 transition-all flex items-center gap-2 ${modalTab === 'contract' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-400'}`}>
                      <Briefcase size={16}/> Contrato & Cargo
                  </button>
                  <button type="button" onClick={() => setModalTab('financial')} className={`px-6 py-3 text-xs font-black uppercase border-b-2 transition-all flex items-center gap-2 ${modalTab === 'financial' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-400'}`}>
                      <CreditCard size={16}/> Processamento Salarial
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                  {/* TAB: PERSONAL */}
                  {modalTab === 'personal' && (
                      <div className="space-y-6 animate-fade-in-up">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="md:col-span-2">
                                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Nome Completo <span className="text-red-500">*</span></label>
                                  <input required className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={currentEmp.name || ''} onChange={e => setCurrentEmp({...currentEmp, name: e.target.value})} />
                              </div>
                              <div>
                                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Email <span className="text-red-500">*</span></label>
                                  <div className="relative">
                                      <Mail size={16} className="absolute left-3 top-3.5 text-gray-400"/>
                                      <input type="email" required className="w-full border rounded-xl pl-10 p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={currentEmp.email || ''} onChange={e => setCurrentEmp({...currentEmp, email: e.target.value})} />
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Telefone</label>
                                  <div className="relative">
                                      <Phone size={16} className="absolute left-3 top-3.5 text-gray-400"/>
                                      <input type="tel" className="w-full border rounded-xl pl-10 p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={currentEmp.phone || ''} onChange={e => setCurrentEmp({...currentEmp, phone: e.target.value})} />
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">NIF</label>
                                  <input className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={currentEmp.nif || ''} onChange={e => setCurrentEmp({...currentEmp, nif: e.target.value})} placeholder="999999999" />
                              </div>
                              <div>
                                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Data Nascimento</label>
                                  <input type="date" className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={currentEmp.birthDate || ''} onChange={e => setCurrentEmp({...currentEmp, birthDate: e.target.value})} />
                              </div>
                              <div className="md:col-span-2">
                                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Morada Completa</label>
                                  <input className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={currentEmp.address || ''} onChange={e => setCurrentEmp({...currentEmp, address: e.target.value})} placeholder="Rua, Número, Zona, Cidade" />
                              </div>
                          </div>

                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                              <h4 className="text-xs font-bold text-gray-600 mb-3 uppercase flex items-center gap-2"><FileText size={14}/> Documento de Identificação</h4>
                              <div className="grid grid-cols-3 gap-4">
                                  <div>
                                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Tipo</label>
                                      <select className="w-full border rounded-lg p-2 text-sm bg-white" value={currentEmp.idDocument?.type} onChange={e => setCurrentEmp({...currentEmp, idDocument: { ...currentEmp.idDocument!, type: e.target.value as any }})}>
                                          <option>CNI</option><option>Passaporte</option><option>Residência</option>
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Número</label>
                                      <input className="w-full border rounded-lg p-2 text-sm" value={currentEmp.idDocument?.number || ''} onChange={e => setCurrentEmp({...currentEmp, idDocument: { ...currentEmp.idDocument!, number: e.target.value }})} />
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Validade</label>
                                      <input type="date" className="w-full border rounded-lg p-2 text-sm" value={currentEmp.idDocument?.validUntil || ''} onChange={e => setCurrentEmp({...currentEmp, idDocument: { ...currentEmp.idDocument!, validUntil: e.target.value }})} />
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* TAB: CONTRACT */}
                  {modalTab === 'contract' && (
                      <div className="space-y-6 animate-fade-in-up">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Cargo <span className="text-red-500">*</span></label>
                                  <input required className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={currentEmp.role || ''} onChange={e => setCurrentEmp({...currentEmp, role: e.target.value})} placeholder="Ex: Técnico Sénior" />
                              </div>
                              <div>
                                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Departamento <span className="text-red-500">*</span></label>
                                  <input required className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={currentEmp.department || ''} onChange={e => setCurrentEmp({...currentEmp, department: e.target.value})} placeholder="Ex: Operações" />
                              </div>
                              <div>
                                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Estado Atual</label>
                                  <select className="w-full border rounded-xl p-3 text-sm bg-white" value={currentEmp.status} onChange={e => setCurrentEmp({...currentEmp, status: e.target.value as any})}>
                                      <option>Ativo</option><option>Férias</option><option>Licença</option><option>Inativo</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Data de Admissão</label>
                                  <input type="date" className="w-full border rounded-xl p-3 text-sm" value={currentEmp.admissionDate || ''} onChange={e => setCurrentEmp({...currentEmp, admissionDate: e.target.value})} />
                              </div>
                          </div>

                          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                              <h4 className="text-xs font-bold text-blue-800 mb-3 uppercase flex items-center gap-2"><Briefcase size={14}/> Detalhes do Vínculo</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                      <label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Tipo de Contrato</label>
                                      <select className="w-full border border-blue-200 rounded-lg p-2 text-sm bg-white" value={currentEmp.contractType} onChange={e => setCurrentEmp({...currentEmp, contractType: e.target.value as any})}>
                                          <option>Sem Termo</option><option>Termo Certo</option><option>Prestação Serviços</option><option>Estágio</option>
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Início Contrato</label>
                                      <input type="date" className="w-full border border-blue-200 rounded-lg p-2 text-sm" value={currentEmp.contractStart || ''} onChange={e => setCurrentEmp({...currentEmp, contractStart: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Fim / Renovação</label>
                                      <input type="date" className="w-full border border-blue-200 rounded-lg p-2 text-sm" value={currentEmp.contractEnd || ''} onChange={e => setCurrentEmp({...currentEmp, contractEnd: e.target.value})} />
                                      <p className="text-[9px] text-blue-400 mt-1">Deixar em branco se for efetivo (Sem Termo).</p>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* TAB: FINANCIAL */}
                  {modalTab === 'financial' && (
                      <div className="space-y-6 animate-fade-in-up">
                          <div className="grid grid-cols-2 gap-6">
                              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                                  <label className="block text-xs font-black text-green-800 uppercase mb-2">Salário Base Mensal</label>
                                  <div className="relative">
                                      <input type="number" className="w-full border border-green-200 rounded-lg pl-3 p-2 text-lg font-bold text-green-700 outline-none" value={currentEmp.monthlySalary || ''} onChange={e => setCurrentEmp({...currentEmp, monthlySalary: Number(e.target.value)})} placeholder="0.00" />
                                      <span className="absolute right-3 top-3 text-xs font-bold text-green-600">CVE</span>
                                  </div>
                              </div>
                              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                  <label className="block text-xs font-black text-gray-500 uppercase mb-2">Valor Hora (Extra)</label>
                                  <div className="relative">
                                      <input type="number" className="w-full border rounded-lg pl-3 p-2 text-lg font-bold text-gray-600 outline-none" value={currentEmp.hourlyRate || ''} onChange={e => setCurrentEmp({...currentEmp, hourlyRate: Number(e.target.value)})} placeholder="0.00" />
                                      <span className="absolute right-3 top-3 text-xs font-bold text-gray-400">CVE/h</span>
                                  </div>
                              </div>
                          </div>

                          <div className="border-t pt-4">
                              <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><CreditCard size={16}/> Dados Bancários</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Banco</label>
                                      <input className="w-full border rounded-lg p-2 text-sm" value={currentEmp.bankInfo?.bankName || ''} onChange={e => setCurrentEmp({...currentEmp, bankInfo: { ...currentEmp.bankInfo!, bankName: e.target.value }})} placeholder="Ex: BCA" />
                                  </div>
                                  <div className="md:col-span-2">
                                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">IBAN / NIB</label>
                                      <input className="w-full border rounded-lg p-2 text-sm font-mono tracking-wide" value={currentEmp.bankInfo?.iban || ''} onChange={e => setCurrentEmp({...currentEmp, bankInfo: { ...currentEmp.bankInfo!, iban: e.target.value }})} placeholder="CV..." />
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}
              </div>

              <div className="pt-6 border-t mt-auto flex justify-end gap-3 shrink-0">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50">Cancelar</button>
                  <button type="submit" className="px-8 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-green-700 flex items-center gap-2">
                      <CheckCircle2 size={18}/> Guardar Ficha
                  </button>
              </div>
          </form>
      </Modal>
    </div>
  );
};

export default HRModule;
