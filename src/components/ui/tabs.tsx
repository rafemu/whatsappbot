import React, { createContext, useContext, useState } from 'react';

// Create context for tabs
const TabsContext = createContext<{
  activeTab: string;
  setActiveTab: (value: string) => void;
  defaultValue?: string;
}>({
  activeTab: '',
  setActiveTab: () => {},
});

// Tabs component
export const Tabs = ({ 
  children, 
  defaultValue,
  className = '',
}: { 
  children: React.ReactNode;
  defaultValue: string;
  className?: string;
}) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, defaultValue }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

// TabsList component
export const TabsList = ({ 
  children,
  className = '',
}: { 
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={`flex space-x-2 ${className}`} role="tablist">
      {children}
    </div>
  );
};

// TabsTrigger component
export const TabsTrigger = ({ 
  children, 
  value,
  className = '',
}: { 
  children: React.ReactNode;
  value: string;
  className?: string;
}) => {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={`px-4 py-2 rounded-md transition-all ${
        isActive 
          ? 'bg-gray-100 text-gray-900 font-medium' 
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
      } ${className}`}
    >
      {children}
    </button>
  );
};

// TabsContent component
export const TabsContent = ({ 
  children, 
  value,
  className = '',
}: { 
  children: React.ReactNode;
  value: string;
  className?: string;
}) => {
  const { activeTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  if (!isActive) return null;

  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
};