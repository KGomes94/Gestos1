
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
import ErrorBoundary from './components/ErrorBoundary'; // NEW
import { ViewState, Transaction, Client, Material, Proposal, SystemSettings, BankTransaction, Employee, Invoice, Appointment, User, Account, RecurringContract } from './types';
import { db } from './services/db'; 
import { HelpProvider } from './contexts/HelpContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FlaskConical } from 'lucide-react';

// Default Seguro para evitar crash inicial
const SAFE_SETTINGS_DEFAULT: SystemSettings = {
    companyName: 'Carregando...',
    companyNif: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    currency: 'CVE',
    defaultTaxRate: 15,
    defaultRetentionRate: 4,
    monthlyTarget: 0,
    reconciliationDateMargin: 3,
    reconciliationValueMargin: 0.1,
    paymentMethods: ['Dinheiro'],
    defaultProposalValidityDays: 15,
    defaultProposalNotes: '',
    serviceTypes: [],
    calendarStartHour: 8,
    calendarEndHour: 18,
    calendarInterval: 30,
    proposalLayout: {
        primaryColor: '#16a34a',
        secondaryColor: '#f0fdf4',
        backgroundStyle: 'clean',
        headerShape: 'rounded',
        showClientNif: true,
        showClientAddress: true,
        showTerms: true,
        showSignature: true,
        showValidity: true
    },
    fiscalConfig: {
        enabled: false,
        environment: 'sandbox',
        apiKey: '',
        clientId: '',
        clientSecret: '',
        invoiceSeries: 'A',
        nextInvoiceNumber: 1,
        issuerNif: '',
        ledCode: '',
        repositoryCode: '2'
    },
    trainingMode: false
};

