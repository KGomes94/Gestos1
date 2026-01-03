
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import { FinancialHub } from './components/FinancialHub';
import { HRModule } from './components/HRModule';
import ProposalsModule from './components/ProposalsModule';
import { ScheduleModule } from './components/ScheduleModule';
import { EntitiesModule } from './components/EntitiesModule';
import { MaterialsModule } from './components/MaterialsModule';
import { SettingsModule } from './components/SettingsModule';
import LoadingScreen from './components/LoadingScreen';
import SyncOverlay from './components/SyncOverlay';
import DocumentModule from './components/DocumentModule';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary'; 
import { DevNotes } from './components/DevNotes';
import { ViewState, Transaction, Client, Material, Proposal, SystemSettings, BankTransaction, Employee, Invoice, Appointment, User, Account, RecurringContract, StockMovement, Purchase, RecurringPurchase } from './types';
import { db } from './services/db'; 
import { HelpProvider } from './contexts/HelpContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfirmationProvider } from './contexts/ConfirmationContext';
import { FlaskConical, RefreshCw, CheckCircle, UploadCloud, CloudOff } from 'lucide-react';

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
    enableTreasuryHardDelete: false, 
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
        repositoryCode: '2',
        allowManualInvoiceDate: false
    },
    trainingMode: false
};

