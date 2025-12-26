

import React, { useState, useEffect } from 'react';
import { DocumentTemplate, GeneratedDocument, Client, Employee, DocumentCategory, SystemSettings } from '../types';
import { FileText, Plus, Search, Trash2, Printer, Eye, ScrollText, FilePlus } from 'lucide-react';
import Modal from './Modal';
import { useNotification } from '../contexts/NotificationContext';
import { db } from '../services/db';

const DocumentModule: React.FC = () => {
  const { notify } = useNotification();
  
  const [templates, setTemplates] = useState<DocumentTemplate[]>(() => db.templates.getAll());
  const [documents, setDocuments] = useState<GeneratedDocument[]>(() => db.documents.getAll());
  const [clients, setClients] = useState<Client[]>([]);
  const [employees] = useState<Employee[]>(() => db.employees.getAll());
  const [settings] = useState<SystemSettings>(() => db.settings.get());

  useEffect(() => {
      const loadClients = async () => {
          const data = await db.clients.getAll();
          setClients(data);
      };
      loadClients();
  }, []);

  useEffect(() => { db.templates.save(templates); }, [templates]);
  useEffect(() => { db.documents.save(documents); }, [documents]);

  const [view, setView] = useState<'archive' | 'templates'>('archive');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'template' | 'generate' | 'view'>('template');
  
  const [activeTemp, setActiveTemp] = useState<Partial<DocumentTemplate>>({ category: 'Contrato de Serviço', content: '' });
  const [activeGen, setActiveGen] = useState<Partial<GeneratedDocument>>({ status: 'Emitido', date: new Date().toISOString().split('T')[0] });
  const [viewDoc, setViewDoc] = useState<GeneratedDocument | null>(null);

  const categories: DocumentCategory[] = ['Contrato de Trabalho', 'Contrato de Serviço', 'Certificado de Garantia', 'Acordo de Confidencialidade', 'Outro'];

  const processTemplate = (content: string, target: Client | Employee) => {
      let processed = content;
      const placeholders: Record<string, string> = {
          '{{NOME}}': (target as Client).company || target.name || '',
          '{{NIF}}': (target as Client).nif || (target as Employee).nif || '',
          '{{MORADA}}': (target as Client).address || '',
          '{{EMAIL}}': target.email || '',
          '{{DATA}}': new Date().toLocaleDateString('pt-PT'),
          '{{EMPRESA_NOME}}': settings.companyName,
          '{{EMPRESA_NIF}}': settings.companyNif
      };
      Object.entries(placeholders).forEach(([key, val]) => {
          processed = processed.replace(new RegExp(key, 'g'), val);
      });
      return processed;
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
      e.preventDefault();
      const data = { ...activeTemp, id: activeTemp.id || `T-${Date.now()}` } as DocumentTemplate;
      const updated = activeTemp.id ? templates.map(t => t.id === data.id ? data : t) : [data, ...templates];
      setTemplates(updated);
      setIsModalOpen(false);
      notify('success', 'Template guardado.');
  };

  const handleGenerate = (e: React.FormEvent) => {
      e.preventDefault();
      const template = templates.find(t => t.id === activeGen.templateId);
      if (!template) return;

      const targetIdNum = Number(activeGen.targetId);
      const target = template.category === 'Contrato de Trabalho' ? employees.find(emp => emp.id === targetIdNum) : clients.find(cl => cl.id === targetIdNum);

      if (!target) return notify('error', 'Selecione o destinatário.');

      const processed = processTemplate(template.content, target);
      const newDoc: GeneratedDocument = {
          id: `DOC-${Date.now()}`,
          name: `${template.name} - ${target.name || (target as Client).company}`,
          templateId: template.id,
          category: template.category,
          targetId: target.id,
          targetName: (target as Client).company || target.name,
          date: activeGen.date || new Date().toISOString().split('T')[0],
          content: processed,
          status: 'Emitido'
      };

      setDocuments(prev => [newDoc, ...prev]);
      setIsModalOpen(false);
      notify('success', 'Documento arquivado.');
  };

  const handlePrint = (doc: GeneratedDocument) => {
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`<html><head><title>${doc.name}</title></head><body>${doc.content}</body></html>`);
      win.document.close();
      win.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-bold text-gray-800">GestDoc</h2><p className="text-gray-500 text-sm">Contratos e Certificados Dinâmicos</p></div>
        <div className="flex bg-gray-100 p-1 rounded-lg border">
          <button onClick={() => setView('archive')} className={`px-4 py-2 rounded-md text-sm font-medium ${view === 'archive' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600'}`}><FileText size={16} className="inline mr-1"/> Arquivo</button>
          <button onClick={() => setView('templates')} className={`px-4 py-2 rounded-md text-sm font-medium ${view === 'templates' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600'}`}><ScrollText size={16} className="inline mr-1"/> Templates</button>
        </div>
      </div>

      {view === 'archive' ? (
        <div className="bg-white rounded-lg shadow border overflow-hidden animate-fade-in-up">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-700">Documentos Emitidos</h3>
            <button onClick={() => { setModalType('generate'); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm"><FilePlus size={16} /> Gerar Novo</button>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400"><tr><th className="px-6 py-3 text-left">Data</th><th className="px-6 py-3 text-left">Documento</th><th className="px-6 py-3 text-left">Entidade</th><th className="px-6 py-3 text-right">Ações</th></tr></thead>
            <tbody className="divide-y">
              {documents.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{new Date(doc.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-bold">{doc.name}</td>
                  <td className="px-6 py-4">{doc.targetName}</td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button onClick={() => { setViewDoc(doc); setModalType('view'); setIsModalOpen(true); }} className="text-blue-500 hover:text-blue-700"><Eye size={18}/></button>
                    <button onClick={() => handlePrint(doc)} className="text-gray-500 hover:text-gray-800"><Printer size={18}/></button>
                    <button onClick={() => setDocuments(prev=>prev.filter(d=>d.id!==doc.id))} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">Vazio.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
          <div onClick={() => { setModalType('template'); setActiveTemp({ category: 'Contrato de Serviço', content: '' }); setIsModalOpen(true); }} className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400 hover:border-green-500 cursor-pointer bg-white">
            <Plus size={48} className="mb-2"/><span className="font-bold">Novo Template</span>
          </div>
          {templates.map(temp => (
            <div key={temp.id} className="bg-white rounded-xl shadow border p-6 flex flex-col justify-between">
              <div><span className="text-[9px] uppercase font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{temp.category}</span><h3 className="text-lg font-bold text-gray-800 mt-2">{temp.name}</h3></div>
              <div className="mt-8 flex justify-between border-t pt-4"><button onClick={() => { setActiveTemp(temp); setModalType('template'); setIsModalOpen(true); }} className="text-sm font-bold text-green-600">Editar</button><button onClick={() => setTemplates(prev=>prev.filter(t=>t.id!==temp.id))} className="text-red-400"><Trash2 size={18}/></button></div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalType === 'template' ? 'Template' : modalType === 'generate' ? 'Gerar' : 'Visualizar'}>
        {modalType === 'template' && (
          <form onSubmit={handleSaveTemplate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs font-bold text-gray-400 uppercase">Nome</label><input required className="w-full border rounded-lg p-2 text-sm" value={activeTemp.name || ''} onChange={e => setActiveTemp({...activeTemp, name: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-gray-400 uppercase">Categoria</label><select className="w-full border rounded-lg p-2 text-sm" value={activeTemp.category} onChange={e => setActiveTemp({...activeTemp, category: e.target.value as any})}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1">HTML Content</label>
              <div className="text-[9px] text-blue-600 mb-2 font-mono">Placeholders: {'{{NOME}}'}, {'{{NIF}}'}, {'{{MORADA}}'}, {'{{EMPRESA_NOME}}'}</div>
              <textarea required className="w-full border rounded-lg p-2 h-64 font-mono text-sm" value={activeTemp.content} onChange={e => setActiveTemp({...activeTemp, content: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2"><button type="submit" className="px-8 py-2 bg-green-600 text-white rounded-lg text-xs font-black uppercase">Salvar</button></div>
          </form>
        )}
        {modalType === 'generate' && (
          <form onSubmit={handleGenerate} className="space-y-6">
            <div><label className="text-xs font-bold text-gray-400 uppercase">Template</label><select required className="w-full border rounded-lg p-3 text-sm font-bold" value={activeGen.templateId || ''} onChange={e => setActiveGen({...activeGen, templateId: e.target.value})}><option value="">Selecionar...</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className="text-xs font-bold text-gray-400 uppercase">Destinatário</label>
              <select required className="w-full border rounded-lg p-3 text-sm" value={activeGen.targetId || ''} onChange={e => setActiveGen({...activeGen, targetId: e.target.value})}><option value="">Selecionar...</option>{activeGen.templateId && templates.find(t=>t.id===activeGen.templateId)?.category === 'Contrato de Trabalho' ? employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>) : clients.map(cl => <option key={cl.id} value={cl.id}>{cl.company}</option>)}</select>
            </div>
            <div className="flex justify-end pt-6"><button type="submit" className="px-10 py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase">Gerar Agora</button></div>
          </form>
        )}
        {modalType === 'view' && viewDoc && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-8 border rounded-2xl max-h-[500px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: viewDoc.content }} />
            <div className="flex justify-end pt-6 border-t"><button onClick={() => handlePrint(viewDoc)} className="px-6 py-2 bg-green-600 text-white rounded-xl font-black text-xs uppercase"><Printer size={16} className="inline mr-2"/> Imprimir</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DocumentModule;