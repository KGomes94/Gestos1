
import React from 'react';
import { LayoutDashboard, Wallet, Users, FileText, Calendar, Settings, LogOut, Briefcase, Package, HelpCircle, X, FileSearch, CreditCard } from 'lucide-react';
import { ViewState } from '../types';
import { useHelp } from '../contexts/HelpContext';
import { useAuth } from '../contexts/AuthContext';
// SmartAssistant removido temporariamente

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

const NavItem = ({ 
  active, 
  onClick, 
  icon: Icon, 
  label,
  visible
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: any; 
  label: string; 
  visible: boolean;
}) => {
    if (!visible) return null;
    return (
        <button
            onClick={onClick}
            title={label}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
            active 
                ? 'bg-green-800 text-white' 
                : 'text-green-100 hover:bg-green-700 hover:text-white'
            }`}
        >
            <Icon size={18} />
            <span className="hidden lg:inline">{label}</span>
        </button>
    );
};

const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView }) => {
  const { toggleHelp, isHelpOpen, helpContent } = useHelp();
  const { user, logout, hasPermission } = useAuth();
  const APP_VERSION = "2.0";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative overflow-x-hidden">
      <header className="bg-green-700 text-white shadow-md z-30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center shrink-0">
              <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => onChangeView('dashboard')}>
                <div className="bg-white text-green-700 font-bold px-2 py-1 rounded text-xl tracking-tighter">GestOs</div>
              </div>
            </div>

            <nav className="hidden md:flex space-x-1 items-center justify-center flex-1 mx-4">
              <NavItem active={currentView === 'dashboard'} onClick={() => onChangeView('dashboard')} icon={LayoutDashboard} label="Dashboard" visible={true} />
              <NavItem active={currentView === 'agenda'} onClick={() => onChangeView('agenda')} icon={Calendar} label="Agenda" visible={hasPermission('agenda')} />
              <NavItem active={currentView === 'faturacao'} onClick={() => onChangeView('faturacao')} icon={CreditCard} label="Faturação" visible={hasPermission('faturacao')} />
              <NavItem active={currentView === 'financeiro'} onClick={() => onChangeView('financeiro')} icon={Wallet} label="Tesouraria" visible={hasPermission('financeiro')} />
              <NavItem active={currentView === 'propostas'} onClick={() => onChangeView('propostas')} icon={FileText} label="Propostas" visible={hasPermission('propostas')} />
              <NavItem active={currentView === 'materiais'} onClick={() => onChangeView('materiais')} icon={Package} label="Materiais" visible={hasPermission('materiais')} />
              <NavItem active={currentView === 'clientes'} onClick={() => onChangeView('clientes')} icon={Briefcase} label="Clientes" visible={hasPermission('clientes')} />
              <NavItem active={currentView === 'rh'} onClick={() => onChangeView('rh')} icon={Users} label="RH" visible={hasPermission('rh')} />
              <NavItem active={currentView === 'configuracoes'} onClick={() => onChangeView('configuracoes')} icon={Settings} label="Definições" visible={hasPermission('configuracoes')} />
            </nav>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex flex-col items-end mr-2 text-green-100">
                  <span className="text-[10px] font-black uppercase opacity-70 leading-none">{user?.role}</span>
                  <span className="text-sm font-bold leading-tight">{user?.name}</span>
              </div>
              <button onClick={toggleHelp} className="p-2 rounded-full text-green-100 hover:bg-green-600 transition-colors" title="Ajuda"><HelpCircle size={20} /></button>
              <button onClick={logout} className="p-2 rounded-full text-green-100 hover:bg-red-600 transition-colors" title="Sair do Sistema"><LogOut size={20} /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
              <div><span className="font-bold text-green-700">GestOs ERP</span> &copy; {new Date().getFullYear()}</div>
              <div className="flex items-center gap-4"><span>Versão {APP_VERSION}</span></div>
          </div>
      </footer>

      {isHelpOpen && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-20 z-40" onClick={toggleHelp}></div>
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l flex flex-col">
             <div className="flex items-center justify-between p-4 border-b bg-green-50">
                <h3 className="text-lg font-bold text-green-800 flex items-center gap-2"><HelpCircle size={20}/> Ajuda Contextual</h3>
                <button onClick={toggleHelp} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
             </div>
             <div className="p-6 overflow-y-auto flex-1 prose prose-sm prose-green max-w-none">
                {helpContent ? (
                   <><h2 className="text-xl font-bold text-gray-800 mb-4">{helpContent.title}</h2><div className="whitespace-pre-line text-gray-600" dangerouslySetInnerHTML={{ __html: helpContent.content }} /></>
                ) : (<p className="text-gray-500 italic">Nenhuma informação disponível.</p>)}
             </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Layout;
