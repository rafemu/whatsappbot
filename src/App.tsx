import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Bot, MessageSquare, FileCheck, HelpCircle, Power, PowerOff, AlertCircle, RefreshCw, ClipboardList, Globe } from 'lucide-react';
import BotControl from './components/BotControl';
import Conversations from './components/Conversations';
import Verifications from './components/Verifications';
import Questions from './components/Questions';
import SurveyResponses from './components/SurveyResponses';
import ApiEndpoints from './components/ApiEndpoints';
import ClearingHouseChecks from './components/ClearingHouseChecks';
import { io } from 'socket.io-client';

// Initialize socket connection
const socket = io('http://localhost:3001');

function App() {
  const [botActive, setBotActive] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [isCheckingServer, setIsCheckingServer] = useState(true);
  const [botStatus, setBotStatus] = useState<{
    active: boolean;
    status?: string;
    error?: string;
    connectedPhone?: string | null;
  }>({ active: false });

  useEffect(() => {
    // Check if server is running
    const checkServer = async () => {
      try {
        setIsCheckingServer(true);
        const response = await fetch('http://localhost:3001/api/health');
        const data = await response.json();
        
        setIsServerConnected(true);
        setConnectionError('');
        setBotActive(data.botActive);
      } catch (error) {
        setIsServerConnected(false);
        setConnectionError('לא ניתן להתחבר לשרת. ודא שהשרת פועל על ידי הרצת הפקודה npm run server בטרמינל נפרד.');
      } finally {
        setIsCheckingServer(false);
      }
    };
    
    checkServer();
    
    // Check server status every 10 seconds
    const serverCheckInterval = setInterval(checkServer, 10000);
    
    // Set up socket connection
    socket.on('connect', () => {
      console.log('התחברות לשרת הצליחה');
      setIsServerConnected(true);
      setConnectionError('');
    });
    
    socket.on('connect_error', () => {
      console.log('שגיאת התחברות');
      setIsServerConnected(false);
      setConnectionError('לא ניתן להתחבר לשרת. ודא שהשרת פועל על ידי הרצת הפקודה npm run server בטרמינל נפרד.');
    });

    // Listen for bot status updates
    socket.on('botStatus', (data) => {
      console.log('עדכון סטטוס בוט:', data);
      setBotStatus(data);
      setBotActive(data.active);
      
      // Only clear QR code when bot is active or on error
      if (data.active || data.error) {
        setQrCode('');
      }
    });

    // Listen for QR code updates
    socket.on('qrCode', (data) => {
      console.log('התקבל קוד QR');
      if (data) {
        setQrCode(data);
        // Update status to indicate waiting for scan
        setBotStatus(prev => ({
          ...prev,
          status: 'waiting_scan'
        }));
      }
    });

    // Clean up on component unmount
    return () => {
      clearInterval(serverCheckInterval);
      socket.off('connect');
      socket.off('connect_error');
      socket.off('botStatus');
      socket.off('qrCode');
    };
  }, [isServerConnected]);

  const handleStartBot = () => {
    console.log('מתחיל בוט...');
    setBotStatus(prev => ({
      ...prev,
      status: 'initializing'
    }));
    socket.emit('startBot');
  };

  const handleStopBot = () => {
    console.log('מפסיק בוט...');
    socket.emit('stopBot');
  };

  const handleCheckServer = async () => {
    setIsCheckingServer(true);
    try {
      const response = await fetch('http://localhost:3001/api/health');
      await response.json();
      setIsServerConnected(true);
      setConnectionError('');
    } catch (error) {
      setIsServerConnected(false);
      setConnectionError('לא ניתן להתחבר לשרת. ודא שהשרת פועל על ידי הרצת הפקודה npm run server בטרמינל נפרד.');
    } finally {
      setIsCheckingServer(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <Bot className="h-8 w-8 text-green-600 mr-2" />
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Bot Manager</h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${botActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} mr-4`}>
              {botActive ? (
                <>
                  <Power className="h-4 w-4 mr-1" />
                  פעיל
                </>
              ) : (
                <>
                  <PowerOff className="h-4 w-4 mr-1" />
                  לא פעיל
                </>
              )}
            </span>
            {!isServerConnected ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                <AlertCircle className="h-4 w-4 mr-1" />
                שרת לא מחובר
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <Power className="h-4 w-4 mr-1" />
                שרת מחובר
              </span>
            )}
            <button 
              onClick={handleCheckServer}
              disabled={isCheckingServer}
              className="inline-flex items-center px-2 py-1 border border-transparent rounded-md text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {isCheckingServer ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {connectionError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">שגיאת התחברות</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{connectionError}</p>
                </div>
                {!isServerConnected && (
                  <div className="mt-4">
                    <button
                      onClick={handleCheckServer}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      בדוק חיבור שוב
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="control" className="w-full">
          <TabsList className="mb-6 bg-white p-1 rounded-lg shadow-sm">
            <TabsTrigger value="control" className="flex items-center">
              <Bot className="h-5 w-5 mr-2" />
              שליטה בבוט
            </TabsTrigger>
            <TabsTrigger value="conversations" className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              שיחות
            </TabsTrigger>
            <TabsTrigger value="verifications" className="flex items-center">
              <FileCheck className="h-5 w-5 mr-2" />
              אימותי ת.ז.
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex items-center">
              <HelpCircle className="h-5 w-5 mr-2" />
              שאלות
            </TabsTrigger>
            <TabsTrigger value="survey-responses" className="flex items-center">
              <ClipboardList className="h-5 w-5 mr-2" />
              תשובות סקר
            </TabsTrigger>
            <TabsTrigger value="api-endpoints" className="flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              כתובות API
            </TabsTrigger>
            <TabsTrigger value="clearing-house-checks" className="flex items-center">
              <FileCheck className="h-5 w-5 mr-2" />
              בדיקות מסלקה
            </TabsTrigger>
          </TabsList>

          <TabsContent value="control" className="bg-white p-6 rounded-lg shadow-md">
            <BotControl 
              botActive={botActive}
              botStatus={botStatus}
              qrCode={qrCode} 
              onStartBot={handleStartBot} 
              onStopBot={handleStopBot} 
            />
          </TabsContent>

          <TabsContent value="conversations" className="bg-white p-6 rounded-lg shadow-md">
            <Conversations />
          </TabsContent>

          <TabsContent value="verifications" className="bg-white p-6 rounded-lg shadow-md">
            <Verifications />
          </TabsContent>

          <TabsContent value="questions" className="bg-white p-6 rounded-lg shadow-md">
            <Questions />
          </TabsContent>

          <TabsContent value="survey-responses" className="bg-white p-6 rounded-lg shadow-md">
            <SurveyResponses />
          </TabsContent>

          <TabsContent value="api-endpoints" className="bg-white p-6 rounded-lg shadow-md">
            <ApiEndpoints />
          </TabsContent>

          <TabsContent value="clearing-house-checks" className="bg-white p-6 rounded-lg shadow-md">
            <ClearingHouseChecks />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;