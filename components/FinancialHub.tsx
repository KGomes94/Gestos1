
import React, { useState } from 'react';
import { SystemSettings, Invoice, Transaction, RecurringContract, BankTransaction, StockMovement, Client, Material, Account, Purchase } from '../types';
import InvoicingModule from './InvoicingModule';
import { FinancialModule } from './FinancialModule';
import { PurchasingModule } from './PurchasingModule';
import { ArrowDownCircle, ArrowUpCircle, Landmark } from 'lucide-react';

interface FinancialHubProps {
    settings: SystemSettings;
    categories: Account[];
    // Data
    invoices: Invoice[];
    purchases: Purchase[];
    transactions: Transaction[];
    bankTransactions: BankTransaction[];
    clients: Client[];
    materials: Material[];
    recurringContracts: RecurringContract[];
    stockMovements: StockMovement[];
    // Setters
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
    setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    setBankTransactions: React.Dispatch<React.SetStateAction<BankTransaction[]>>;
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
    setRecurringContracts: React.Dispatch<React.SetStateAction<RecurringContract[]>>;
    setStockMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>;
    onAddCategories: (cats: string[]) => void;
}

export const FinancialHub: React.FC<FinancialHubProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'receivable' | 'payable' | 'banking'>('receivable');

    // Filter Entities for Specific Modules
    // Receivables -> Clients or Both
    const customers = props.clients.filter(c => !c.entityType || c.entityType === 'Cliente' || c.entityType === 'Ambos');
    // Payables -> Suppliers or Both
    const suppliers = props.clients.filter(c => c.entityType === 'Fornecedor' || c.entityType === 'Ambos');

    return (
        <div className="flex flex-col h-[calc(100vh-140px)]">
            <div className="flex gap-4 mb-4 border-b border-gray-200 shrink-0 overflow-x-auto pb-1">
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
                {activeTab === 'receivable' && (
                    <InvoicingModule 
                        clients={customers} // Filtered
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
                        suppliers={suppliers} // Filtered
                        materials={props.materials}
                        setMaterials={props.setMaterials}
                        settings={props.settings}
                        purchases={props.purchases}
                        setPurchases={props.setPurchases}
                        setTransactions={props.setTransactions}
                        setStockMovements={props.setStockMovements}
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
