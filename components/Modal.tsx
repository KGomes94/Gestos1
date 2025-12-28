
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50 sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:rounded-lg shadow-xl sm:max-w-5xl overflow-hidden animate-fade-in-up flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
        <div className="flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <h3 className="text-lg font-bold text-gray-800 truncate pr-4">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-2 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
