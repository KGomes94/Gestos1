
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
  
  // Data States - Initialized Empty for Async Load
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

  // Effect para limpar dados ao fazer logout
  useEffect(() => {
      if (!user) {
          setIsAppReady(false);
          setTransactions([]);
          setClients([]);
          // Limpar outros estados sensíveis se necessário
      }
  }, [user]);

  // Load Async Data (Phase 2: Full Supabase)
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
        try {
            // Promise.allSettled seria melhor, mas Promise.all é mais rápido se tudo funcionar.
            // Envolvemos em try/catch global e garantimos setIsAppReady no finally.
            const [
                _transactions, _clients, _users, _settings, 
                _employees, _materials, _proposals, _appointments, 
                _invoices, _bankTx, _categories
            ] = await Promise.all([
                db.transactions.getAll(),
                db.clients.getAll(),
                db.users.getAll(),
                db.settings.get(),
                db.employees.getAll(),
                db.materials.getAll(),
                db.proposals.getAll(),
                db.appointments.getAll(),
                db.invoices.getAll(),
                db.bankTransactions.getAll(),
                db.categories.getAll()
            ]);
            
            setTransactions(_transactions);
            setClients(_clients);
            setUsersList(_users);
            setSettings(_settings);
            setEmployees(_employees);
            setMaterials(_materials);
            setProposals(_proposals);
            setAppointments(_appointments);
            setInvoices(_invoices);
            setBankTransactions(_bankTx);
            setCategories(_categories);
            
        } catch (error) {
            console.error("Falha parcial ao carregar dados:", error);
            notify('error', 'Alguns dados podem não ter sido carregados. Verifique a conexão.');
        } finally {
            // GARANTE que a app entra, mesmo com erro
            setTimeout(() => setIsAppReady(true), 500);
        }
    };

    loadData();
  }, [user]);

  // Auto-Save Effect
  useEffect(() => {
    if (!isAppReady || !user) return;
    setIsAutoSaving(true);
    
    const saveAll = async () => {
        if (settings.trainingMode) return;
        
        try {
            await Promise.all([
                db.settings.save(settings),
                db.bankTransactions.save(bankTransactions),
                db.materials.save(materials),
                db.proposals.save(proposals),
                db.employees.save(employees),
                db.categories.save(categories),
                db.invoices.save(invoices),
                db.appointments.save(appointments)
            ]);
        } catch (e) {
            console.error("Auto-save error", e);
        } finally {
            setIsAutoSaving(false);
        }
    };

    const timeout = setTimeout(saveAll, 2000); // 2s Debounce
    return () => clearTimeout(timeout);
  }, [bankTransactions, materials, proposals, employees, categories, settings, invoices, appointments, isAppReady, user]);

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
