import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Bot, MessageSquare, HelpCircle, Power, PowerOff, AlertCircle, RefreshCw, ClipboardList, Globe, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import BotControl from './BotControl';
import BotSettings from './BotSettings';
import Conversations from './Conversations';
import Questions from './Questions';
import SurveyResponses from './SurveyResponses';
import ApiEndpoints from './ApiEndpoints';
import ClearingHouseChecks from './ClearingHouseChecks';
import WelcomeMessages from './WelcomeMessages';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [botActive, setBotActive] = useState(false);
  const [botStatus, setBotStatus] = useState({ active: false });
  const [qrCode, setQrCode] = useState('');
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout;
    
    const initializeSocket = () => {
      // Clean up existing socket if any
      if (socket) {
        socket.disconnect();
      }

      const newSocket = io('http://localhost:3001', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: true
      });

      // Socket event handlers
      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsServerConnected(true);
        setError('');
        setReconnectAttempt(0);
        checkBotStatus(); // Check status after connection
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setIsServerConnected(false);
        setError('שגיאת התחברות לשרת');
        
        // Increment reconnect attempt counter
        setReconnectAttempt(prev => {
          const newAttempt = prev + 1;
          if (newAttempt >= maxReconnectAttempts) {
            setError('לא ניתן להתחבר לשרת. נסה לרענן את הדף.');
          }
          return newAttempt;
        });
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        setIsServerConnected(false);
        
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, try to reconnect after delay
          reconnectTimer = setTimeout(() => {
            newSocket.connect();
          }, 1000);
        }
      });

      newSocket.on('botStatus', (data) => {
        console.log('Bot status update:', data);
        setBotStatus(data);
        setBotActive(data.active);
        if (data.error) {
          setError(data.error);
        } else {
          setError('');
        }
      });

      newSocket.on('qrCode', (data) => {
        console.log('QR code received');
        setQrCode(data);
      });

      setSocket(newSocket);
    };

    // Initialize socket connection
    initializeSocket();

    // Check initial bot status
    checkBotStatus();

    // Cleanup on unmount
    return () => {
      clearTimeout(reconnectTimer);
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const checkBotStatus = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/bot/status');
      setBotStatus(response.data);
      setBotActive(response.data.active);
      if (response.data.qrCode) {
        setQrCode(response.data.qrCode);
      }
      setError('');
    } catch (error) {
      console.error('Error checking bot status:', error);
      setError('שגיאה בבדיקת סטטוס הבוט');
    }
  };

  const handleStartBot = async () => {
    try {
      setError('');
      if (socket?.connected) {
        socket.emit('startBot');
      } else {
        const response = await axios.post('http://localhost:3001/api/bot/start');
        if (response.data.error) {
          setError(response.data.error);
        }
      }
    } catch (error: any) {
      console.error('Error starting bot:', error);
      setError(error.response?.data?.error || 'שגיאה בהפעלת הבוט');
    }
  };

  const handleStopBot = async () => {
    try {
      setError('');
      await axios.post('http://localhost:3001/api/bot/stop');
    } catch (error: any) {
      console.error('Error stopping bot:', error);
      setError(error.response?.data?.error || 'שגיאה בכיבוי הבוט');
    }
  };

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <Bot className="h-8 w-8 text-green-600 mr-2" />
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Bot Manager</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isServerConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isServerConnected ? 'מחובר לשרת' : 'מנותק מהשרת'}
            </span>
            <span className="text-sm text-gray-600">
              שלום, {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <LogOut className="h-4 w-4 mr-1" />
              התנתק
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="mr-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={
            <BotControl 
              botActive={botActive}
              botStatus={botStatus}
              qrCode={qrCode}
              onStartBot={handleStartBot}
              onStopBot={handleStopBot}
            />
          } />
          <Route path="/settings" element={<BotSettings />} />
          <Route path="/welcome-messages" element={<WelcomeMessages />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/questions" element={<Questions />} />
          <Route path="/survey-responses" element={<SurveyResponses />} />
          <Route path="/api-endpoints" element={<ApiEndpoints />} />
          <Route path="/clearing-house-checks" element={<ClearingHouseChecks />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between">
            <NavLink
              to="/"
              className={({ isActive }) => 
                `flex flex-col items-center text-sm ${
                  isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
                }`
              }
            >
              <Bot className="h-6 w-6" />
              <span>בוט</span>
            </NavLink>
            <NavLink
              to="/welcome-messages"
              className={({ isActive }) => 
                `flex flex-col items-center text-sm ${
                  isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
                }`
              }
            >
              <MessageSquare className="h-6 w-6" />
              <span>הודעות פתיחה</span>
            </NavLink>
            <NavLink
              to="/conversations"
              className={({ isActive }) => 
                `flex flex-col items-center text-sm ${
                  isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
                }`
              }
            >
              <MessageSquare className="h-6 w-6" />
              <span>שיחות</span>
            </NavLink>
            <NavLink
              to="/questions"
              className={({ isActive }) => 
                `flex flex-col items-center text-sm ${
                  isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
                }`
              }
            >
              <HelpCircle className="h-6 w-6" />
              <span>שאלות</span>
            </NavLink>
            <NavLink
              to="/survey-responses"
              className={({ isActive }) => 
                `flex flex-col items-center text-sm ${
                  isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
                }`
              }
            >
              <ClipboardList className="h-6 w-6" />
              <span>תשובות</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => 
                `flex flex-col items-center text-sm ${
                  isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
                }`
              }
            >
              <Settings className="h-6 w-6" />
              <span>הגדרות</span>
            </NavLink>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;