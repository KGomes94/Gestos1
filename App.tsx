
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
  
  // App States
  const [isAppReady, setIsAppReady] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  // Lazy Loading Flags (Prevent re-fetching)
  const [dataLoaded, setDataLoaded] = useState({
      financial: false,
      invoicing: false,
      clients: false,
      hr: false,
      proposals: false,
      materials: false,
      agenda: false,
      settings: false
  });

  const [pendingProposalOpenId, setPendingProposalOpenId] = useState<string | null>(null);
  
  // Data States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [categories, setCategories] = useState<Account[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(db.settings.get() as any); 
  const [materials, setMaterials] = useState<Material[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [recurringContracts, setRecurringContracts] = useState<RecurringContract[]>([]);

  // Cleanup on Logout
  useEffect(() => {
      if (!user) {
          setIsAppReady(false);
          setTransactions([]);
          setClients([]);
          setDataLoaded({
              financial: false, invoicing: false, clients: false, hr: false, 
              proposals: false, materials: false, agenda: false, settings: false
          });
      }
  }, [user]);

  // INITIAL LOAD: Only Core Data (Settings, Categories, Users)
  useEffect(() => {
    if (!user) return;

    const loadCoreData = async () => {
        try {
            const [_settings, _categories, _users] = await Promise.all([
                db.settings.get(),
                db.categories.getAll(),
                db.users.getAll()
            ]);
            
            setSettings(_settings);
            setCategories(_categories);
            setUsersList(_users);
            
            // Immediately ready after core data
            setIsAppReady(true); 
        } catch (error) {
            console.error("Core load failed", error);
            notify('error', 'Erro ao carregar sistema base.');
            setIsAppReady(true);
        }
    };

    loadCoreData();
  }, [user]);

  // LAZY LOAD: Fetch module specific data when switching views
  useEffect(() => {
      if (!user || !isAppReady) return;

      const loadModuleData = async () => {
          try {
              // Dashboard needs some data to show charts, so we might need a "lite" fetch or just fetch basic modules
              if (currentView === 'dashboard' && !dataLoaded.financial) {
                  // Pre-load essential stats data
                  const [_txs, _apps, _invs] = await Promise.all([
                      db.transactions.getAll(500), // Limit dashboard to last 500
                      db.appointments.getAll(),
                      db.invoices.getAll()
                  ]);
                  setTransactions(_txs);
                  setAppointments(_apps);
                  setInvoices(_invs);
                  setDataLoaded(prev => ({ ...prev, financial: true, agenda: true, invoicing: true }));
              }

              if (currentView === 'financeiro' && !dataLoaded.financial) {
                  const [_transactions, _bankTx, _clients] = await Promise.all([
                      db.transactions.getAll(),
                      db.bankTransactions.getAll(),
                      db.clients.getAll()
                  ]);
                  setTransactions(_transactions);
                  setBankTransactions(_bankTx);
                  setClients(_clients); // Needed for names
                  setDataLoaded(prev => ({ ...prev, financial: true, clients: true }));
              }

              if (currentView === 'faturacao' && !dataLoaded.invoicing) {
                  const [_invoices, _clients, _materials] = await Promise.all([
                      db.invoices.getAll(),
                      db.clients.getAll(),
                      db.materials.getAll()
                  ]);
                  setInvoices(_invoices);
                  setClients(_clients);
                  setMaterials(_materials);
                  setDataLoaded(prev => ({ ...prev, invoicing: true, clients: true, materials: true }));
              }

              if (currentView === 'clientes' && !dataLoaded.clients) {
                  const _clients = await db.clients.getAll();
                  setClients(_clients);
                  setDataLoaded(prev => ({ ...prev, clients: true }));
              }

              if (currentView === 'rh' && !dataLoaded.hr) {
                  const _emp = await db.employees.getAll();
                  setEmployees(_emp);
                  setDataLoaded(prev => ({ ...prev, hr: true }));
              }

              if (currentView === 'agenda' && !dataLoaded.agenda) {
                  const [_apps, _clients, _emps] = await Promise.all([
                      db.appointments.getAll(),
                      db.clients.getAll(),
                      db.employees.getAll()
                  ]);
                  setAppointments(_apps);
                  setClients(_clients);
                  setEmployees(_emps);
                  setDataLoaded(prev => ({ ...prev, agenda: true, clients: true, hr: true }));
              }

              if (currentView === 'materiais' && !dataLoaded.materials) {
                  const _mat = await db.materials.getAll();
                  setMaterials(_mat);
                  setDataLoaded(prev => ({ ...prev, materials: true }));
              }

              // CORREÇÃO AQUI: 'proposals' alterado para 'propostas' para coincidir com ViewState
              if (currentView === 'propostas' && !dataLoaded.proposals) {
                  const [_props, _clients, _mats] = await Promise.all([
                      db.proposals.getAll(),
                      db.clients.getAll(),
                      db.materials.getAll()
                  ]);
                  setProposals(_props);
                  setClients(_clients);
                  setMaterials(_mats);
                  setDataLoaded(prev => ({ ...prev, proposals: true, clients: true, materials: true }));
              }

          } catch (e) {
              console.error("Module load error", e);
              notify('error', 'Erro ao carregar dados do módulo.');
          }
      };

      loadModuleData();
  }, [currentView, user, isAppReady, dataLoaded]);

  // Auto-Save Effect (Hybrid: Updates DB)
  // Simplified to only save what changed, but keeping centralized for now
  useEffect(() => {
    if (!isAppReady || !user) return;
    setIsAutoSaving(true);
    
    const saveAll = async () => {
        if (settings.trainingMode) return;
        
        try {
            // Only save what might have changed based on current view context
            // In a real app, save should be triggered by actions, not global interval
            // Keeping lightweight check here
            if (currentView === 'configuracoes') await db.settings.save(settings);
            
            // Other modules usually save immediately on action (saveOne)
            // But we keep this for consistency with previous architecture if bulk edits happened
        } catch (e) {
            console.error("Auto-save error", e);
        } finally {
            setIsAutoSaving(false);
        }
    };

    const timeout = setTimeout(saveAll, 3000); 
    return () => clearTimeout(timeout);
  }, [settings, isAppReady, user, currentView]);

  if (authLoading) {
      return <LoadingScreen onFinished={() => {}} />;
  }

  if (!user) {
      return <Login />;
  }

  return (
    <>
      {!isAppReady && <LoadingScreen onFinished={() => {}} />}
      <SyncOverlay isVisible={isAutoSaving} />
      {settings.trainingMode && (
          <div className="bg-amber-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2 sticky top-0 z-[120]">
              <FlaskConical size={14}/> MODO DE TREINO / TESTE ATIVO - Alterações não serão salvas na nuvem
          </div>
      )}
      {isAppReady && (
          <Layout currentView={currentView} onChangeView={setCurrentView}>
            {(() => {
                if (!hasPermission(currentView)) {
                    return <div className="p-12 text-center bg-white rounded-2xl shadow-sm"><h3 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h3><p className="text-gray-500">O seu perfil de utilizador não tem permissão para aceder a este módulo.</p><button onClick={() => setCurrentView('dashboard')} className="mt-6 bg-green-600 text-white px-6 py-2 rounded-xl font-bold">Voltar ao Painel</button></div>;
                }

                switch (currentView) {
                  case 'dashboard': return <Dashboard transactions={transactions} settings={settings} onNavigate={setCurrentView} employees={employees} appointments={appointments} />;
                  case 'financeiro': return <FinancialModule target={settings.monthlyTarget} settings={settings} categories={categories} onAddCategories={(c) => {}} transactions={transactions} setTransactions={setTransactions} bankTransactions={bankTransactions} setBankTransactions={setBankTransactions} clients={clients} />;
                  case 'faturacao': return <InvoicingModule clients={clients} setClients={setClients} materials={materials} setMaterials={setMaterials} settings={settings} setTransactions={setTransactions} invoices={invoices || []} setInvoices={setInvoices} recurringContracts={recurringContracts || []} setRecurringContracts={setRecurringContracts} bankTransactions={bankTransactions} setBankTransactions={setBankTransactions} />;
                  case 'clientes': return <ClientsModule clients={clients} setClients={setClients} />;
                  case 'rh': return <HRModule employees={employees} setEmployees={setEmployees} />;
                  case 'propostas': return <ProposalsModule clients={clients} setClients={setClients} materials={materials} proposals={proposals} setProposals={setProposals} settings={settings} autoOpenId={pendingProposalOpenId} onClearAutoOpen={() => setPendingProposalOpenId(null)} />;
                  case 'materiais': return <MaterialsModule materials={materials} setMaterials={setMaterials} />;
                  case 'documentos': return <DocumentModule />;
                  case 'agenda': return <ScheduleModule clients={clients} employees={employees} proposals={proposals} onNavigateToProposal={(id) => { setPendingProposalOpenId(id); setCurrentView('propostas'); }} appointments={appointments} setAppointments={setAppointments} setInvoices={setInvoices} setTransactions={setTransactions} settings={settings} />;
                  case 'configuracoes': return <SettingsModule settings={settings} setSettings={setSettings} categories={categories} setCategories={setCategories} transactions={transactions} clients={clients} materials={materials} proposals={proposals} usersList={usersList} setTransactions={setTransactions} setClients={setClients} setMaterials={setMaterials} setProposals={setProposals} setUsersList={setUsersList} />;
                  default: return <Dashboard transactions={transactions} settings={settings} onNavigate={setCurrentView} employees={employees} appointments={appointments} />;
                }
            })()}
          </Layout>
      )}
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