function AppContent() {
  const { user, hasPermission, loading: authLoading } = useAuth();
  const { notify } = useNotification();
  
  // App States
  const [isAppReady, setIsAppReady] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  // Lazy Loading Flags
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
  const [settings, setSettings] = useState<SystemSettings>(SAFE_SETTINGS_DEFAULT); 
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

  // INITIAL LOAD: CRITICAL PATH
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const bootSystem = async () => {
        try {
            // 1. Tentar Cache Local primeiro (Instantâneo)
            const cachedSettings = db.cache.get(db.keys.SETTINGS, null);
            const cachedCats = db.cache.get(db.keys.ACCOUNTS, null);

            if (cachedSettings && cachedCats && isMounted) {
                setSettings({ ...SAFE_SETTINGS_DEFAULT, ...cachedSettings });
                setCategories(cachedCats);
                setIsAppReady(true); // Desbloqueia UI imediatamente
            }

            // 2. Buscar dados frescos (Background)
            const [_settings, _categories] = await Promise.all([
                db.settings.get(),
                db.categories.getAll()
            ]);
            
            if (isMounted) {
                // Merge seguro
                setSettings(prev => ({ ...SAFE_SETTINGS_DEFAULT, ..._settings }));
                setCategories(_categories || []);
                setIsAppReady(true); // Garante desbloqueio se cache falhou
            }
        } catch (error) {
            console.error("Critical Core load failed", error);
            // Em caso de erro catastrófico, permite entrar com defaults para não bloquear o user
            if (isMounted) setIsAppReady(true); 
        }
    };

    bootSystem();

    return () => { isMounted = false; };
  }, [user]);

  // LAZY LOAD: Fetch module specific data when switching views
  useEffect(() => {
      if (!user || !isAppReady) return;

      const loadModuleData = async () => {
          try {
              // Dashboard: Load Essentials
              if (currentView === 'dashboard' && !dataLoaded.financial) {
                  const [_txs, _apps, _invs] = await Promise.all([
                      db.transactions.getAll(500), 
                      db.appointments.getAll(),
                      db.invoices.getAll()
                  ]);
                  setTransactions(_txs || []);
                  setAppointments(_apps || []);
                  setInvoices(_invs || []);
                  setDataLoaded(prev => ({ ...prev, financial: true, agenda: true, invoicing: true }));
              }

              if (currentView === 'financeiro' && !dataLoaded.financial) {
                  const [_transactions, _bankTx, _clients] = await Promise.all([
                      db.transactions.getAll(),
                      db.bankTransactions.getAll(),
                      db.clients.getAll()
                  ]);
                  setTransactions(_transactions || []);
                  setBankTransactions(_bankTx || []);
                  setClients(_clients || []); 
                  setDataLoaded(prev => ({ ...prev, financial: true, clients: true }));
              }

              if (currentView === 'faturacao' && !dataLoaded.invoicing) {
                  const [_invoices, _clients, _materials] = await Promise.all([
                      db.invoices.getAll(),
                      db.clients.getAll(),
                      db.materials.getAll()
                  ]);
                  setInvoices(_invoices || []);
                  setClients(_clients || []);
                  setMaterials(_materials || []);
                  setDataLoaded(prev => ({ ...prev, invoicing: true, clients: true, materials: true }));
              }

              if (currentView === 'clientes' && !dataLoaded.clients) {
                  const _clients = await db.clients.getAll();
                  setClients(_clients || []);
                  setDataLoaded(prev => ({ ...prev, clients: true }));
              }

              if (currentView === 'rh' && !dataLoaded.hr) {
                  const _emp = await db.employees.getAll();
                  setEmployees(_emp || []);
                  setDataLoaded(prev => ({ ...prev, hr: true }));
              }

              if (currentView === 'agenda' && !dataLoaded.agenda) {
                  const [_apps, _clients, _emps] = await Promise.all([
                      db.appointments.getAll(),
                      db.clients.getAll(),
                      db.employees.getAll()
                  ]);
                  setAppointments(_apps || []);
                  setClients(_clients || []);
                  setEmployees(_emps || []);
                  setDataLoaded(prev => ({ ...prev, agenda: true, clients: true, hr: true }));
              }

              if (currentView === 'materiais' && !dataLoaded.materials) {
                  const _mat = await db.materials.getAll();
                  setMaterials(_mat || []);
                  setDataLoaded(prev => ({ ...prev, materials: true }));
              }

              if (currentView === 'propostas' && !dataLoaded.proposals) {
                  const [_props, _clients, _mats] = await Promise.all([
                      db.proposals.getAll(),
                      db.clients.getAll(),
                      db.materials.getAll()
                  ]);
                  setProposals(_props || []);
                  setClients(_clients || []);
                  setMaterials(_mats || []);
                  setDataLoaded(prev => ({ ...prev, proposals: true, clients: true, materials: true }));
              }
              
              if (currentView === 'configuracoes' && !dataLoaded.settings) {
                   const _users = await db.users.getAll();
                   setUsersList(_users || []);
                   setDataLoaded(prev => ({ ...prev, settings: true }));
              }

          } catch (e) {
              console.error("Module load error", e);
              notify('error', 'Erro ao carregar módulo. Verifique a sua conexão.');
          }
      };

      loadModuleData();
  }, [currentView, user, isAppReady, dataLoaded]);

  // Auto-Save Effect
  useEffect(() => {
    if (!isAppReady || !user) return;
    setIsAutoSaving(true);
    
    const saveAll = async () => {
        if (settings.trainingMode) return;
        try {
            if (currentView === 'configuracoes') await db.settings.save(settings);
        } catch (e) {
            console.error("Auto-save error", e);
        } finally {
            setIsAutoSaving(false);
        }
    };

    const timeout = setTimeout(saveAll, 3000); 
    return () => clearTimeout(timeout);
  }, [settings, isAppReady, user, currentView]);

  // 1. Auth Check
  if (authLoading) {
      return <LoadingScreen message="A autenticar..." />;
  }

  // 2. Login Screen
  if (!user) {
      return <Login />;
  }

  // 3. System Boot (Waiting for critical settings)
  if (!isAppReady) {
      return <LoadingScreen message="A carregar definições do sistema..." />;
  }

  // 4. Main App
  return (
    <ErrorBoundary>
      <SyncOverlay isVisible={isAutoSaving} />
      {settings.trainingMode && (
          <div className="bg-amber-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2 sticky top-0 z-[120]">
              <FlaskConical size={14}/> MODO DE TREINO / TESTE ATIVO - Alterações não serão salvas na nuvem
          </div>
      )}
      
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
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary>
        <NotificationProvider>
        <HelpProvider>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </HelpProvider>
        </NotificationProvider>
    </ErrorBoundary>
  );
}
export default App;
