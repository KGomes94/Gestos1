
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Appointment, Employee, Client, SystemSettings, Material, AppointmentItem, HistoryLog, Invoice, Transaction, InvoiceItem } from '../types';
import { Calendar as CalendarIcon, List, Plus, Search, X, CheckCircle2, DollarSign, Printer, BarChart2, Trash2, ScrollText, Clock, AlertTriangle, TrendingUp, ChevronLeft, ChevronRight, CalendarDays, Filter, User as UserIcon, Info, Upload, Check, XCircle, Lock, Wallet } from 'lucide-react';
import Modal from './Modal';
import { db } from '../services/db';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { printService } from '../services/printService';
import { schedulingConflictService } from '../scheduling/services/schedulingConflictService';

interface AppointmentPreview extends Appointment {
  isValid: boolean;
  errors: string[];
  rawDate?: any;
  rawVal?: any;
}

interface ScheduleModuleProps {
    clients: Client[];
    employees: Employee[];
    proposals: any[];
    onNavigateToProposal?: (id: string) => void;
    appointments: Appointment[];
    setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
    // New Props for Integration
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    settings: SystemSettings;
}

const ScheduleModule: React.FC<ScheduleModuleProps> = ({ clients, employees, appointments, setAppointments, setInvoices, setTransactions, settings }) => {
  const { notify } = useNotification();
  const { user } = useAuth();
  
  const dateInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportTextareaRef = useRef<HTMLTextAreaElement>(null);
  const anomaliesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const [materials, setMaterials] = useState<Material[]>([]);
  useEffect(() => {
      db.materials.getAll().then(setMaterials);
  }, []);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // PERSISTÊNCIA DA VISÃO
  const [view, setView] = useState<'calendar' | 'list' | 'dashboard'>(() => {
      return (localStorage.getItem('sched_view') as any) || 'calendar';
  });

  useEffect(() => { localStorage.setItem('sched_view', view); }, [view]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'details' | 'costs' | 'closure' | 'logs'>('details');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [listFilters, setListFilters] = useState(() => db.filters.getAgenda());
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isLoadingImport, setIsLoadingImport] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [previewData, setPreviewData] = useState<AppointmentPreview[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ date: string, time: string } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ date: string, time: string } | null>(null);

  const [newAppt, setNewAppt] = useState<Partial<Appointment>>({ 
      status: 'Agendado', items: [], totalValue: 0, duration: 1.0, notes: '', logs: [], reportedAnomalies: ''
  });

  const [selectedMatId, setSelectedMatId] = useState('');
  const [matQty, setMatQty] = useState(1);
  const [paymentReceived, setPaymentReceived] = useState(false);

  // BLOQUEIO DE EDIÇÃO: Verifica se o agendamento JÁ ESTAVA concluído no banco de dados
  const isLocked = useMemo(() => {
      if (!editingId) return false;
      const original = appointments.find(a => a.id === editingId);
      return original?.status === 'Concluído';
  }, [editingId, appointments]);

  // CONFLITOS DE HORÁRIO (Memoized)
  const conflicts = useMemo(() => {
      return schedulingConflictService.detectConflicts(appointments);
  }, [appointments]);

  useEffect(() => { db.filters.saveAgenda(listFilters); }, [listFilters]);

  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
        const matchesSearch = !searchTerm || 
            (a.client || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (a.code || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const aDate = new Date(a.date);
        const matchesMonth = Number(listFilters.month) === 0 || (aDate.getMonth() + 1) === Number(listFilters.month);
        const matchesYear = aDate.getFullYear() === Number(listFilters.year);
        const matchesStatus = listFilters.status === 'Todos' || a.status === listFilters.status;

        return matchesSearch && matchesMonth && matchesYear && matchesStatus;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  }, [appointments, searchTerm, listFilters]);

  // --- PRINT ENGINE INTEGRATION ---
  const handlePrintServiceOrder = () => {
    if (!newAppt.code) return;

    const itemsHtml = (newAppt.items || []).map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.unitPrice.toLocaleString()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${item.total.toLocaleString()}</td>
      </tr>
    `).join('');

    const content = `
      <div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background: #f9fafb; padding: 15px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between;">
           <div>
             <span class="label">Código da Ordem</span>
             <div class="value" style="font-size: 20px; color: #15803d;">${newAppt.code}</div>
           </div>
           <div style="text-align: right;">
             <span class="label">Data de Intervenção</span>
             <div class="value">${new Date(newAppt.date!).toLocaleDateString('pt-PT')} às ${newAppt.time}</div>
           </div>
        </div>

        <div style="padding: 20px; display: grid; grid-template-cols: 1fr 1fr; gap: 20px;">
          <div>
            <span class="label">Cliente / Entidade</span>
            <div class="value">${newAppt.client}</div>
            <span class="label">Técnico Responsável</span>
            <div class="value">${newAppt.technician}</div>
          </div>
          <div>
            <span class="label">Tipo de Serviço</span>
            <div class="value">${newAppt.service}</div>
            <span class="label">Estado Atual</span>
            <div class="value">${newAppt.status}</div>
          </div>
        </div>

        <div style="padding: 0 20px 20px;">
          <span class="label">Descrição do Problema / Anomalias</span>
          <div style="background: #fffaf0; border: 1px dashed #fbd38d; padding: 10px; border-radius: 4px; font-size: 13px; min-height: 60px;">
            ${newAppt.reportedAnomalies || 'Nenhuma anomalia descrita.'}
          </div>
        </div>

        <div style="padding: 0 20px 20px;">
          <span class="label">Artigos Utilizados e Mão de Obra</span>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 5px;">
            <tr class="table-header">
              <th style="padding: 8px; text-align: left;">Descrição</th>
              <th style="padding: 8px; text-align: center;">Qtd</th>
              <th style="padding: 8px; text-align: right;">P. Unit</th>
              <th style="padding: 8px; text-align: right;">Subtotal</th>
            </tr>
            ${itemsHtml || '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #999;">Nenhum item registado.</td></tr>'}
            <tr style="background: #f0fdf4;">
              <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold; text-transform: uppercase; font-size: 10px;">Total do Serviço:</td>
              <td style="padding: 10px; text-align: right; font-weight: 900; font-size: 16px; color: #166534;">${(newAppt.totalValue || 0).toLocaleString()} ${settings.currency}</td>
            </tr>
          </table>
        </div>

        <div style="padding: 0 20px 20px;">
          <span class="label">Relatório Técnico / Notas de Encerramento</span>
          <div style="border: 1px solid #eee; padding: 15px; border-radius: 4px; font-size: 13px; background: #fff; min-height: 100px;">
            ${newAppt.notes || '<span style="color: #ccc italic">Campo aguardando preenchimento técnico...</span>'}
          </div>
        </div>
      </div>
    `;

    printService.printDocument(`Ordem de Serviço ${newAppt.code}`, content, settings);
  };

  // ... (Excel Import Logic Preserved) ...
  const findValueInRow = (row: any, possibleKeys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const key of possibleKeys) {
        if (row[key] !== undefined) return row[key];
        const foundKey = rowKeys.find(k => k.trim().toLowerCase() === key.toLowerCase());
        if (foundKey) return row[foundKey];
    }
    return undefined;
  };

  const parseExcelDate = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'number') {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000) + 43200000);
      return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    }
    const strVal = String(value).trim();
    const ptDateMatch = strVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ptDateMatch) {
        const day = ptDateMatch[1].padStart(2, '0');
        const month = ptDateMatch[2].padStart(2, '0');
        const year = ptDateMatch[3];
        return `${year}-${month}-${day}`;
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  };

  const formatDateDisplay = (dateString: string) => {
      if (!dateString) return '-';
      try {
          const parts = dateString.split('-');
          if (parts.length === 3) {
              return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          return dateString;
      } catch (e) {
          return dateString;
      }
  };

  const parseCurrency = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    const strVal = String(value).trim().replace(/[^0-9.,-]/g, '');
    if (!strVal) return 0;
    const lastDot = strVal.lastIndexOf('.');
    const lastComma = strVal.lastIndexOf(',');
    let clean = (lastComma > lastDot) ? strVal.replace(/\./g, '').replace(',', '.') : strVal.replace(/,/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingImport(true);
    setImportProgress(10);

    const reader = new FileReader();
    reader.onload = (evt) => {
      setTimeout(() => {
        setImportProgress(40);
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        setImportProgress(70);

        const mapped: AppointmentPreview[] = data.map((row: any, idx) => {
            const errors: string[] = [];
            const rawDate = findValueInRow(row, ['Data', 'Date', 'Dia']);
            const parsedDate = parseExcelDate(rawDate);
            if (!parsedDate) errors.push('Data inválida');

            const clientName = findValueInRow(row, ['Cliente', 'Empresa', 'Entidade', 'Client']) || 'Cliente Indefinido';
            const matchedClient = clients.find(c => c.company.toLowerCase() === String(clientName).toLowerCase() || c.name.toLowerCase() === String(clientName).toLowerCase());
            
            const technician = findValueInRow(row, ['Técnico', 'Responsável', 'Technician']) || ' Nelson Semedo';
            const service = findValueInRow(row, ['Serviço', 'Tipo', 'Service']) || 'Manutenção';
            const time = findValueInRow(row, ['Hora', 'Horário', 'Time']) || '09:00';
            const duration = parseFloat(findValueInRow(row, ['Duração', 'Horas', 'Duration']) || '1');
            const totalValue = parseCurrency(findValueInRow(row, ['Valor', 'Total', 'Preço', 'Value']));
            const statusStr = String(findValueInRow(row, ['Estado', 'Status']) || 'Agendado');
            
            let status: any = 'Agendado';
            if (statusStr.includes('Andamento')) status = 'Em Andamento';
            else if (statusStr.includes('Concluído') || statusStr.includes('Feito')) status = 'Concluído';
            else if (statusStr.includes('Cancelado')) status = 'Cancelado';

            return {
                id: Date.now() + idx,
                code: `AG-IMP-${idx}`,
                client: matchedClient?.company || String(clientName),
                clientId: matchedClient?.id,
                service,
                date: parsedDate || '',
                time: String(time),
                duration: isNaN(duration) ? 1 : duration,
                technician: String(technician),
                status,
                totalValue,
                reportedAnomalies: findValueInRow(row, ['Descrição', 'Problema', 'Notas', 'Anomalias']) || '',
                logs: [{ timestamp: new Date().toISOString(), action: 'Importação', details: 'Importado via Excel', user: user?.name }],
                items: [],
                isValid: errors.length === 0,
                errors,
                rawDate
            };
        });

        setPreviewData(mapped);
        setImportProgress(100);
        setTimeout(() => {
            setIsLoadingImport(false);
            setIsImportModalOpen(true);
        }, 500);
      }, 300);
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImport = () => {
    const valid = previewData.filter(p => p.isValid).map(({ isValid, errors, rawDate, ...appt }) => appt as Appointment);
    if (valid.length > 0) {
        const withCodes = valid.map((a, i) => ({
            ...a,
            code: db.appointments.getNextCode([...appointments, ...valid.slice(0, i)])
        }));
        setAppointments(prev => [...prev, ...withCodes]);
        notify('success', `${withCodes.length} agendamentos importados.`);
    }
    setIsImportModalOpen(false);
    setPreviewData([]);
    setView('list');
  };

  const dashboardData = useMemo(() => {
    const total = appointments.length;
    const completed = appointments.filter(a => a.status === 'Concluído').length;
    const pending = appointments.filter(a => a.status === 'Agendado' || a.status === 'Em Andamento').length;
    const totalValue = appointments.reduce((acc, a) => acc + (a.totalValue || 0), 0);
    
    const byStatus = [
        { name: 'Agendado', value: appointments.filter(a => a.status === 'Agendado').length, color: '#3b82f6' },
        { name: 'Em Andamento', value: appointments.filter(a => a.status === 'Em Andamento').length, color: '#eab308' },
        { name: 'Concluído', value: appointments.filter(a => a.status === 'Concluído').length, color: '#22c55e' },
        { name: 'Cancelado', value: appointments.filter(a => a.status === 'Cancelado').length, color: '#9ca3af' }
    ];

    return { total, completed, pending, totalValue, byStatus };
  }, [appointments]);

  const handleSave = (e?: React.FormEvent) => {
      if(e) e.preventDefault();
      
      if (!newAppt.clientId) { notify('error', 'O Cliente é obrigatório.'); return; }
      if (!newAppt.technician) { notify('error', 'O Técnico Responsável é obrigatório.'); return; }
      if (!newAppt.reportedAnomalies?.trim()) { 
          notify('error', 'A Descrição do Problema é obrigatória.'); 
          setModalTab('details');
          setTimeout(() => anomaliesTextareaRef.current?.focus(), 100);
          return; 
      }

      if (newAppt.status === 'Concluído' && !newAppt.notes?.trim()) {
          notify('error', 'Relatório Técnico é obrigatório para concluir o serviço.');
          setModalTab('closure');
          setTimeout(() => reportTextareaRef.current?.focus(), 100);
          return;
      }

      const isNewClosure = newAppt.status === 'Concluído' && appointments.find(a => a.id === editingId)?.status !== 'Concluído';
      const itemsTotal = (newAppt.items || []).reduce((a,b)=>a+b.total, 0);

      // --- LOGIC FOR AUTOMATIC INVOICING ---
      let generatedInvoiceId = undefined;
      let generatedTxId = undefined;

      if (isNewClosure && itemsTotal > 0) {
          // Generate Invoice
          const num = db.invoices.getNextNumber(settings.fiscalConfig.invoiceSeries);
          const series = settings.fiscalConfig.invoiceSeries;
          const invDisplayId = `FTE ${series}${new Date().getFullYear()}/${num.toString().padStart(3, '0')}`;
          
          const invItems: InvoiceItem[] = (newAppt.items || []).map(i => ({
              id: Date.now() + Math.random(),
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              taxRate: settings.defaultTaxRate, // Default
              total: i.total
          }));

          const sub = itemsTotal; // Simplified calc
          const tax = 0; // Simplified for this example
          
          const newInvoice: Invoice = {
              id: invDisplayId,
              internalId: num,
              series: series,
              type: 'FTE',
              typeCode: '01',
              date: new Date().toISOString().split('T')[0],
              dueDate: new Date().toISOString().split('T')[0],
              clientId: newAppt.clientId,
              clientName: newAppt.client || 'Cliente',
              clientNif: '',
              clientAddress: '',
              items: invItems,
              subtotal: sub,
              taxTotal: tax,
              withholdingTotal: 0,
              total: sub, // Simplified
              status: paymentReceived ? 'Paga' : 'Rascunho', // Status logic
              fiscalStatus: paymentReceived ? 'Transmitido' : 'Pendente', // Simulated
              iud: '',
              originAppointmentId: editingId || Date.now()
          };

          // If Paid, Generate Transaction
          if (paymentReceived) {
              const tx: Transaction = {
                  id: Date.now(),
                  date: newInvoice.date,
                  description: `Serviço ${newAppt.code} - ${newAppt.client}`,
                  reference: newInvoice.id,
                  type: 'Dinheiro', // Default to Cash if collected on site
                  category: 'Serviços Pontuais',
                  income: newInvoice.total,
                  expense: null,
                  status: 'Pago',
                  clientId: newAppt.clientId,
                  clientName: newAppt.client,
                  invoiceId: newInvoice.id
              };
              setTransactions(prev => [tx, ...prev]);
              notify('success', 'Fatura Paga e Transação gerada automaticamente.');
          } else {
              notify('success', 'Fatura Rascunho gerada na Faturação.');
          }

          setInvoices(prev => [newInvoice, ...prev]);
          generatedInvoiceId = newInvoice.id;
      }
      // -------------------------------------

      const log: HistoryLog = { 
          timestamp: new Date().toISOString(), 
          action: editingId ? 'Atualização' : 'Criação', 
          details: `Status: ${newAppt.status}. Valor: ${itemsTotal.toLocaleString()} CVE. ${generatedInvoiceId ? `Fat: ${generatedInvoiceId}` : ''}`,
          user: user?.name
      };
      
      const data = { 
          ...newAppt, 
          totalValue: itemsTotal, 
          generatedInvoiceId,
          logs: [log, ...(newAppt.logs || [])] 
      } as Appointment;
      
      if (editingId) {
          setAppointments(prev => prev.map(a => a.id === editingId ? data : a));
      } else {
          setAppointments(prev => [...prev, { ...data, id: Date.now() }]);
      }

      setIsModalOpen(false);
      setPaymentReceived(false);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      setCurrentDate(newDate);
  };

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = settings.calendarStartHour; h < settings.calendarEndHour; h++) {
        for (let m = 0; m < 60; m += settings.calendarInterval) slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
    return slots;
  }, [settings]);

  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const start = new Date(d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)));
    return Array.from({ length: 6 }, (_, i) => {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        return day;
    });
  }, [currentDate]);

  const rowHeight = useMemo(() => {
      const slots = timeSlots.length;
      if (slots === 0) return 30;
      const available = windowHeight - 320;
      return Math.max(24, Math.floor(available / slots));
  }, [timeSlots, windowHeight]);

  const getApptStyle = (apt: Appointment, dailyAppts: Appointment[]) => {
      const concurrent = dailyAppts.filter(a => {
          const [ah, am] = a.time.split(':').map(Number);
          const aEndMin = ah * 60 + am + a.duration * 60;
          const [currH, currM] = apt.time.split(':').map(Number);
          const currStartMin = currH * 60 + currM;
          const currEndMin = currStartMin + apt.duration * 60;
          return (currStartMin < aEndMin && currEndMin > (ah * 60 + am));
      }).sort((a,b) => a.time.localeCompare(b.time) || a.id - b.id);

      const count = concurrent.length;
      const index = concurrent.findIndex(a => a.id === apt.id);
      const [h, m] = apt.time.split(':').map(Number);
      const top = (((h * 60 + m) - (settings.calendarStartHour * 60)) / settings.calendarInterval) * rowHeight;
      const height = ((apt.duration * 60) / settings.calendarInterval) * rowHeight;
      const width = 100 / count;
      const left = index * width;

      return {
          top: `${top}px`,
          height: `${height}px`,
          width: `${width}%`,
          left: `${left}%`,
          zIndex: 10 + index
      };
  };

  const getStatusClasses = (status: string) => {
      switch(status) {
          case 'Agendado': return 'bg-blue-50 border-blue-500 text-blue-800 shadow-blue-100/50';
          case 'Em Andamento': return 'bg-yellow-50 border-yellow-500 text-yellow-800 shadow-yellow-100/50';
          case 'Concluído': return 'bg-green-50 border-green-500 text-green-800 shadow-green-100/50 ring-1 ring-green-200';
          case 'Cancelado': return 'bg-gray-100 border-gray-400 text-gray-500 grayscale';
          default: return '';
      }
  };

  const handleMouseDown = (date: string, time: string) => {
    setIsDragging(true);
    setDragStart({ date, time });
    setDragCurrent({ date, time });
  };

  const handleMouseEnterGrid = (date: string, time: string) => {
    if (isDragging) setDragCurrent({ date, time });
  };

  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragCurrent) return;
    const startTime = dragStart.time < dragCurrent.time ? dragStart.time : dragCurrent.time;
    const endTime = dragStart.time < dragCurrent.time ? dragCurrent.time : dragStart.time;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const duration = ((eh * 60 + em) - (sh * 60 + sm)) / 60 || 0.5;

    setEditingId(null);
    setNewAppt({ code: db.appointments.getNextCode(appointments), date: dragStart.date, time: startTime, duration, status: 'Agendado', items: [], totalValue: 0, logs: [], reportedAnomalies: '' });
    setModalTab('details');
    setIsModalOpen(true);
    setIsDragging(false);
    setDragStart(null);
  };

  const validCount = previewData.filter(p => p.isValid).length;
  const invalidCount = previewData.length - validCount;

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] space-y-4 relative overflow-hidden">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Agenda Integrada</h2>
            <p className="text-xs text-gray-500">Gestão de serviços em tempo real</p>
          </div>
          <div className="flex items-center gap-3 self-end md:self-auto">
             {/* Botão Novo Agendamento sempre visível */}
             <button onClick={() => { setEditingId(null); setNewAppt({ code: db.appointments.getNextCode(appointments), date: new Date().toISOString().split('T')[0], time: '09:00', duration: 1, items: [], status: 'Agendado', reportedAnomalies: '' }); setModalTab('details'); setIsModalOpen(true); }} className="bg-green-600 text-white px-6 py-2 rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100 whitespace-nowrap"><Plus size={16}/> Novo Agendamento</button>
             
             <div className="flex gap-2 bg-gray-100 p-1 rounded-lg border">
                <button onClick={() => setView('calendar')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${view === 'calendar' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><CalendarIcon size={14} className="inline mr-1"/> Agenda</button>
                <button onClick={() => setView('list')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${view === 'list' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><List size={14} className="inline mr-1"/> Lista</button>
                <button onClick={() => setView('dashboard')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${view === 'dashboard' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><BarChart2 size={14} className="inline mr-1"/> Dashboard</button>
             </div>
          </div>
      </div>

      {view === 'calendar' && (
          <div className="flex flex-col flex-1 gap-4 overflow-hidden animate-fade-in-up">
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigateWeek('prev')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={20}/></button>
                    <div className="flex flex-col items-center px-4 min-w-[200px]">
                        <span className="text-xs font-black uppercase text-gray-400 tracking-widest">Semana de</span>
                        <span className="text-sm font-bold text-gray-800">
                            {weekDays[0].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} — {weekDays[5].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                    <button onClick={() => navigateWeek('next')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight size={20}/></button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-gray-50 text-gray-600 rounded-xl text-xs font-black uppercase hover:bg-gray-100 transition-colors border border-gray-200">Hoje</button>
                    <div className="relative">
                        <button onClick={() => dateInputRef.current?.showPicker()} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors border border-green-100 flex items-center gap-2 px-4 text-xs font-bold">
                            <CalendarDays size={18}/> Escolher Semana
                        </button>
                        <input 
                            type="date" 
                            ref={dateInputRef}
                            className="absolute inset-0 opacity-0 pointer-events-none" 
                            onChange={(e) => { if(e.target.value) setCurrentDate(new Date(e.target.value)); }}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 select-none relative" ref={gridContainerRef}>
                <div className="grid grid-cols-[80px_repeat(6,1fr)] bg-gray-50 border-b text-[10px] font-black uppercase text-gray-400 shrink-0 sticky top-0 z-20">
                    <div className="p-2 border-r text-center">Hora</div>
                    {weekDays.map((d, i) => {
                        const dateKey = d.toISOString().split('T')[0];
                        const conflictInfo = conflicts[dateKey];
                        
                        return (
                            <div key={i} className={`p-2 text-center border-r flex justify-center items-center gap-1 ${d.toDateString() === new Date().toDateString() ? 'bg-green-50 text-green-700 font-black' : ''}`}>
                                {d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' })}
                                {conflictInfo && (
                                    <span 
                                        className="text-red-500 cursor-help transform hover:scale-125 transition-transform" 
                                        title={`CONFLITO DE HORÁRIOS: ${conflictInfo.technicians.join(', ')} possuem tarefas sobrepostas neste dia.`}
                                    >
                                        🔺
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="flex-1 overflow-hidden relative bg-white" onMouseLeave={() => { setIsDragging(false); }}>
                    <div className="grid grid-cols-[80px_repeat(6,1fr)] absolute inset-0 h-full">
                        <div className="border-r bg-gray-50/50 flex flex-col shrink-0 h-full">
                            {timeSlots.map(t => (
                                <div key={t} className="border-b text-[9px] text-gray-400 flex items-center justify-center font-bold" style={{ height: `${rowHeight}px` }}>
                                    {t.endsWith(':00') || t.endsWith(':30') ? t : ''}
                                </div>
                            ))}
                        </div>
                        {weekDays.map((day, i) => {
                            const ds = day.toISOString().split('T')[0];
                            const daily = appointments.filter(a => a.date === ds);
                            return (
                                <div key={i} className="border-r relative h-full" onMouseUp={handleMouseUp}>
                                    {timeSlots.map(t => (
                                        <div key={t} style={{ height: `${rowHeight}px` }} onMouseDown={() => handleMouseDown(ds, t)} onMouseEnter={() => handleMouseEnterGrid(ds, t)} className={`border-b border-gray-100 transition-colors cursor-crosshair ${isDragging && dragStart?.date === ds && ((t >= dragStart.time && t <= dragCurrent?.time!) || (t <= dragStart.time && t >= dragCurrent?.time!)) ? 'bg-green-100' : ''}`} />
                                    ))}
                                    {daily.map(apt => {
                                        const style = getApptStyle(apt, daily);
                                        const [h, m] = apt.time.split(':').map(Number);
                                        const totalMin = h * 60 + m + (apt.duration * 60);
                                        const endH = Math.floor(totalMin / 60);
                                        const endM = totalMin % 60;
                                        const timeRange = `${apt.time}-${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

                                        return (
                                            <div 
                                                key={apt.id} 
                                                className={`absolute rounded-lg border-l-4 shadow-md transition-none overflow-hidden cursor-pointer ${getStatusClasses(apt.status)}`} 
                                                style={style}
                                                onClick={(e) => { e.stopPropagation(); setEditingId(apt.id); setNewAppt(apt); setModalTab('details'); setIsModalOpen(true); }}
                                            >
                                                <div className="absolute inset-0 px-2 py-1 flex flex-col leading-tight h-full">
                                                    <div className="font-black truncate uppercase tracking-tighter text-[10px] mb-0.5 flex items-center gap-1">
                                                        {apt.client || 'Sem Cliente'}
                                                        {apt.status === 'Concluído' && <CheckCircle2 size={10} className="text-green-600 inline shrink-0" />}
                                                    </div>
                                                    
                                                    {rowHeight > 18 && (
                                                        <>
                                                            <div className="opacity-80 truncate font-bold text-[9px] text-gray-500 mb-1">{apt.service}</div>
                                                            <div className="mt-auto flex flex-col gap-0.5 pt-1 border-t border-black/5">
                                                                <div className="flex items-center gap-1 text-[9px] font-black text-gray-700 truncate">
                                                                    <UserIcon size={9} className="shrink-0 opacity-50"/> {apt.technician || 'S/ Técnico'}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[9px] font-bold text-blue-800/60 truncate uppercase">
                                                                    <Clock size={9} className="shrink-0 opacity-50"/> {timeRange} ({apt.duration}h)
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
          </div>
      )}

      {/* ... List View and Dashboard View (Preserved) ... */}
      {view === 'list' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up flex flex-col flex-1">
              <div className="p-4 bg-gray-50/50 border-b flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between shrink-0">
                  <div className="flex flex-wrap gap-3 w-full xl:w-auto items-end">
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] font-black text-gray-400 uppercase">Pesquisar</label>
                        <div className="relative">
                            <input type="text" placeholder="Procurar cliente ou código..." className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-xl text-sm w-full sm:w-64 outline-none focus:ring-2 focus:ring-green-500 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            <Search size={16} className="absolute left-3 top-2 text-gray-400" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Estado</label>
                          <select name="status" value={listFilters.status} onChange={(e) => setListFilters({...listFilters, status: e.target.value})} className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500">
                              <option value="Todos">Todos</option><option>Agendado</option><option>Em Andamento</option><option>Concluído</option><option>Cancelado</option>
                          </select>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleImportExcel}/>
                      <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-xl hover:bg-gray-50 text-xs font-black uppercase tracking-widest transition-all"><Upload size={16} /> Importar Excel</button>
                  </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 sticky top-0 z-10 border-b">
                        <tr>
                            <th className="p-4 text-left">Código</th>
                            <th className="p-4 text-left">Data/Hora</th>
                            <th className="p-4 text-left">Cliente</th>
                            <th className="p-4 text-left">Serviço</th>
                            <th className="p-4 text-right">Valor Total</th>
                            <th className="p-4 text-center">Estado</th>
                            <th className="p-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredAppointments.map(a => (
                            <tr key={a.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="p-4 font-mono font-bold text-gray-400 group-hover:text-green-600">{a.code}</td>
                                <td className="p-4 whitespace-nowrap"><span className="font-bold">{formatDateDisplay(a.date)}</span> <span className="text-gray-400 ml-1">{a.time}</span></td>
                                <td className="p-4 font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
                                    {a.client || 'N/A'}
                                    {a.status === 'Concluído' && <CheckCircle2 size={14} className="text-green-600" />}
                                </td>
                                <td className="p-4 text-gray-500 font-medium">{a.service}</td>
                                <td className="p-4 text-right font-bold text-gray-700">{(a.totalValue || 0).toLocaleString()} <span className="text-[10px] opacity-50 font-normal">CVE</span></td>
                                <td className="p-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                        a.status === 'Concluído' ? 'bg-green-100 text-green-700' : 
                                        a.status === 'Em Andamento' ? 'bg-yellow-100 text-yellow-700' : 
                                        a.status === 'Agendado' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-500'
                                    }`}>
                                        {a.status}
                                    </span>
                                </td>
                                <td className="p-4 text-right"><button onClick={() => { setEditingId(a.id); setNewAppt(a); setModalTab('details'); setIsModalOpen(true); }} className="bg-green-50 text-green-700 px-4 py-1 rounded-lg text-xs font-black uppercase hover:bg-green-600 hover:text-white transition-all">Gerir</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
          </div>
      )}

      {view === 'dashboard' && (
          <div className="space-y-6 animate-fade-in-up flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4"><div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><CalendarIcon size={24}/></div></div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Serviços</p>
                      <h3 className="text-3xl font-black text-gray-900">{dashboardData.total}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4"><div className="p-3 bg-green-50 text-green-600 rounded-xl"><CheckCircle2 size={24}/></div></div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Concluídos</p>
                      <h3 className="text-3xl font-black text-green-600">{dashboardData.completed}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4"><div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Clock size={24}/></div></div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Pendentes</p>
                      <h3 className="text-3xl font-black text-orange-600">{dashboardData.pending}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4"><div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={24}/></div></div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Valor Previsto</p>
                      <h3 className="text-3xl font-black text-emerald-700">{dashboardData.totalValue.toLocaleString()}</h3>
                  </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm min-h-[400px]">
                      <h3 className="font-black text-gray-800 uppercase text-xs tracking-[0.2em] mb-8 flex items-center gap-2"><BarChart2 size={16} className="text-green-600"/> Distribuição de Status</h3>
                      <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={dashboardData.byStatus}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                              <XAxis dataKey="name" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                              <YAxis fontSize={10} axisLine={false} tickLine={false} />
                              <ChartTooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                                  {dashboardData.byStatus.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
                  <div className="bg-green-700 p-8 rounded-2xl shadow-xl shadow-green-100 text-white flex flex-col justify-center items-center text-center">
                       <div className="bg-white/10 p-4 rounded-full mb-6"><AlertTriangle size={48} className="text-green-200" /></div>
                       <h3 className="text-2xl font-black mb-2">Próximos Passos</h3>
                       <p className="text-green-100/70 text-sm max-w-xs mb-8 font-medium">Garanta que todos os serviços de hoje sejam marcados como "Em Andamento" ou "Concluído" para manter o financeiro atualizado.</p>
                       <button onClick={() => setView('calendar')} className="bg-white text-green-700 px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-transform">Ver Agenda Completa</button>
                  </div>
              </div>
          </div>
      )}

      {/* Import Preview Modal (PRESERVED) */}
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar Agendamentos (Excel)">
          <div className="space-y-6">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between">
                  <div className="flex gap-8">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 text-green-700 p-2 rounded-lg"><Check size={20}/></div>
                        <div><p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Válidos</p><p className="text-xl font-black text-green-700">{validCount}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 text-red-700 p-2 rounded-lg"><AlertTriangle size={20}/></div>
                        <div><p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Erros</p><p className="text-xl font-black text-red-700">{invalidCount}</p></div>
                    </div>
                  </div>
                  <div className="text-right max-w-sm"><p className="text-xs text-blue-800 font-medium italic">O sistema associou automaticamente os nomes de clientes aos IDs existentes na base de dados.</p></div>
              </div>
              <div className="overflow-x-auto max-h-[400px] border rounded-2xl shadow-sm">
                  <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10 border-b">
                        <tr className="text-[10px] font-black text-gray-400 uppercase"><th className="p-3 text-left">Status</th><th className="p-3 text-left">Data</th><th className="p-3 text-left">Cliente</th><th className="p-3 text-left">Serviço</th><th className="p-3 text-right">Valor</th><th className="p-3 text-left">Erros</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white font-medium">
                        {previewData.map((row, idx) => (
                          <tr key={idx} className={row.isValid ? 'hover:bg-gray-50' : 'bg-red-50'}>
                            <td className="p-3">{row.isValid ? <Check size={16} className="text-green-600" /> : <XCircle size={16} className="text-red-600" />}</td>
                            <td className="p-3 whitespace-nowrap">{row.isValid && row.date ? formatDateDisplay(row.date) : <span className="text-red-600 font-bold">{String(row.rawDate || 'N/A')}</span>}</td>
                            <td className="p-3 truncate max-w-xs">{row.client} {!row.clientId && <span className="ml-1 text-[8px] bg-yellow-100 text-yellow-700 px-1 rounded">Novo</span>}</td>
                            <td className="p-3 text-xs text-gray-500">{row.service}</td>
                            <td className="p-3 text-right font-black text-gray-700">{row.totalValue.toLocaleString()}</td>
                            <td className="p-3 text-red-600 text-[10px] font-black">{row.errors.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                  </table>
              </div>
              <div className="pt-6 flex justify-end gap-3 border-t">
                <button onClick={() => setIsImportModalOpen(false)} className="px-6 py-2 bg-white border rounded-xl font-bold text-gray-500 hover:bg-gray-100">Cancelar</button>
                <button onClick={confirmImport} disabled={validCount === 0} className="px-10 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg shadow-green-100 hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">Importar {validCount} Serviços</button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Gestão de Serviço - ${newAppt.code || ''}`}>
          <div className="flex flex-col max-h-[80vh]">
              {/* ALERTA DE BLOQUEIO */}
              {isLocked && (
                  <div className="bg-amber-50 border-b border-amber-200 p-3 flex items-center gap-3 text-amber-800 text-xs font-bold">
                      <Lock size={16} className="shrink-0 text-amber-600"/>
                      Este agendamento foi CONCLUÍDO e está bloqueado para edição. Para modificar, altere o estado e guarde primeiro.
                  </div>
              )}

              <div className="flex border-b mb-6 overflow-x-auto bg-gray-50 rounded-t-lg">
                  {[
                      {id: 'details', label: 'Dados Gerais'},
                      {id: 'costs', label: 'Artigos & Custos'},
                      {id: 'closure', label: 'Encerramento'},
                      {id: 'logs', label: 'Histórico'}
                  ].map(t => (
                      <button key={t.id} onClick={() => setModalTab(t.id as any)} className={`px-6 py-4 text-xs font-black uppercase border-b-2 transition-all ${modalTab === t.id ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-400'}`}>{t.label}</button>
                  ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-8">
                  {modalTab === 'details' && (
                      <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Cliente <span className="text-red-500">*</span></label>
                                <select disabled={isLocked} required className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none font-bold disabled:bg-gray-100 disabled:text-gray-500" value={newAppt.clientId || ''} onChange={e => {const c = clients.find(cl=>cl.id===Number(e.target.value)); setNewAppt({...newAppt, clientId: c?.id, client: c?.company});}}>
                                    <option value="">Selecione...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Técnico Responsável <span className="text-red-500">*</span></label>
                                <select disabled={isLocked} required className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none font-bold disabled:bg-gray-100 disabled:text-gray-500" value={newAppt.technician} onChange={e => setNewAppt({...newAppt, technician: e.target.value})}><option value="">Selecione um técnico...</option>{employees.map(emp=><option key={emp.id} value={emp.name}>{emp.name}</option>)}</select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="col-span-2 md:col-span-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Serviço</label>
                                <select disabled={isLocked} className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100" value={newAppt.service} onChange={e => setNewAppt({...newAppt, service: e.target.value})}>{settings.serviceTypes.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Data</label>
                                <input disabled={isLocked} type="date" className="w-full border rounded-xl p-3 text-sm disabled:bg-gray-100" value={newAppt.date} onChange={e => setNewAppt({...newAppt, date: e.target.value})}/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                                <input disabled={isLocked} type="time" className="w-full border rounded-xl p-3 text-sm disabled:bg-gray-100" value={newAppt.time} onChange={e => setNewAppt({...newAppt, time: e.target.value})}/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Duração (h)</label>
                                <input disabled={isLocked} type="number" step="0.5" className="w-full border rounded-xl p-3 text-sm disabled:bg-gray-100" value={newAppt.duration} onChange={e => setNewAppt({...newAppt, duration: Number(e.target.value)})}/>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Estado do Agendamento</label>
                                <select className={`w-full border rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none ${getStatusClasses(newAppt.status || 'Agendado')}`} value={newAppt.status} onChange={e => setNewAppt({...newAppt, status: e.target.value as any})}><option>Agendado</option><option>Em Andamento</option><option>Concluído</option><option>Cancelado</option></select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black uppercase block mb-1 text-red-600 font-bold">Descrição do Problema / Anomalias Reportadas <span className="text-red-500">*</span></label>
                                <textarea 
                                    disabled={isLocked}
                                    ref={anomaliesTextareaRef}
                                    required 
                                    className="w-full border rounded-xl p-4 h-32 text-sm focus:ring-2 focus:ring-red-500 outline-none bg-red-50/5 border-red-100 transition-all disabled:bg-gray-100 disabled:opacity-70" 
                                    placeholder="Descreva o problema reportado pelo cliente com detalhe..." 
                                    value={newAppt.reportedAnomalies} 
                                    onChange={e=>setNewAppt({...newAppt, reportedAnomalies: e.target.value})} 
                                />
                            </div>
                          </div>
                      </div>
                  )}
                  {modalTab === 'costs' && (
                      <div className="space-y-4">
                          <div className={`flex gap-2 bg-gray-50 p-4 rounded-xl border ${isLocked ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                              <select className="flex-1 border rounded-xl p-3 text-sm" value={selectedMatId} onChange={e=>setSelectedMatId(e.target.value)}><option value="">Selecionar Material...</option>{materials.map(m=><option key={m.id} value={m.id}>{m.name} ({m.price} CVE)</option>)}</select>
                              <input type="number" className="w-20 border rounded-xl p-3 text-center" value={matQty} onChange={e=>setMatQty(Number(e.target.value))}/>
                              <button type="button" onClick={()=>{
                                  const m = materials.find(x=>x.id===Number(selectedMatId));
                                  if(!m) return;
                                  const item: AppointmentItem = { id: Date.now(), description: m.name, quantity: matQty, unitPrice: m.price, total: m.price * matQty };
                                  setNewAppt({...newAppt, items: [...(newAppt.items || []), item]});
                                  setSelectedMatId(''); setMatQty(1);
                              }} className="bg-blue-600 text-white px-6 rounded-xl font-bold">Add</button>
                          </div>
                          <div className="border rounded-xl overflow-hidden shadow-sm">
                              <table className="w-full text-sm">
                                  <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400"><tr><th className="p-3 text-left">Item</th><th className="p-3 text-center">Qtd</th><th className="p-3 text-right">Preço</th><th className="p-3 text-right">Total</th><th className="p-3 w-10"></th></tr></thead>
                                  <tbody className="divide-y">
                                      {newAppt.items?.map(item => (
                                          <tr key={item.id}>
                                              <td className="p-3">{item.description}</td>
                                              <td className="p-3 text-center">{item.quantity}</td>
                                              <td className="p-3 text-right">{item.unitPrice.toLocaleString()}</td>
                                              <td className="p-3 text-right font-bold">{item.total.toLocaleString()}</td>
                                              <td className="p-3 text-center">
                                                  {!isLocked && (
                                                      <button onClick={()=>setNewAppt({...newAppt, items: newAppt.items?.filter(x=>x.id!==item.id)})} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                                  )}
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                          <div className="text-right p-4 bg-green-50 rounded-xl border border-green-100"><span className="text-[10px] uppercase font-black text-green-600 block">Total do Serviço</span><span className="text-2xl font-black">{(newAppt.items || []).reduce((a,b)=>a+b.total, 0).toLocaleString()} CVE</span></div>
                      </div>
                  )}
                  {modalTab === 'closure' && (
                      <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-6">
                              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4">
                                  <div className="bg-blue-600 text-white p-3 rounded-full"><DollarSign size={24}/></div>
                                  <div><p className="text-xs font-black text-blue-800 uppercase">Faturação Prevista</p><p className="text-xl font-black text-blue-900">{(newAppt.items || []).reduce((a,b)=>a+b.total, 0).toLocaleString()} CVE</p></div>
                              </div>
                              <button 
                                type="button"
                                className="p-6 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-4 text-left hover:bg-green-100 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500" 
                                onClick={handlePrintServiceOrder}
                              >
                                  <div className="bg-green-600 text-white p-3 rounded-full"><Printer size={24}/></div>
                                  <div>
                                      <p className="text-xs font-black text-green-800 uppercase leading-none mb-1">Ordem de Serviço</p>
                                      <span className="text-xs font-bold text-green-600 underline">Gerar Ordem de Trabalho</span>
                                  </div>
                              </button>
                          </div>
                          
                          {/* Payment Collection Toggle */}
                          {(newAppt.items || []).reduce((a,b)=>a+b.total, 0) > 0 && newAppt.status === 'Concluído' && !isLocked && (
                              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
                                  <label className="flex items-center gap-3 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                        checked={paymentReceived}
                                        onChange={(e) => setPaymentReceived(e.target.checked)}
                                      />
                                      <div>
                                          <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><Wallet size={16}/> Pagamento recebido pelo técnico?</p>
                                          <p className="text-xs text-gray-500 mt-1">Se marcado, será gerada uma Transação na Tesouraria e a Fatura será emitida como Paga.</p>
                                      </div>
                                  </label>
                              </div>
                          )}

                          <div>
                            <label className={`text-[10px] font-black uppercase block mb-1 ${newAppt.status === 'Concluído' ? 'text-red-600 font-bold' : 'text-gray-400'}`}>Relatório Técnico / Notas Finais {newAppt.status === 'Concluído' && <span className="text-red-500">* OBRIGATÓRIO PARA CONCLUIR</span>}</label>
                            <textarea 
                                disabled={isLocked}
                                ref={reportTextareaRef}
                                className={`w-full border rounded-xl p-4 h-40 text-sm focus:ring-2 outline-none transition-all disabled:bg-gray-100 ${newAppt.status === 'Concluído' && !newAppt.notes?.trim() ? 'border-red-300 bg-red-50/30 focus:ring-red-500' : 'focus:ring-green-500'}`} 
                                placeholder="Descreva os trabalhos realizados, peças substituídas e recomendações finais..." 
                                value={newAppt.notes} 
                                onChange={e=>setNewAppt({...newAppt, notes: e.target.value})} 
                            />
                          </div>
                      </div>
                  )}
                  {modalTab === 'logs' && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-gray-700 flex items-center gap-2"><ScrollText size={18}/> Histórico do Serviço</h4>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 max-h-[300px] overflow-y-auto shadow-inner space-y-2">
                            {(newAppt.logs || []).map((log, idx) => (
                                <div key={idx} className="text-xs border-b border-gray-200 py-2 last:border-0">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-blue-600 font-bold">{new Date(log.timestamp).toLocaleString('pt-PT')}</span>
                                        <span className="font-black uppercase text-gray-400 text-[9px]">{log.action}</span>
                                    </div>
                                    <p className="text-gray-700">Realizado por <span className="text-green-700 font-bold">{log.user || 'Sistemas'}</span>: {log.details}</p>
                                </div>
                            ))}
                        </div>
                      </div>
                  )}
              </div>
              <div className="p-6 border-t flex justify-end gap-3 bg-gray-50 rounded-b-lg">
                  <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-white border rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">Cancelar</button>
                  <button onClick={() => handleSave()} className="px-10 py-2 bg-green-600 text-white rounded-xl font-black uppercase shadow-lg shadow-green-100 hover:bg-green-700 transition-all">Guardar Registo</button>
              </div>
          </div>
      </Modal>
    </div>
  );
};

export default ScheduleModule;
