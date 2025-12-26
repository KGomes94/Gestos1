
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
  const { user, hasPermission } = useAuth();
  const { notify } = useNotification();
  const [isAppReady, setIsAppReady] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [pendingProposalOpenId, setPendingProposalOpenId] = useState<string | null>(null);
  
  // Initialize state from LocalStorage (fast/offline access)
  const [transactions, setTransactions] = useState<Transaction[]>(() => db.transactions.getAll());
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(() => db.bankTransactions.getAll());
  const [categories, setCategories] = useState<Account[]>(() => db.categories.getAll());
  const [settings, setSettings] = useState<SystemSettings>(() => db.settings.get()); 
  const [clients, setClients] = useState<Client[]>(() => db.clients.getAll());
  const [materials, setMaterials] = useState<Material[]>(() => db.materials.getAll());
  const [proposals, setProposals] = useState<Proposal[]>(() => db.proposals.getAll());
  const [employees, setEmployees] = useState<Employee[]>(() => db.employees.getAll());
  const [invoices, setInvoices] = useState<Invoice[]>(() => db.invoices.getAll());
  const [appointments, setAppointments] = useState<Appointment[]>(() => db.appointments.getAll());
  const [usersList, setUsersList] = useState<User[]>(() => db.users.getAll());
  const [recurringContracts, setRecurringContracts] = useState<RecurringContract[]>(() => db.recurringContracts.getAll());

  // Cloud Sync on Mount
  useEffect(() => {
    const initializeData = async () => {
      // Check for Training Mode immediately to prevent overwriting local sandbox data
      const currentSettings = db.settings.get();
      if (currentSettings.trainingMode) {
          console.log("Training Mode Active: Skipping Cloud Pull");
          setSettings(currentSettings); // Ensure state matches
          setIsAppReady(true);
          return; 
      }

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
            setRecurringContracts(db.recurringContracts.getAll());
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

  // Recurring Invoice Engine
  useEffect(() => {
      if (!isAppReady || !user) return;

      const checkRecurringInvoices = () => {
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          let newInvoices: Invoice[] = [];
          let updatedContracts: RecurringContract[] = [];
          let generatedCount = 0;

          // Safe check if recurringContracts is an array
          const contracts = Array.isArray(recurringContracts) ? recurringContracts : [];

          contracts.forEach(contract => {
              if (contract.active && contract.nextRun <= todayStr) {
                  // Generate Invoice (Draft)
                  const num = db.invoices.getNextNumber(settings.fiscalConfig.invoiceSeries) + generatedCount;
                  const invDisplayId = `FTE ${settings.fiscalConfig.invoiceSeries}${today.getFullYear()}/${num.toString().padStart(3, '0')}`;
                  
                  const newInv: Invoice = {
                      id: invDisplayId,
                      internalId: num,
                      series: settings.fiscalConfig.invoiceSeries,
                      type: 'FTE',
                      typeCode: '01',
                      date: todayStr,
                      dueDate: todayStr, // Simplificação
                      clientId: contract.clientId,
                      clientName: contract.clientName,
                      clientNif: '', // Should fetch from clients list if available
                      clientAddress: '',
                      items: contract.items,
                      subtotal: contract.amount, // Simplified, ideally recalc items
                      taxTotal: 0, // Simplified
                      withholdingTotal: 0,
                      total: contract.amount,
                      status: 'Rascunho',
                      fiscalStatus: 'Pendente',
                      iud: '',
                      isRecurring: true,
                      notes: 'Avença gerada automaticamente'
                  };
                  newInvoices.push(newInv);
                  generatedCount++;

                  // Calculate next run date
                  const nextDate = new Date(contract.nextRun);
                  if (contract.frequency === 'Mensal') nextDate.setMonth(nextDate.getMonth() + 1);
                  else if (contract.frequency === 'Trimestral') nextDate.setMonth(nextDate.getMonth() + 3);
                  else if (contract.frequency === 'Semestral') nextDate.setMonth(nextDate.getMonth() + 6);
                  else if (contract.frequency === 'Anual') nextDate.setFullYear(nextDate.getFullYear() + 1);
                  
                  updatedContracts.push({ ...contract, nextRun: nextDate.toISOString().split('T')[0] });
              } else {
                  updatedContracts.push(contract);
              }
          });

          if (generatedCount > 0) {
              setInvoices(prev => [...newInvoices, ...prev]);
              setRecurringContracts(updatedContracts);
              notify('info', `${generatedCount} fatura(s) de avença gerada(s).`);
          }
      };

      // Run engine once after app is ready
      const timer = setTimeout(checkRecurringInvoices, 2000);
      return () => clearTimeout(timer);
  }, [isAppReady, recurringContracts]);

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
    db.recurringContracts.save(recurringContracts);

    // Debounced Cloud Push
    const timeout = setTimeout(() => {
        // If in training mode, push will be blocked by db logic, but we can also check here
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
            db.cloud.push('gestos_db_accounts', categories); 
            db.cloud.push('gestos_db_recurring_contracts', recurringContracts);
            db.cloud.pushSettings(settings);
        }
        setIsAutoSaving(false);
    }, 2000); 

    return () => clearTimeout(timeout);
  }, [transactions, bankTransactions, clients, materials, proposals, employees, categories, settings, invoices, appointments, usersList, recurringContracts, isAppReady, user]);

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