function AppContent() {
  const { user, hasPermission, loading: authLoading } = useAuth();
  const { notify } = useNotification();
  
  const [isAppReady, setIsAppReady] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncState, setSyncState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [hasRecoveryPending, setHasRecoveryPending] = useState<boolean>(false);
  
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
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [recurringPurchases, setRecurringPurchases] = useState<RecurringPurchase[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [recurringContracts, setRecurringContracts] = useState<RecurringContract[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  useEffect(() => { db.setNotifier(notify); }, [notify]);
  
  // Listen to DB Sync Status
  useEffect(() => {
      db.onSyncChange((status) => setSyncState(status));
      // Pending count & local pending recovery
      try {
          setPendingCount(db.getPendingCount());
          setHasRecoveryPending(db.hasLocalPending());
          db.onPendingChange((c) => { setPendingCount(c); setHasRecoveryPending(db.hasLocalPending()); });
      } catch (e) { /* ignore in tests */ }
  }, []);

  const handleManualRefresh = async () => {
      setIsManualSyncing(true);
      await db.forceSync();
      const [_s, _c, _t, _cl, _m, _p, _e, _i, _a, _bt, _rc, _sm, _pur, _rp] = await Promise.all([
          db.settings.get(), db.categories.getAll(), db.transactions.getAll(), db.clients.getAll(),
          db.materials.getAll(), db.proposals.getAll(), db.employees.getAll(), db.invoices.getAll(),
          db.appointments.getAll(), db.bankTransactions.getAll(), db.recurringContracts.getAll(),
          db.stockMovements.getAll(), db.purchases.getAll(), db.recurringPurchases.getAll()
      ]);
      setSettings(prev => ({...prev, ..._s}));
      setCategories(_c); setTransactions(_t); setClients(_cl); setMaterials(_m);
      setProposals(_p); setEmployees(_e); setInvoices(_i); setAppointments(_a);
      setBankTransactions(_bt); setRecurringContracts(_rc); setStockMovements(_sm);
      setPurchases(_pur || []); setRecurringPurchases(_rp || []);
      
      setIsManualSyncing(false);
      notify('success', 'Dados atualizados da nuvem.');
  };

  useEffect(() => {
      if (!user) {
          setIsAppReady(false);
          setTransactions([]); setClients([]);
          setDataLoaded({ financial: false, invoicing: false, clients: false, hr: false, proposals: false, materials: false, agenda: false, settings: false });
      }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const bootSystem = async () => {
        try {
            const [_settings, _categories] = await Promise.all([ db.settings.get(), db.categories.getAll() ]);
            if (isMounted) {
                setSettings(prev => ({ ...SAFE_SETTINGS_DEFAULT, ..._settings }));
                setCategories(_categories || []);
                setIsAppReady(true);
            }
        } catch (error) { console.error("Core load failed", error); if (isMounted) setIsAppReady(true); }
    };
    bootSystem();
    return () => { isMounted = false; };
  }, [user]);

  // LAZY LOAD MODULES
  useEffect(() => {
      if (!user || !isAppReady) return;

      const loadModuleData = async () => {
          try {
              if (currentView === 'dashboard' && !dataLoaded.financial) {
                  const [_txs, _apps, _invs, _bankTx, _pur] = await Promise.all([
                      db.transactions.getAll(), db.appointments.getAll(), db.invoices.getAll(), db.bankTransactions.getAll(), db.purchases.getAll()
                  ]);
                  setTransactions(_txs || []); setAppointments(_apps || []); setInvoices(_invs || []); setBankTransactions(_bankTx || []); setPurchases(_pur || []);
                  setDataLoaded(prev => ({ ...prev, financial: true, agenda: true, invoicing: true }));
              }

              if (currentView === 'financeiro' && !dataLoaded.financial) {
                  const [_transactions, _bankTx, _clients, _invoices, _purchases, _materials, _contracts, _stock, _recPur] = await Promise.all([
                      db.transactions.getAll(), db.bankTransactions.getAll(), db.clients.getAll(), db.invoices.getAll(),
                      db.purchases.getAll(), db.materials.getAll(), db.recurringContracts.getAll(), db.stockMovements.getAll(),
                      db.recurringPurchases.getAll()
                  ]);
                  setTransactions(_transactions || []); setBankTransactions(_bankTx || []);
                  setClients(_clients || []); setInvoices(_invoices || []); setPurchases(_purchases || []);
                  setMaterials(_materials || []); setRecurringContracts(_contracts || []); setStockMovements(_stock || []);
                  setRecurringPurchases(_recPur || []);
                  setDataLoaded(prev => ({ ...prev, financial: true, clients: true, invoicing: true, materials: true }));
              }

              if (currentView === 'entidades' && !dataLoaded.clients) {
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
                  const [_apps, _clients, _emps] = await Promise.all([ db.appointments.getAll(), db.clients.getAll(), db.employees.getAll() ]);
                  setAppointments(_apps || []); setClients(_clients || []); setEmployees(_emps || []);
                  setDataLoaded(prev => ({ ...prev, agenda: true, clients: true, hr: true }));
              }
              if (currentView === 'materiais' && !dataLoaded.materials) {
                  const [_mat, _invs, _sm] = await Promise.all([ db.materials.getAll(), db.invoices.getAll(), db.stockMovements.getAll() ]);
                  setMaterials(_mat || []); setInvoices(_invs || []); setStockMovements(_sm || []);
                  setDataLoaded(prev => ({ ...prev, materials: true, invoicing: true }));
              }
              if (currentView === 'propostas' && !dataLoaded.proposals) {
                  const [_props, _clients, _mats] = await Promise.all([ db.proposals.getAll(), db.clients.getAll(), db.materials.getAll() ]);
                  setProposals(_props || []); setClients(_clients || []); setMaterials(_mats || []);
                  setDataLoaded(prev => ({ ...prev, proposals: true, clients: true, materials: true }));
              }
              if (currentView === 'configuracoes' && !dataLoaded.settings) {
                   const _users = await db.users.getAll();
                   const [_bankTxs, _trans, _emps, _apps, _invs, _pur] = await Promise.all([ db.bankTransactions.getAll(), db.transactions.getAll(), db.employees.getAll(), db.appointments.getAll(), db.invoices.getAll(), db.purchases.getAll() ]);
                   setUsersList(_users || []); setBankTransactions(_bankTxs || []); setTransactions(_trans || []); setEmployees(_emps || []); setAppointments(_apps || []); setInvoices(_invs || []); setPurchases(_pur || []);
                   setDataLoaded(prev => ({ ...prev, settings: true, financial: true, hr: true, agenda: true, invoicing: true }));
              }
          } catch (e) { console.error("Module load error", e); notify('error', 'Erro ao carregar módulo.'); }
      };
      loadModuleData();

      // BACKGROUND PRELOAD: clients and materials in idle time (non-blocking)
      let bgCancelled = false;
      const bgLoad = async () => {
          try {
              if (!dataLoaded.clients) {
                  const _clients = await db.clients.getAll();
                  if (!bgCancelled) { setClients(_clients || []); setDataLoaded(d => ({ ...d, clients: true })); }
              }
              if (!dataLoaded.materials) {
                  const _materials = await db.materials.getAll();
                  if (!bgCancelled) { setMaterials(_materials || []); setDataLoaded(d => ({ ...d, materials: true })); }
              }
          } catch (e) { console.warn('Background preload failed', e); }
      };

      if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => { bgLoad(); });
      } else {
          const t = setTimeout(() => bgLoad(), 1000);
          return () => { bgCancelled = true; clearTimeout(t); };
      }

      return () => { bgCancelled = true; };
  }, [currentView, user, isAppReady, dataLoaded]);

  // SYNC EFFECTS
  useEffect(() => {
      if (isAppReady && dataLoaded.financial && !settings.trainingMode) {
          setIsAutoSaving(true);
          db.transactions.save(transactions);
          db.bankTransactions.save(bankTransactions);
          db.purchases.save(purchases);
          db.recurringPurchases.save(recurringPurchases);
          setTimeout(() => setIsAutoSaving(false), 500);
      }
  }, [transactions, bankTransactions, purchases, recurringPurchases, isAppReady, dataLoaded.financial, settings.trainingMode]);

  useEffect(() => { if (isAppReady && dataLoaded.clients && !settings.trainingMode) { setIsAutoSaving(true); db.clients.save(clients); setTimeout(() => setIsAutoSaving(false), 500); } }, [clients, isAppReady, dataLoaded, settings.trainingMode]);
  useEffect(() => { if (isAppReady && dataLoaded.hr && !settings.trainingMode) { setIsAutoSaving(true); db.employees.save(employees); setTimeout(() => setIsAutoSaving(false), 500); } }, [employees, isAppReady, dataLoaded, settings.trainingMode]);
  useEffect(() => { if (isAppReady && dataLoaded.proposals && !settings.trainingMode) { setIsAutoSaving(true); db.proposals.save(proposals); setTimeout(() => setIsAutoSaving(false), 500); } }, [proposals, isAppReady, dataLoaded, settings.trainingMode]);
  useEffect(() => { if (isAppReady && dataLoaded.agenda && !settings.trainingMode) { setIsAutoSaving(true); db.appointments.save(appointments); setTimeout(() => setIsAutoSaving(false), 500); } }, [appointments, isAppReady, dataLoaded, settings.trainingMode]);
  useEffect(() => { if (isAppReady && dataLoaded.invoicing && !settings.trainingMode) { setIsAutoSaving(true); db.invoices.save(invoices); db.recurringContracts.save(recurringContracts); setTimeout(() => setIsAutoSaving(false), 500); } }, [invoices, recurringContracts, isAppReady, dataLoaded.invoicing, settings.trainingMode]);
  useEffect(() => { if (isAppReady && dataLoaded.materials && !settings.trainingMode) { setIsAutoSaving(true); db.materials.save(materials); db.stockMovements.save(stockMovements); setTimeout(() => setIsAutoSaving(false), 500); } }, [materials, stockMovements, isAppReady, dataLoaded, settings.trainingMode]);
  useEffect(() => { if (isAppReady && !settings.trainingMode) { db.settings.save(settings); db.categories.save(categories); } }, [settings, categories, isAppReady, settings.trainingMode]);

  if (authLoading) return <LoadingScreen message="A conectar ao Google Drive..." />;
  if (!user) return <Login />;
  if (!isAppReady) return <LoadingScreen message="A carregar a sua base de dados..." />;

  return (
    <>
        <SyncOverlay isVisible={isAutoSaving || isManualSyncing} />
        <div className="fixed bottom-20 right-4 z-[120] flex items-center gap-2">
            <button onClick={handleManualRefresh} disabled={isManualSyncing} className="bg-white/90 backdrop-blur shadow-lg border border-gray-200 rounded-full p-2 text-gray-500 hover:text-green-600 transition-all hover:rotate-180 disabled:animate-spin disabled:opacity-50" title="Sincronizar Agora"><RefreshCw size={20} /></button>
            
            {/* Status Sync Icon */}
            <div className={`transition-all duration-500 p-2 rounded-full shadow-lg border ${
                syncState === 'saved' ? 'bg-white text-green-600 border-green-200' :
                syncState === 'saving' ? 'bg-blue-50 text-blue-600 border-blue-200 animate-pulse' :
                'bg-red-50 text-red-600 border-red-200'
            }`} title={
                syncState === 'saved' ? "Todos as alterações salvas na nuvem" :
                syncState === 'saving' ? "A guardar alterações pendentes..." :
                "Erro ao guardar (Tentaremos novamente)"
            }>
                {syncState === 'saved' && <CheckCircle size={20} />}
                {syncState === 'saving' && <UploadCloud size={20} />}
                {syncState === 'error' && <CloudOff size={20} />}
            </div>

            {/* Pending count & local recovery */}
            {pendingCount > 0 && (
                <div className="ml-2 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-100 text-xs font-bold text-yellow-700 flex items-center gap-2">
                    <div>Salvamentos pendentes: <strong>{pendingCount}</strong></div>
                    {hasRecoveryPending && <button onClick={() => { notify('info', 'A recuperar alterações pendentes...'); db.recoverPending(); }} className="ml-2 px-2 py-1 bg-yellow-600 text-white rounded text-[11px]">Recuperar</button>}
                </div>
            )}
        </div>
        <DevNotes />
        {settings.trainingMode && <div className="bg-amber-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2 sticky top-0 z-[120]"><FlaskConical size={14}/> MODO DE TREINO / TESTE ATIVO - Alterações não serão salvas na nuvem</div>}
        
        <Layout currentView={currentView} onChangeView={setCurrentView}>
            {(() => {
                if (!hasPermission(currentView)) return <div className="p-12 text-center bg-white rounded-2xl shadow-sm"><h3 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h3><p className="text-gray-500">O seu perfil não tem permissão.</p><button onClick={() => setCurrentView('dashboard')} className="mt-6 bg-green-600 text-white px-6 py-2 rounded-xl font-bold">Voltar</button></div>;

                switch (currentView) {
                case 'dashboard': return <Dashboard transactions={transactions} settings={settings} onNavigate={setCurrentView} employees={employees} appointments={appointments} />;
                case 'financeiro': return <FinancialHub 
                                            settings={settings} categories={categories} onAddCategories={(c) => {}}
                                            transactions={transactions} setTransactions={setTransactions} 
                                            bankTransactions={bankTransactions} setBankTransactions={setBankTransactions} 
                                            invoices={invoices} setInvoices={setInvoices}
                                            purchases={purchases} setPurchases={setPurchases}
                                            clients={clients} setClients={setClients}
                                            materials={materials} setMaterials={setMaterials}
                                            recurringContracts={recurringContracts} setRecurringContracts={setRecurringContracts}
                                            stockMovements={stockMovements} setStockMovements={setStockMovements}
                                            recurringPurchases={recurringPurchases} setRecurringPurchases={setRecurringPurchases}
                                          />;
                case 'entidades': return <EntitiesModule clients={clients} setClients={setClients} />;
                case 'rh': return <HRModule employees={employees} setEmployees={setEmployees} />;
                case 'propostas': return <ProposalsModule clients={clients} setClients={setClients} materials={materials} proposals={proposals} setProposals={setProposals} settings={settings} autoOpenId={pendingProposalOpenId} onClearAutoOpen={() => setPendingProposalOpenId(null)} />;
                case 'materiais': return <MaterialsModule materials={materials} setMaterials={setMaterials} invoices={invoices} stockMovements={stockMovements} setStockMovements={setStockMovements} />;
                case 'documentos': return <DocumentModule />;
                case 'agenda': return <ScheduleModule clients={clients} setClients={setClients} employees={employees} proposals={proposals} onNavigateToProposal={(id) => { setPendingProposalOpenId(id); setCurrentView('propostas'); }} appointments={appointments} setAppointments={setAppointments} setInvoices={setInvoices} setTransactions={setTransactions} settings={settings} />;
                case 'configuracoes': return <SettingsModule 
                                                settings={settings} setSettings={setSettings} categories={categories} setCategories={setCategories} 
                                                transactions={transactions} clients={clients} materials={materials} proposals={proposals} usersList={usersList} 
                                                setTransactions={setTransactions} setClients={setClients} setMaterials={setMaterials} setProposals={setProposals} setUsersList={setUsersList}
                                                bankTransactions={bankTransactions} setBankTransactions={setBankTransactions}
                                                employees={employees} appointments={appointments} invoices={invoices}
                                            />;
                default: return <Dashboard transactions={transactions} settings={settings} onNavigate={setCurrentView} employees={employees} appointments={appointments} />;
                }
            })()}
        </Layout>
    </>
  );
}

export default function App() { return <ErrorBoundary><NotificationProvider><HelpProvider><AuthProvider><ConfirmationProvider><AppContent /></ConfirmationProvider></AuthProvider></HelpProvider></NotificationProvider></ErrorBoundary>; }
