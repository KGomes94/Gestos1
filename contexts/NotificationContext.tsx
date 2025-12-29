
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: number;
  type: NotificationType;
  title?: string;
  message: string;
  visible: boolean;
}

interface NotificationContextType {
  notify: (type: NotificationType, message: string, title?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((type: NotificationType, message: string, title?: string) => {
    const id = Date.now();
    
    // Limita a 5 notificações simultâneas (remove a mais antiga se exceder)
    setNotifications((prev) => {
        const active = prev.filter(n => n.visible);
        if (active.length >= 5) {
            // Remove a primeira (mais antiga) visível
            const firstId = active[0].id;
            return [...prev.filter(n => n.id !== firstId), { id, type, message, title, visible: true }];
        }
        return [...prev, { id, type, message, title, visible: true }];
    });

    // Auto-dismiss após 5 segundos
    setTimeout(() => {
        closeNotification(id);
    }, 5000);
  }, []);

  const closeNotification = (id: number) => {
    setNotifications((prev) => prev.map(n => n.id === id ? { ...n, visible: false } : n));
    // Remove do array após a animação de saída (500ms)
    setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 500);
  };

  const getIcon = (type: NotificationType) => {
      switch(type) {
          case 'success': return <CheckCircle size={20} className="text-green-500" />;
          case 'error': return <AlertCircle size={20} className="text-red-500" />;
          case 'warning': return <AlertTriangle size={20} className="text-orange-500" />;
          default: return <Info size={20} className="text-blue-500" />;
      }
  };

  const getStyles = (type: NotificationType) => {
      switch(type) {
          case 'success': return 'border-l-green-500';
          case 'error': return 'border-l-red-500';
          case 'warning': return 'border-l-orange-500';
          default: return 'border-l-blue-500';
      }
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`
                pointer-events-auto
                min-w-[320px] max-w-sm w-full
                bg-white/95 backdrop-blur-sm
                rounded-lg shadow-xl shadow-gray-200/50
                border border-gray-100 border-l-4
                p-4
                transform transition-all duration-500 ease-in-out
                flex items-start gap-3
                ${getStyles(n.type)}
                ${n.visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            `}
          >
            <div className="shrink-0 mt-0.5">
                {getIcon(n.type)}
            </div>
            <div className="flex-1 min-w-0">
                {n.title && <h4 className="text-sm font-bold text-gray-800 mb-0.5">{n.title}</h4>}
                <p className={`${n.title ? 'text-xs text-gray-600' : 'text-sm font-medium text-gray-700'} leading-relaxed`}>
                    {n.message}
                </p>
            </div>
            <button 
                onClick={() => closeNotification(n.id)} 
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-md transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
