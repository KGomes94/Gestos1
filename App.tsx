
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import { FinancialModule } from './components/FinancialModule';
import HRModule from './components/HRModule';
import ProposalsModule from './components/ProposalsModule';
import ScheduleModule from './components/ScheduleModule';
import ClientsModule from './components/ClientsModule';
import MaterialsModule from './components/MaterialsModule';
import SettingsModule from './components/SettingsModule';
import InvoicingModule from './components/InvoicingModule';
import LoadingScreen from './components/LoadingScreen';
import SyncOverlay from './components/SyncOverlay';
import DocumentModule from './components/DocumentModule';
import Login from './components/Login';
import { ViewState, Transaction, Client, Material, Proposal, SystemSettings, BankTransaction, Employee, Invoice } from './types';
import { db } from './services/db'; 
import { HelpProvider } from './contexts/HelpContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function AppContent() {
  const { user, hasPermission } = useAuth();
  const [isAppReady, setIsAppReady] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [pendingProposalOpenId, setPendingProposalOpenId] = useState<string | null>(null);
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => db.transactions.getAll());
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(() => db.bankTransactions.getAll());
  const [categories, setCategories] = useState<string[]>(() => db.categories.getAll());
  const [settings, setSettings] = useState<SystemSettings>(() => db.settings.get()); 
  const [clients, setClients] = useState<Client[]>(() => db.clients.getAll());
  const [materials, setMaterials] = useState<Material[]>(() => db.materials.getAll());
  const [proposals, setProposals] = useState<Proposal[]>(() => db.proposals.getAll());
  const [employees, setEmployees] = useState<Employee[]>(() => db.employees.getAll());
  const [invoices, setInvoices] = useState<Invoice[]>(() => db.invoices.getAll());

  useEffect(() => {
    if (!isAppReady || !user) return;
    setIsAutoSaving(true);
    db.transactions.save(transactions);
    db.bankTransactions.save(bankTransactions); 
    db.clients.save(clients);
    db.materials.save(materials);
    db.proposals.save(proposals);
    db.employees.save(employees);
    db.categories.save(categories); 
    db.settings.save(settings);
    db.invoices.save(invoices);
    const timeout = setTimeout(() => setIsAutoSaving(false), 1200); 
    return () => clearTimeout(timeout);
  }, [transactions, bankTransactions, clients, materials, proposals, employees, categories, settings, invoices, isAppReady, user]);

  if (!user) {
      return <Login />;
  }

  const renderView = () => {
    if (!hasPermission(currentView)) {
        return <div className="p-12 text-center bg-white rounded-2xl shadow-sm"><h3 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h3><p className="text-gray-500">O seu perfil de utilizador não tem permissão para aceder a este módulo.</p><button onClick={() => setCurrentView('dashboard')} className="mt-6 bg-green-600 text-white px-6 py-2 rounded-xl font-bold">Voltar ao Painel</button></div>;
    }

    switch (currentView) {
      case 'dashboard': return <Dashboard transactions={transactions} settings={settings} onNavigate={setCurrentView} />;
      case 'financeiro': return <FinancialModule target={settings.monthlyTarget} categories={categories} onAddCategories={(c) => setCategories(prev => [...prev, ...c])} transactions={transactions} setTransactions={setTransactions} bankTransactions={bankTransactions} setBankTransactions={setBankTransactions} clients={clients} />;
      case 'faturacao': return <InvoicingModule clients={clients} materials={materials} settings={settings} setTransactions={setTransactions} />;
      case 'clientes': return <ClientsModule clients={clients} setClients={setClients} />;
      case 'rh': return <HRModule employees={employees} setEmployees={setEmployees} />;
      case 'propostas': return <ProposalsModule clients={clients} setClients={setClients} materials={materials} proposals={proposals} setProposals={setProposals} settings={settings} autoOpenId={pendingProposalOpenId} onClearAutoOpen={() => setPendingProposalOpenId(null)} />;
      case 'materiais': return <MaterialsModule materials={materials} setMaterials={setMaterials} />;
      case 'documentos': return <DocumentModule />;
      case 'agenda': return <ScheduleModule clients={clients} employees={employees} proposals={proposals} onNavigateToProposal={(id) => { setPendingProposalOpenId(id); setCurrentView('propostas'); }} />;
      case 'configuracoes': return <SettingsModule settings={settings} setSettings={setSettings} categories={categories} setCategories={setCategories} transactions={transactions} clients={clients} materials={materials} proposals={proposals} setTransactions={setTransactions} setClients={setClients} setMaterials={setMaterials} setProposals={setProposals} />;
      default: return <Dashboard transactions={transactions} settings={settings} onNavigate={setCurrentView} />;
    }
  };

  return (
    <>
      {!isAppReady && <LoadingScreen onFinished={() => setIsAppReady(true)} />}
      <SyncOverlay isVisible={isAutoSaving} />
      <Layout currentView={currentView} onChangeView={setCurrentView}>{renderView()}</Layout>
    </>
  );
}

function App() {
  return (
    <NotificationProvider>
      <HelpProvider>
        <AuthProvider>
            <AppContent />
        </AuthProvider>
      </HelpProvider>
    </NotificationProvider>
  );
}
export default App;
