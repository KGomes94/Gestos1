
import React, { useState } from 'react';
import { LayoutDashboard, Wallet, Users, FileText, Calendar, Settings, LogOut, Briefcase, Package, HelpCircle, X, Menu } from 'lucide-react';
import { ViewState } from '../types';
import { useHelp } from '../contexts/HelpContext';
import { useAuth } from '../contexts/AuthContext';

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
  visible,
  mobile = false
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: any; 
  label: string; 
  visible: boolean;
  mobile?: boolean;
}) => {
    if (!visible) return null;
    return (
        <button
            onClick={onClick}
            title={label}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors text-sm font-medium w-full md:w-auto ${
            active 
                ? 'bg-green-800 text-white' 
                : 'text-green-100 hover:bg-green-700 hover:text-white'
            } ${mobile ? 'justify-start py-3 text-base' : ''}`}
        >
            <Icon size={mobile ? 20 : 18} />
            <span>{label}</span>
        </button>
    );
};

const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView }) => {
  const { toggleHelp, isHelpOpen, helpContent } = useHelp();
  const { user, logout, hasPermission } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const APP_VERSION = "2.2.0-Finance"; 

  const handleNavClick = (view: ViewState) => {
      onChangeView(view);
      setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative overflow-x-hidden">
      <header className="bg-green-700 text-white shadow-md z-30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo & Mobile Menu Button */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-green-100 hover:bg-green-600 focus:outline-none"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              
              <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => handleNavClick('dashboard')}>
                <div className="bg-white text-green-700 font-bold px-2 py-1 rounded text-xl tracking-tighter">GestOs</div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1 items-center justify-center flex-1 mx-4 overflow-x-auto scrollbar-hide">
              <NavItem active={currentView === 'dashboard'} onClick={() => handleNavClick('dashboard')} icon={LayoutDashboard} label="Dashboard" visible={true} />
              
              {/* NOVO MODULO FINANCEIRO (Agrupa Tesouraria e Faturação) */}
              <NavItem active={currentView === 'financeiro'} onClick={() => handleNavClick('financeiro')} icon={Wallet} label="Financeiro" visible={hasPermission('financeiro')} />
              
              <NavItem active={currentView === 'agenda'} onClick={() => handleNavClick('agenda')} icon={Calendar} label="Agenda" visible={hasPermission('agenda')} />
              <NavItem active={currentView === 'propostas'} onClick={() => handleNavClick('propostas')} icon={FileText} label="Propostas" visible={hasPermission('propostas')} />
              <NavItem active={currentView === 'materiais'} onClick={() => handleNavClick('materiais')} icon={Package} label="Catálogo" visible={hasPermission('materiais')} />
              
              {/* RENOMEADO DE CLIENTES PARA ENTIDADES */}
              <NavItem active={currentView === 'entidades'} onClick={() => handleNavClick('entidades')} icon={Briefcase} label="Entidades" visible={hasPermission('clientes')} />
              
              <NavItem active={currentView === 'rh'} onClick={() => handleNavClick('rh')} icon={Users} label="RH" visible={hasPermission('rh')} />
              <NavItem active={currentView === 'configuracoes'} onClick={() => handleNavClick('configuracoes')} icon={Settings} label="Definições" visible={hasPermission('configuracoes')} />
            </nav>

            {/* User Actions */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden sm:flex flex-col items-end mr-2 text-green-100">
                  <span className="text-[10px] font-black uppercase opacity-70 leading-none">{user?.role}</span>
                  <span className="text-sm font-bold leading-tight truncate max-w-[100px]">{user?.name?.split(' ')[0]}</span>
              </div>
              <button onClick={toggleHelp} className="p-2 rounded-full text-green-100 hover:bg-green-600 transition-colors" title="Ajuda"><HelpCircle size={20} /></button>
              <button onClick={logout} className="p-2 rounded-full text-green-100 hover:bg-red-600 transition-colors" title="Sair"><LogOut size={20} /></button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
            <div className="md:hidden absolute top-16 left-0 w-full bg-green-800 shadow-xl border-t border-green-600 animate-fade-in-up z-40 max-h-[calc(100vh-64px)] overflow-y-auto">
                <div className="px-4 py-4 space-y-2">
                    <div className="flex items-center gap-3 px-3 py-3 mb-4 bg-green-900/50 rounded-lg">
                        <div className="bg-green-100 text-green-800 w-10 h-10 rounded-full flex items-center justify-center font-bold">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <p className="font-bold text-white">{user?.name}</p>
                            <p className="text-xs text-green-300 uppercase">{user?.role}</p>
                        </div>
                    </div>
                    
                    <NavItem mobile active={currentView === 'dashboard'} onClick={() => handleNavClick('dashboard')} icon={LayoutDashboard} label="Dashboard" visible={true} />
                    <NavItem mobile active={currentView === 'financeiro'} onClick={() => handleNavClick('financeiro')} icon={Wallet} label="Financeiro" visible={hasPermission('financeiro')} />
                    <NavItem mobile active={currentView === 'agenda'} onClick={() => handleNavClick('agenda')} icon={Calendar} label="Agenda" visible={hasPermission('agenda')} />
                    <NavItem mobile active={currentView === 'propostas'} onClick={() => handleNavClick('propostas')} icon={FileText} label="Propostas" visible={hasPermission('propostas')} />
                    <NavItem mobile active={currentView === 'materiais'} onClick={() => handleNavClick('materiais')} icon={Package} label="Catálogo" visible={hasPermission('materiais')} />
                    <NavItem mobile active={currentView === 'entidades'} onClick={() => handleNavClick('entidades')} icon={Briefcase} label="Entidades" visible={hasPermission('clientes')} />
                    <NavItem mobile active={currentView === 'rh'} onClick={() => handleNavClick('rh')} icon={Users} label="RH" visible={hasPermission('rh')} />
                    <NavItem mobile active={currentView === 'configuracoes'} onClick={() => handleNavClick('configuracoes')} icon={Settings} label="Definições" visible={hasPermission('configuracoes')} />
                </div>
            </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500 gap-2">
              <div className="text-center md:text-left"><span className="font-bold text-green-700">GestOs ERP</span> &copy; {new Date().getFullYear()}</div>
              <div className="flex items-center gap-4"><span>v{APP_VERSION}</span></div>
          </div>
      </footer>

      {isHelpOpen && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-20 z-[60]" onClick={toggleHelp}></div>
          <div className="fixed inset-y-0 right-0 z-[70] w-full max-w-md bg-white shadow-2xl border-l flex flex-col animate-fade-in-left">
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
