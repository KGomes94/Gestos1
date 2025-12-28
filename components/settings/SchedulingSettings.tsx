
import React, { useState } from 'react';
import { SystemSettings, ServiceType } from '../../types';
import { Calendar, Clock, Tag, Plus, Trash2 } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';

interface SchedulingSettingsProps {
    settings: SystemSettings;
    onChange: (newSettings: SystemSettings) => void;
}

export const SchedulingSettings: React.FC<SchedulingSettingsProps> = ({ settings, onChange }) => {
    const { notify } = useNotification();
    const { requestConfirmation } = useConfirmation();
    const [newService, setNewService] = useState('');

    const update = (field: keyof SystemSettings, value: any) => {
        onChange({ ...settings, [field]: value });
    };

    const addServiceType = () => {
        if (!newService.trim()) return;
        const exists = settings.serviceTypes.some(s => s.name.toLowerCase() === newService.toLowerCase());
        if (exists) {
            notify('error', 'Tipo de serviço já existe.');
            return;
        }
        const newType: ServiceType = {
            id: Date.now(),
            name: newService.trim(),
            color: '#3b82f6' // Default blue
        };
        onChange({
            ...settings,
            serviceTypes: [...settings.serviceTypes, newType]
        });
        setNewService('');
    };

    const removeServiceType = (id: number) => {
        requestConfirmation({
            title: "Remover Tipo de Serviço",
            message: "Deseja remover este tipo de serviço? Agendamentos existentes não serão afetados.",
            confirmText: 'Remover',
            variant: 'warning',
            onConfirm: () => {
                onChange({
                    ...settings,
                    serviceTypes: settings.serviceTypes.filter(s => s.id !== id)
                });
            }
        });
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Calendar size={20} className="text-green-600"/> Agenda & Serviços
                </h3>
                <p className="text-sm text-gray-500">Configuração de horários e tipologia de trabalhos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Horários */}
                <div className="bg-white border rounded-2xl p-6 shadow-sm">
                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Clock size={16}/> Horário de Funcionamento
                    </h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Início (Hora)</label>
                                <input 
                                    type="number" min="0" max="23" 
                                    className="w-full border rounded-lg p-2 text-sm" 
                                    value={settings.calendarStartHour} 
                                    onChange={e => update('calendarStartHour', Number(e.target.value))} 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Fim (Hora)</label>
                                <input 
                                    type="number" min="0" max="23" 
                                    className="w-full border rounded-lg p-2 text-sm" 
                                    value={settings.calendarEndHour} 
                                    onChange={e => update('calendarEndHour', Number(e.target.value))} 
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Intervalo de Slots (Minutos)</label>
                            <select 
                                className="w-full border rounded-lg p-2 text-sm bg-white" 
                                value={settings.calendarInterval} 
                                onChange={e => update('calendarInterval', Number(e.target.value))}
                            >
                                <option value="15">15 Minutos</option>
                                <option value="30">30 Minutos</option>
                                <option value="60">1 Hora</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tipos de Serviço */}
                <div className="bg-white border rounded-2xl p-6 shadow-sm">
                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Tag size={16}/> Tipos de Serviço
                    </h4>
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            placeholder="Novo tipo (ex: Manutenção)" 
                            className="flex-1 border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                            value={newService}
                            onChange={e => setNewService(e.target.value)}
                        />
                        <button onClick={addServiceType} className="bg-green-50 text-green-700 hover:bg-green-100 p-2 rounded-lg"><Plus size={18}/></button>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                        {settings.serviceTypes.map(st => (
                            <div key={st.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg">
                                <span className="text-sm font-bold text-gray-700">{st.name}</span>
                                <button onClick={() => removeServiceType(st.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
