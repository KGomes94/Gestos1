import React, { createContext, useContext, useState } from 'react';

type HelpContextType = {
  helpContent: { title: string; content: string } | null;
  setHelpContent: (content: { title: string; content: string } | null) => void;
  isHelpOpen: boolean;
  toggleHelp: () => void;
};

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export const HelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [helpContent, setHelpContent] = useState<{ title: string; content: string } | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const toggleHelp = () => setIsHelpOpen(!isHelpOpen);

  return (
    <HelpContext.Provider value={{ helpContent, setHelpContent, isHelpOpen, toggleHelp }}>
      {children}
    </HelpContext.Provider>
  );
};

export const useHelp = () => {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return context;
};
