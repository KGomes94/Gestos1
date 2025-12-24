
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, Bot, User, Loader2, Maximize2, Minimize2, Globe } from 'lucide-react';
import { ViewState } from '../types';
import { aiService } from '../services/aiService';
import { db } from '../services/db';

interface SmartAssistantProps {
  currentView: ViewState;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources?: any[]; // For grounding metadata
}

const SmartAssistant: React.FC<SmartAssistantProps> = ({ currentView }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'model', text: `Olá! Sou o GestOs Intelligence. Estou a analisar os dados do módulo **${currentView.toUpperCase()}**. Como posso ajudar a otimizar a sua gestão hoje?` }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset chat when view changes (optional, keeps context fresh)
  useEffect(() => {
    if (isOpen) {
        setMessages([
            { id: Date.now().toString(), role: 'model', text: `Detetei que mudou para **${currentView.toUpperCase()}**. Estou pronto para analisar este novo contexto.` }
        ]);
    }
  }, [currentView]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const getContextData = () => {
    const settings = db.settings.get();
    let data: any = { company: settings.companyName, currency: settings.currency };

    switch (currentView) {
        case 'financeiro':
        case 'dashboard':
            const txs = db.transactions.getAll();
            const paidTxs = txs.filter(t => t.status === 'Pago' && !t.isVoided);
            const income = paidTxs.reduce((acc, t) => acc + (t.income || 0), 0);
            const expense = paidTxs.reduce((acc, t) => acc + (t.expense || 0), 0);
            data = {
                ...data,
                summary: { totalIncome: income, totalExpense: expense, balance: income - expense },
                recentTransactions: txs.slice(0, 10), // Limit context size
                monthlyTarget: settings.monthlyTarget
            };
            break;
        case 'agenda':
            const appts = db.appointments.getAll();
            const today = new Date().toISOString().split('T')[0];
            data = {
                ...data,
                totalAppointments: appts.length,
                todayAppointments: appts.filter(a => a.date === today),
                pending: appts.filter(a => a.status === 'Agendado' || a.status === 'Em Andamento').length
            };
            break;
        case 'clientes':
            data = { ...data, clients: db.clients.getAll().slice(0, 20) };
            break;
        case 'rh':
            data = { ...data, employees: db.employees.getAll() };
            break;
        case 'faturacao':
            data = { ...data, invoices: db.invoices.getAll().slice(0, 10), fiscalConfig: settings.fiscalConfig };
            break;
        case 'propostas':
            data = { ...data, proposals: db.proposals.getAll().slice(0, 10) };
            break;
        default:
            data = { ...data, info: "Utilizador a navegar nas configurações ou menu geral." };
    }
    return JSON.stringify(data);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const context = getContextData();
    // Convert current messages to history format for API
    const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
    }));

    const response = await aiService.askAssistant(userMsg.text, context, currentView, history);

    const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: response.text,
        sources: response.groundingMetadata?.groundingChunks
    };
    
    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform duration-300 group border-2 border-white/20"
        title="GestOs Intelligence"
      >
        <Sparkles size={24} className="animate-pulse" />
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Analisar Tela
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all duration-300 overflow-hidden ${isExpanded ? 'w-[600px] h-[80vh]' : 'w-[380px] h-[500px]'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-yellow-300" />
            <div>
                <h3 className="font-bold text-sm leading-none">GestOs Intelligence</h3>
                <p className="text-[10px] text-white/70 font-medium">Contexto: {currentView.charAt(0).toUpperCase() + currentView.slice(1)}</p>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsExpanded(!isExpanded)} className="hover:bg-white/20 p-1 rounded text-white/80">
                {isExpanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
            </button>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded text-white/80">
                <X size={18}/>
            </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scrollbar-hide">
        {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'model' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'}`}>
                    {msg.role === 'model' ? <Bot size={16} /> : <User size={16} />}
                </div>
                <div className={`max-w-[80%] space-y-2`}>
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'model' ? 'bg-white border border-gray-100 text-gray-700 shadow-sm rounded-tl-none' : 'bg-indigo-600 text-white rounded-tr-none'}`}>
                        {msg.text}
                    </div>
                    {/* Sources / Grounding Display */}
                    {msg.sources && msg.sources.length > 0 && (
                        <div className="text-[10px] text-gray-400 flex flex-wrap gap-2 items-center pl-1">
                            <Globe size={10} />
                            {msg.sources.map((source, idx) => (
                                source.web?.uri && (
                                    <a key={idx} href={source.web.uri} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 underline truncate max-w-[150px]">
                                        {source.web.title || 'Fonte Web'}
                                    </a>
                                )
                            ))}
                        </div>
                    )}
                </div>
            </div>
        ))}
        {isLoading && (
            <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <Sparkles size={16} className="animate-spin" />
                </div>
                <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none text-sm text-gray-500 shadow-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin"/> Analisando dados e pesquisando...
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 shrink-0">
        <div className="relative flex items-center">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre os dados atuais..."
                className="w-full bg-gray-100 border-0 rounded-full pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                disabled={isLoading}
            />
            <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Send size={16} />
            </button>
        </div>
        <div className="text-[10px] text-center text-gray-400 mt-2 flex items-center justify-center gap-1">
            <Sparkles size={10}/> Powered by Gemini 3 Flash
        </div>
      </form>
    </div>
  );
};

export default SmartAssistant;
