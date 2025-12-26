
import React, { useState, useEffect } from 'react';
import { Client, ClientType } from '../../types';
import Modal from '../../components/Modal';
import { Building2, User, Phone, Mail, MapPin, FileText, CheckCircle2 } from 'lucide-react';
import { clientValidators } from '../services/clientValidators';

interface ClientFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    onSave: (client: Partial<Client>) => void;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({ isOpen, onClose, client, onSave }) => {
    const [formData, setFormData] = useState<Partial<Client>>({ type: 'Doméstico' });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(client ? { ...client } : { type: 'Doméstico', active: true });
            setErrors({});
        }
    }, [isOpen, client]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Normalização de dados antes de validar
        const normalizedData = { ...formData };
        if (normalizedData.type === 'Doméstico') {
            normalizedData.company = normalizedData.name; // Garante consistência
        }

        const validation = clientValidators.validate(normalizedData);
        
        if (!validation.isValid) {
            setErrors(validation.errors);
            return;
        }

        onSave(normalizedData);
    };

    const handleChange = (field: keyof Client, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Limpar erro específico ao editar
        if (errors[field]) {
            setErrors(prev => {
                const newErrs = { ...prev };
                delete newErrs[field];
                return newErrs;
            });
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={client ? `Editar Cliente: ${client.company}` : "Adicionar Novo Cliente"}>
            <form onSubmit={handleSubmit} className="flex flex-col h-[75vh]">
                <div className="flex-1 overflow-y-auto pr-2 space-y-8">
                    
                    {/* Secção 1: Tipo e Identificação */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-green-700 font-bold border-b border-green-100 pb-2">
                            <User size={18}/> <span>Identificação</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Tipo Toggle */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-gray-400 uppercase mb-2">Tipo de Cliente</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 border rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-all ${formData.type === 'Doméstico' ? 'bg-orange-50 border-orange-300 text-orange-800 ring-2 ring-orange-100' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                                        <input type="radio" className="hidden" checked={formData.type === 'Doméstico'} onChange={() => handleChange('type', 'Doméstico')} />
                                        <User size={18}/> Doméstico
                                    </label>
                                    <label className={`flex-1 border rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-all ${formData.type === 'Empresarial' ? 'bg-blue-50 border-blue-300 text-blue-800 ring-2 ring-blue-100' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                                        <input type="radio" className="hidden" checked={formData.type === 'Empresarial'} onChange={() => handleChange('type', 'Empresarial')} />
                                        <Building2 size={18}/> Empresarial
                                    </label>
                                </div>
                            </div>

                            {/* Campos Dinâmicos */}
                            {formData.type === 'Empresarial' && (
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase mb-1">Nome da Empresa <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className={`w-full border rounded-xl p-3 focus:ring-2 outline-none transition-all ${errors.company ? 'border-red-300 ring-red-100' : 'focus:ring-green-500'}`}
                                        placeholder="Ex: Soluções Lda"
                                        value={formData.company || ''}
                                        onChange={e => handleChange('company', e.target.value)}
                                    />
                                    {errors.company && <p className="text-xs text-red-500 mt-1 font-bold">{errors.company}</p>}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-1">{formData.type === 'Empresarial' ? 'Pessoa de Contacto' : 'Nome Completo'} <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className={`w-full border rounded-xl p-3 focus:ring-2 outline-none transition-all ${errors.name ? 'border-red-300 ring-red-100' : 'focus:ring-green-500'}`}
                                    value={formData.name || ''}
                                    onChange={e => handleChange('name', e.target.value)}
                                />
                                {errors.name && <p className="text-xs text-red-500 mt-1 font-bold">{errors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-1">NIF (Contribuinte) {formData.type==='Empresarial' && <span className="text-red-500">*</span>}</label>
                                <input 
                                    type="text" 
                                    maxLength={9}
                                    className={`w-full border rounded-xl p-3 font-mono focus:ring-2 outline-none transition-all ${errors.nif ? 'border-red-300 ring-red-100' : 'focus:ring-green-500'}`}
                                    placeholder="999999999"
                                    value={formData.nif || ''}
                                    onChange={e => handleChange('nif', e.target.value)}
                                />
                                {errors.nif && <p className="text-xs text-red-500 mt-1 font-bold">{errors.nif}</p>}
                            </div>
                        </div>
                    </section>

                    {/* Secção 2: Contactos e Morada */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-green-700 font-bold border-b border-green-100 pb-2">
                            <MapPin size={18}/> <span>Contactos e Localização</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-1">Email <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-3.5 text-gray-400"/>
                                    <input 
                                        type="email" 
                                        className={`w-full border rounded-xl pl-10 p-3 focus:ring-2 outline-none transition-all ${errors.email ? 'border-red-300 ring-red-100' : 'focus:ring-green-500'}`}
                                        value={formData.email || ''}
                                        onChange={e => handleChange('email', e.target.value)}
                                    />
                                </div>
                                {errors.email && <p className="text-xs text-red-500 mt-1 font-bold">{errors.email}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase mb-1">Telefone <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-3 top-3.5 text-gray-400"/>
                                    <input 
                                        type="tel" 
                                        className={`w-full border rounded-xl pl-10 p-3 focus:ring-2 outline-none transition-all ${errors.phone ? 'border-red-300 ring-red-100' : 'focus:ring-green-500'}`}
                                        value={formData.phone || ''}
                                        onChange={e => handleChange('phone', e.target.value)}
                                    />
                                </div>
                                {errors.phone && <p className="text-xs text-red-500 mt-1 font-bold">{errors.phone}</p>}
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-gray-400 uppercase mb-1">Morada / Zona <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className={`w-full border rounded-xl p-3 focus:ring-2 outline-none transition-all ${errors.address ? 'border-red-300 ring-red-100' : 'focus:ring-green-500'}`}
                                    placeholder="Rua, Número, Zona, Cidade"
                                    value={formData.address || ''}
                                    onChange={e => handleChange('address', e.target.value)}
                                />
                                {errors.address && <p className="text-xs text-red-500 mt-1 font-bold">{errors.address}</p>}
                            </div>
                        </div>
                    </section>

                    {/* Secção 3: Detalhes Adicionais */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-green-700 font-bold border-b border-green-100 pb-2">
                            <FileText size={18}/> <span>Informações Adicionais</span>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Notas Internas</label>
                            <textarea 
                                className="w-full border rounded-xl p-3 h-24 text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"
                                placeholder="Histórico breve, preferências do cliente, horários, etc..."
                                value={formData.notes || ''}
                                onChange={e => handleChange('notes', e.target.value)}
                            />
                        </div>
                    </section>
                </div>

                <div className="pt-6 border-t mt-auto flex justify-between items-center shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 text-green-600 rounded focus:ring-green-500" checked={formData.active !== false} onChange={e => handleChange('active', e.target.checked)} />
                        <span className="text-sm font-bold text-gray-700">Cliente Ativo</span>
                    </label>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50">Cancelar</button>
                        <button type="submit" className="px-8 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg hover:bg-green-700 flex items-center gap-2">
                            <CheckCircle2 size={18}/> Guardar Cliente
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};
