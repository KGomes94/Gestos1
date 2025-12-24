import React, { useState } from 'react';
import { Employee } from '../types';
import { Mail, Briefcase, User, Users } from 'lucide-react';
import Modal from './Modal';

interface HRModuleProps {
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
}

const HRModule: React.FC<HRModuleProps> = ({ employees, setEmployees }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmp, setNewEmp] = useState<Partial<Employee>>({ status: 'Ativo' });

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      const emp: Employee = {
          id: Date.now(),
          name: newEmp.name || 'Novo Funcionário',
          email: newEmp.email || '',
          role: newEmp.role || '',
          department: newEmp.department || '',
          status: newEmp.status as any
      };
      setEmployees([...employees, emp]);
      setIsModalOpen(false);
      setNewEmp({ status: 'Ativo' });
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Recursos Humanos</h2>
           <p className="text-gray-500 text-sm">Gestão de colaboradores</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors">
            Adicionar Colaborador
        </button>
      </div>

      {employees.length === 0 ? (
          <div className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 text-center">
              <div className="bg-gray-100 p-4 rounded-full inline-block mb-4">
                  <Users size={32} className="text-gray-400"/>
              </div>
              <h3 className="text-lg font-bold text-gray-700">Sem colaboradores registados</h3>
              <p className="text-gray-500 mb-6">Adicione sua equipa para gerir contatos e departamentos.</p>
          </div>
      ) : (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {employees.map(emp => (
              <div key={emp.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                  <div className="bg-gray-50 p-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-200 text-green-800 h-10 w-10 rounded-full flex items-center justify-center font-bold">
                            {emp.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">{emp.name}</h3>
                            <span className="text-xs text-gray-500 uppercase">{emp.department}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${emp.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {emp.status}
                      </span>
                  </div>
                  <div className="p-4 space-y-3">
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                          <Briefcase size={16} className="text-gray-400" />
                          <span>{emp.role}</span>
                      </div>
                       <div className="flex items-center gap-3 text-sm text-gray-600">
                          <Mail size={16} className="text-gray-400" />
                          <span className="truncate">{emp.email}</span>
                      </div>
                  </div>
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-right">
                      <button className="text-sm text-green-700 font-medium hover:underline">Ver Perfil</button>
                  </div>
              </div>
          ))}
      </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Adicionar Colaborador">
          <form onSubmit={handleSave} className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                  <input required className="mt-1 block w-full border border-gray-300 rounded p-2" value={newEmp.name || ''} onChange={e => setNewEmp({...newEmp, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Cargo</label>
                      <input required className="mt-1 block w-full border border-gray-300 rounded p-2" value={newEmp.role || ''} onChange={e => setNewEmp({...newEmp, role: e.target.value})} />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Departamento</label>
                      <input required className="mt-1 block w-full border border-gray-300 rounded p-2" value={newEmp.department || ''} onChange={e => setNewEmp({...newEmp, department: e.target.value})} />
                  </div>
              </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input type="email" required className="mt-1 block w-full border border-gray-300 rounded p-2" value={newEmp.email || ''} onChange={e => setNewEmp({...newEmp, email: e.target.value})} />
              </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select className="mt-1 block w-full border border-gray-300 rounded p-2" value={newEmp.status} onChange={e => setNewEmp({...newEmp, status: e.target.value as any})}>
                      <option>Ativo</option>
                      <option>Férias</option>
                      <option>Inativo</option>
                  </select>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded text-gray-700">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Salvar</button>
              </div>
          </form>
      </Modal>
    </div>
  );
};

export default HRModule;