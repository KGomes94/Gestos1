
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
import { ViewState, Transaction, Client, Material, Proposal, SystemSettings, BankTransaction, Employee, Invoice, Appointment, User, Account, RecurringContract } from './types';
import { db } from './services/db'; 
import { HelpProvider } from './contexts/HelpContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './services/supabase';
import { FlaskConical } from 'lucide-react';

function AppContent() {
  const { user, hasPermission, loading: authLoading } = useAuth();
  const { notify } = useNotification();
  const [isAppReady, setIsAppReady] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [pendingProposalOpenId, setPendingProposalOpenId] = useState<string | null>(null);
  
  // Data States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  // States from LocalStorage (Sync legacy)
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(() => db.bankTransactions.getAll());
  const [categories, setCategories] = useState<Account[]>(() => db.categories.getAll());
  const [settings, setSettings] = useState<SystemSettings>(() => db.settings.get()); 
  const [materials, setMaterials] = useState<Material[]>(() => db.materials.getAll());
  const [proposals, setProposals] = useState<Proposal[]>(() => db.proposals.getAll());
  const [employees, setEmployees] = useState<Employee[]>(() => db.employees.getAll());
  const [invoices, setInvoices] = useState<Invoice[]>(() => db.invoices.getAll());
  const [appointments, setAppointments] = useState<Appointment[]>(() => db.appointments.getAll());
  const [usersList, setUsersList] = useState<User[]>([]);
  const [recurringContracts, setRecurringContracts] = useState<RecurringContract[]>(() => db.recurringContracts.getAll());

  // Load Async Data (Phase 1 Persistence)
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
        try {
            // Paralelizar carregamento
            const [loadedTransactions, loadedClients, loadedUsers] = await Promise.all([
                db.transactions.getAll(),
                db.clients.getAll(),
                db.users.getAll()
            ]);
            
            setTransactions(loadedTransactions);
            setClients(loadedClients);
            setUsersList(loadedUsers);
            
            // Simular delay para UX
            setTimeout(() => setIsAppReady(true), 500);
        } catch (error) {
            console.error("Falha ao carregar dados:", error);
            notify('error', 'Erro de conexão ao carregar dados.');
            setIsAppReady(true); // Permitir entrar mesmo com erro (offline mode logic futura)
        }
    };

    loadData();
  }, [user]);

  // Auto-Save Effect (Hybrid: Local for some, Supabase Direct for others)
  useEffect(() => {
    if (!isAppReady || !user) return;
    setIsAutoSaving(true);
    
    // Save Legacy LocalStorage Data
    db.bankTransactions.save(bankTransactions); 
    db.materials.save(materials);
    db.proposals.save(proposals);
    db.employees.save(employees);
    db.categories.save(categories); 
    db.settings.save(settings);
    db.invoices.save(invoices);
    db.appointments.save(appointments);
    db.users.save(usersList);
    db.recurringContracts.save(recurringContracts);

    // Save Supabase Data (Optimistic UI handled in components, this is mostly fallback)
    // Na arquitetura real, cada Save deve ser individual no componente. 
    // Aqui mantemos apenas o timeout para o indicador visual.
    
    const timeout = setTimeout(() => {
        setIsAutoSaving(false);
    }, 1000); 

    return () => clearTimeout(timeout);
  }, [bankTransactions, materials, proposals, employees, categories, settings, invoices, appointments, usersList, recurringContracts, isAppReady, user]);

  if (authLoading) {
      return <LoadingScreen onFinished={() => {}} />;
  }

  if (!user) {
      return <Login />;
  }

  const renderView = () => {
    if (!hasPermission(currentView)) {
        return <div className="p-12 text-center bg-white rounded-2xl shadow-sm"><h3 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h3><p className="text-gray-500">O seu perfil de utilizador não tem permissão para aceder a este módulo.</p><button onClick={() => setCurrentView('dashboard')} className="mt-6 bg-green-600 text-white px-6 py-2 rounded-xl font-bold">Voltar ao Painel</button></div>;
    }

    switch (currentView) {
      case 'dashboard': return <Dashboard transactions={transactions} settings={settings} onNavigate={setCurrentView} />;
      case 'financeiro': return <FinancialModule target={settings.monthlyTarget} settings={settings} categories={categories} onAddCategories={(c) => {}} transactions={transactions} setTransactions={setTransactions} bankTransactions={bankTransactions} setBankTransactions={setBankTransactions} clients={clients} />;
      case 'faturacao': return <InvoicingModule clients={clients} setClients={setClients} materials={materials} setMaterials={setMaterials} settings={settings} setTransactions={setTransactions} invoices={invoices || []} setInvoices={setInvoices} recurringContracts={recurringContracts || []} setRecurringContracts={setRecurringContracts} bankTransactions={bankTransactions} setBankTransactions={setBankTransactions} />;
      case 'clientes': return <ClientsModule clients={clients} setClients={setClients} />;
      case 'rh': return <HRModule employees={employees} setEmployees={setEmployees} />;
      case 'propostas': return <ProposalsModule clients={clients} setClients={setClients} materials={materials} proposals={proposals} setProposals={setProposals} settings={settings} autoOpenId={pendingProposalOpenId} onClearAutoOpen={() => setPendingProposalOpenId(null)} />;
      case 'materiais': return <MaterialsModule materials={materials} setMaterials={setMaterials} />;
      case 'documentos': return <DocumentModule />;
      case 'agenda': return <ScheduleModule clients={clients} employees={employees} proposals={proposals} onNavigateToProposal={(id) => { setPendingProposalOpenId(id); setCurrentView('propostas'); }} appointments={appointments} setAppointments={setAppointments} setInvoices={setInvoices} setTransactions={setTransactions} settings={settings} />;
      case 'configuracoes': return <SettingsModule settings={settings} setSettings={setSettings} categories={categories} setCategories={setCategories} transactions={transactions} clients={clients} materials={materials} proposals={proposals} usersList={usersList} setTransactions={setTransactions} setClients={setClients} setMaterials={setMaterials} setProposals={setProposals} setUsersList={setUsersList} />;
      default: return <Dashboard transactions={transactions} settings={settings} onNavigate={setCurrentView} />;
    }
  };

  return (
    <>
      {!isAppReady && <LoadingScreen onFinished={() => {}} />}
      <SyncOverlay isVisible={isAutoSaving} />
      {settings.trainingMode && (
          <div className="bg-amber-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2 sticky top-0 z-[120]">
              <FlaskConical size={14}/> MODO DE TREINO / TESTE ATIVO - Alterações não serão salvas na nuvem
          </div>
      )}
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
