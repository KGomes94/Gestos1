
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
import { ViewState, Transaction, Client, Material, Proposal, SystemSettings, BankTransaction, Employee, Invoice, Appointment, User } from './types';
import { db } from './services/db'; 
import { HelpProvider } from './contexts/HelpContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './services/supabase';

function AppContent() {
  const { user, hasPermission } = useAuth();
  const [isAppReady, setIsAppReady] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [pendingProposalOpenId, setPendingProposalOpenId] = useState<string | null>(null);
  
  // Initialize state from LocalStorage (fast/offline access)
  const [transactions, setTransactions] = useState<Transaction[]>(() => db.transactions.getAll());
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(() => db.bankTransactions.getAll());
  const [categories, setCategories] = useState<string[]>(() => db.categories.getAll());
  const [settings, setSettings] = useState<SystemSettings>(() => db.settings.get()); 
  const [clients, setClients] = useState<Client[]>(() => db.clients.getAll());
  const [materials, setMaterials] = useState<Material[]>(() => db.materials.getAll());
  const [proposals, setProposals] = useState<Proposal[]>(() => db.proposals.getAll());
  const [employees, setEmployees] = useState<Employee[]>(() => db.employees.getAll());
  const [invoices, setInvoices] = useState<Invoice[]>(() => db.invoices.getAll());
  const [appointments, setAppointments] = useState<Appointment[]>(() => db.appointments.getAll());
  const [usersList, setUsersList] = useState<User[]>(() => db.users.getAll());

  // Cloud Sync on Mount
  useEffect(() => {
    const initializeData = async () => {
      if (isSupabaseConfigured()) {
        console.log("Syncing with Cloud Database...");
        const success = await db.cloud.pull();
        if (success) {
            // Refresh state from updated storage (Critical: ensures deleted cloud records are removed locally)
            setTransactions(db.transactions.getAll());
            setBankTransactions(db.bankTransactions.getAll());
            setClients(db.clients.getAll());
            setMaterials(db.materials.getAll());
            setProposals(db.proposals.getAll());
            setEmployees(db.employees.getAll());
            setInvoices(db.invoices.getAll());
            setAppointments(db.appointments.getAll());
            setSettings(db.settings.get());
            setCategories(db.categories.getAll());
            setUsersList(db.users.getAll());
        }
      }
      setIsAppReady(true);
    };
    
    // Slight delay to allow LoadingScreen to render
    if (user) {
        setTimeout(initializeData, 100);
    } else {
        setIsAppReady(true);
    }
  }, [user]);

  // Auto-Save Effect (Local + Cloud)
  useEffect(() => {
    if (!isAppReady || !user) return;
    setIsAutoSaving(true);
    
    // Save to LocalStorage
    db.transactions.save(transactions);
    db.bankTransactions.save(bankTransactions); 
    db.clients.save(clients);
    db.materials.save(materials);
    db.proposals.save(proposals);
    db.employees.save(employees);
    db.categories.save(categories); 
    db.settings.save(settings);
    db.invoices.save(invoices);
    db.appointments.save(appointments);
    db.users.save(usersList);

    // Debounced Cloud Push
    const timeout = setTimeout(() => {
        if (isSupabaseConfigured()) {
            db.cloud.push('gestos_db_transactions', transactions);
            db.cloud.push('gestos_db_bank_transactions', bankTransactions);
            db.cloud.push('gestos_db_clients', clients);
            db.cloud.push('gestos_db_materials', materials);
            db.cloud.push('gestos_db_invoices', invoices);
            db.cloud.push('gestos_db_employees', employees);
            db.cloud.push('gestos_db_proposals', proposals);
            db.cloud.push('gestos_db_appointments', appointments);
            db.cloud.push('gestos_db_users', usersList);
            db.cloud.pushSettings(settings);
        }
        setIsAutoSaving(false);
    }, 2000); // 2s debounce for cloud to save bandwidth

    return () => clearTimeout(timeout);
  }, [transactions, bankTransactions, clients, materials, proposals, employees, categories, settings, invoices, appointments, usersList, isAppReady, user]);

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
      case 'faturacao': return <InvoicingModule clients={clients} materials={materials} settings={settings} setTransactions={setTransactions} invoices={invoices} setInvoices={setInvoices} />;
      case 'clientes': return <ClientsModule clients={clients} setClients={setClients} />;
      case 'rh': return <HRModule employees={employees} setEmployees={setEmployees} />;
      case 'propostas': return <ProposalsModule clients={clients} setClients={setClients} materials={materials} proposals={proposals} setProposals={setProposals} settings={settings} autoOpenId={pendingProposalOpenId} onClearAutoOpen={() => setPendingProposalOpenId(null)} />;
      case 'materiais': return <MaterialsModule materials={materials} setMaterials={setMaterials} />;
      case 'documentos': return <DocumentModule />;
      case 'agenda': return <ScheduleModule clients={clients} employees={employees} proposals={proposals} onNavigateToProposal={(id) => { setPendingProposalOpenId(id); setCurrentView('propostas'); }} appointments={appointments} setAppointments={setAppointments} />;
      case 'configuracoes': return <SettingsModule settings={settings} setSettings={setSettings} categories={categories} setCategories={setCategories} transactions={transactions} clients={clients} materials={materials} proposals={proposals} usersList={usersList} setTransactions={setTransactions} setClients={setClients} setMaterials={setMaterials} setProposals={setProposals} setUsersList={setUsersList} />;
      default: return <Dashboard transactions={transactions} settings={settings} onNavigate={setCurrentView} />;
    }
  };

  return (
    <>
      {!isAppReady && <LoadingScreen onFinished={() => {}} />}
      <SyncOverlay isVisible={isAutoSaving} />
      {isAppReady && <Layout currentView={currentView} onChangeView={setCurrentView}>{renderView()}</Layout>}
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
