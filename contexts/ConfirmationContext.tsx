
import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Trash2, X } from 'lucide-react';

type ConfirmationVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmationOptions {
    title: string;
    message: string;
    variant?: ConfirmationVariant;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

interface ConfirmationContextType {
    requestConfirmation: (options: ConfirmationOptions) => void;
    closeConfirmation: () => void;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export const ConfirmationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<ConfirmationOptions | null>(null);

    const requestConfirmation = useCallback((options: ConfirmationOptions) => {
        setConfig(options);
        setIsOpen(true);
    }, []);

    const closeConfirmation = useCallback(() => {
        setIsOpen(false);
        setTimeout(() => setConfig(null), 300); // Clear after animation
    }, []);

    const handleConfirm = () => {
        if (config?.onConfirm) config.onConfirm();
        closeConfirmation();
    };

    const handleCancel = () => {
        if (config?.onCancel) config.onCancel();
        closeConfirmation();
    };

    const getIcon = () => {
        switch (config?.variant) {
            case 'danger': return <Trash2 size={24} className="text-red-600" />;
            case 'warning': return <AlertTriangle size={24} className="text-orange-600" />;
            case 'success': return <CheckCircle2 size={24} className="text-green-600" />;
            default: return <HelpCircle size={24} className="text-blue-600" />;
        }
    };

    const getButtonStyles = () => {
        switch (config?.variant) {
            case 'danger': return 'bg-red-600 hover:bg-red-700 text-white shadow-red-100';
            case 'warning': return 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-100';
            case 'success': return 'bg-green-600 hover:bg-green-700 text-white shadow-green-100';
            default: return 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100';
        }
    };

    return (
        <ConfirmationContext.Provider value={{ requestConfirmation, closeConfirmation }}>
            {children}
            {isOpen && config && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100 animate-fade-in-up border border-gray-100">
                        <div className="flex flex-col items-center text-center">
                            <div className={`p-4 rounded-full mb-4 ${
                                config.variant === 'danger' ? 'bg-red-50' :
                                config.variant === 'warning' ? 'bg-orange-50' :
                                config.variant === 'success' ? 'bg-green-50' : 'bg-blue-50'
                            }`}>
                                {getIcon()}
                            </div>
                            
                            <h3 className="text-lg font-bold text-gray-800 mb-2">{config.title}</h3>
                            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                                {config.message}
                            </p>

                            <div className="flex gap-3 w-full">
                                <button 
                                    onClick={handleCancel}
                                    className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors"
                                >
                                    {config.cancelText || 'Cancelar'}
                                </button>
                                <button 
                                    onClick={handleConfirm}
                                    className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all ${getButtonStyles()}`}
                                >
                                    {config.confirmText || 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmationContext.Provider>
    );
};

export const useConfirmation = () => {
    const context = useContext(ConfirmationContext);
    if (!context) {
        throw new Error('useConfirmation deve ser usado dentro de um ConfirmationProvider');
    }
    return context;
};
