
import React, { useState, useMemo } from 'react';
import { 
    SystemSettings, Account, Transaction, BankTransaction, 
    Invoice, Purchase, Client, Material, RecurringContract, 
    StockMovement, RecurringPurchase 
} from '../types';
import { FinancialDashboard } from './FinancialDashboard';
import { InvoicingModule } from './InvoicingModule';
import { PurchasingModule } from './PurchasingModule';
import { FinancialModule } from './FinancialModule';
import { BarChart4, ArrowDownCircle, ArrowUpCircle, Landmark } from 'lucide-react';
import { currency } from '../utils/currency';

interface FinancialHubProps {
    settings: SystemSettings;
    categories: Account[];
    onAddCategories: (categories: Account[]) => void;
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    bankTransactions: BankTransaction[];
    setBankTransactions: React.Dispatch<React.SetStateAction<BankTransaction[]>>;
    invoices: Invoice[];
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
    purchases: Purchase[];
    setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    materials: Material[];
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
    recurringContracts: RecurringContract[];
    setRecurringContracts: React.Dispatch<React.SetStateAction<RecurringContract[]>>;
    stockMovements: StockMovement[];
    setStockMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>;
    recurringPurchases: RecurringPurchase[];
    setRecurringPurchases: React.Dispatch<React.SetStateAction<RecurringPurchase[]>>;
}

export const FinancialHub: React.FC<FinancialHubProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'indicators' | 'receivable' | 'payable' | 'banking'>('indicators');

    // Filter clients vs suppliers for specific modules
    const customers = useMemo(() => props.clients.filter(c => c.entityType !== 'Fornecedor'), [props.clients]);
    const suppliers = useMemo(() => props.clients.filter(c => c.entityType !== 'Cliente'), [props.clients]);

    // Calculate current balance for Dashboard
    const currentBalance = useMemo(() => {
        const todayIso = new Date().toISOString().split('T')[0];
        const paidTransactions = props.transactions.filter(t => 
            t.status === 'Pago' && 
            !t.isVoided && 
            !t._deleted &&
            t.date <= todayIso
        );
        const totalIncome = paidTransactions.reduce((acc, t) => currency.add(acc, Number(t.income || 0)), 0);
        const totalExpense = paidTransactions.reduce((acc, t) => currency.add(acc, Number(t.expense || 0)), 0);
        return currency.sub(totalIncome, totalExpense);
    }, [props.transactions]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex gap-4 mb-2 border-b border-gray-200 shrink-0 overflow-x-auto pb-1">
                <button 
                    onClick={() => setActiveTab('indicators')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-t-lg font-bold text-sm transition-all border-b-2 ${activeTab === 'indicators' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <BarChart4 size={18} className={activeTab === 'indicators' ? 'text-purple-600' : 'text-gray-400'}/>
                    Dashboard
                </button>
                <button 
                    onClick={() => setActiveTab('receivable')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-t-lg font-bold text-sm transition-all border-b-2 ${activeTab === 'receivable' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <ArrowDownCircle size={18} className={activeTab === 'receivable' ? 'text-green-600' : 'text-gray-400'}/>
                    Contas a Receber
                </button>
                <button 
                    onClick={() => setActiveTab('payable')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-t-lg font-bold text-sm transition-all border-b-2 ${activeTab === 'payable' ? 'border-red-600 text-red-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <ArrowUpCircle size={18} className={activeTab === 'payable' ? 'text-red-600' : 'text-gray-400'}/>
                    Contas a Pagar
                </button>
                <button 
                    onClick={() => setActiveTab('banking')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-t-lg font-bold text-sm transition-all border-b-2 ${activeTab === 'banking' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Landmark size={18} className={activeTab === 'banking' ? 'text-blue-600' : 'text-gray-400'}/>
                    Bancos
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'indicators' && (
                    <FinancialDashboard 
                        invoices={props.invoices}
                        purchases={props.purchases}
                        transactions={props.transactions}
                        categories={props.categories}
                        clients={props.clients}
                        currentBalance={currentBalance}
                        settings={props.settings}
                    />
                )}

                {activeTab === 'receivable' && (
                    <InvoicingModule 
                        clients={customers} 
                        setClients={props.setClients}
                        materials={props.materials}
                        setMaterials={props.setMaterials}
                        settings={props.settings}
                        setTransactions={props.setTransactions}
                        invoices={props.invoices}
                        setInvoices={props.setInvoices}
                        recurringContracts={props.recurringContracts}
                        setRecurringContracts={props.setRecurringContracts}
                        bankTransactions={props.bankTransactions}
                        setBankTransactions={props.setBankTransactions}
                        stockMovements={props.stockMovements}
                        setStockMovements={props.setStockMovements}
                    />
                )}

                {activeTab === 'payable' && (
                    <PurchasingModule 
                        suppliers={suppliers}
                        setClients={props.setClients}
                        materials={props.materials}
                        setMaterials={props.setMaterials}
                        settings={props.settings}
                        purchases={props.purchases}
                        setPurchases={props.setPurchases}
                        setTransactions={props.setTransactions}
                        setStockMovements={props.setStockMovements}
                        recurringPurchases={props.recurringPurchases}
                        setRecurringPurchases={props.setRecurringPurchases}
                        categories={props.categories}
                        bankTransactions={props.bankTransactions}
                        setBankTransactions={props.setBankTransactions}
                    />
                )}

                {activeTab === 'banking' && (
                    <FinancialModule 
                        target={props.settings.monthlyTarget}
                        settings={props.settings}
                        categories={props.categories}
                        onAddCategories={props.onAddCategories}
                        transactions={props.transactions}
                        setTransactions={props.setTransactions}
                        bankTransactions={props.bankTransactions}
                        setBankTransactions={props.setBankTransactions}
                        clients={props.clients}
                        invoices={props.invoices}
                        setInvoices={props.setInvoices}
                    />
                )}
            </div>
        </div>
    );
};
