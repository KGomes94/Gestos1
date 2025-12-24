
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: number;
  type: NotificationType;
  message: string;
}

interface NotificationContextType {
  notify: (type: NotificationType, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((type: NotificationType, message: string) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const removeNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`min-w-[300px] max-w-md p-4 rounded-lg shadow-lg border-l-4 flex items-start gap-3 transform transition-all duration-300 animate-fade-in-up bg-white ${
              n.type === 'success' ? 'border-green-500' : 
              n.type === 'error' ? 'border-red-500' : 'border-blue-500'
            }`}
          >
            <div className={`mt-0.5 ${
               n.type === 'success' ? 'text-green-500' : 
               n.type === 'error' ? 'text-red-500' : 'text-blue-500'
            }`}>
              {n.type === 'success' && <CheckCircle size={18} />}
              {n.type === 'error' && <AlertCircle size={18} />}
              {n.type === 'info' && <Info size={18} />}
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{n.message}</p>
            </div>
            <button onClick={() => removeNotification(n.id)} className="text-gray-400 hover:text-gray-600">
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
