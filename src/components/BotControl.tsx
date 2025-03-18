import React, { useState, useEffect } from 'react';
import { Bot, Power, PowerOff, AlertCircle, RefreshCw, Loader, Smartphone, Link, Link2Off as LinkOff, PhoneOff } from 'lucide-react';
import axios from 'axios';

interface BotControlProps {
  botActive: boolean;
  botStatus: {
    active: boolean;
    status?: string;
    error?: string;
    connectedPhone?: string | null;
  };
  qrCode: string;
  onStartBot: () => void;
  onStopBot: () => void;
}

const BotControl: React.FC<BotControlProps> = ({ 
  botActive, 
  botStatus = { active: false }, // Add default value
  qrCode, 
  onStartBot, 
  onStopBot 
}) => {
  const [isStarting, setIsStarting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState('');
  const [qrTimer, setQrTimer] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'generating-qr' | 'waiting-scan' | 'connected'>('idle');

  useEffect(() => {
    // Update local state based on botStatus prop
    if (botStatus) {
      if (botStatus.active) {
        setStatus('connected');
        setIsStarting(false);
        setError('');
      } else if (botStatus.status === 'waiting_scan') {
        setStatus('waiting-scan');
        setIsStarting(false);
      } else if (botStatus.status === 'initializing') {
        setStatus('starting');
      } else if (botStatus.status === 'error') {
        setStatus('idle');
        setIsStarting(false);
        if (botStatus.error) {
          setError(botStatus.error);
        }
      } else {
        setStatus('idle');
        setIsStarting(false);
      }
    }
  }, [botStatus]);

  useEffect(() => {
    // When QR code is received
    if (qrCode) {
      setStatus('waiting-scan');
      setError('');
      setIsStarting(false);
      
      // Clear any existing timer
      if (qrTimer) {
        clearTimeout(qrTimer);
        setQrTimer(null);
      }
    }
    
    // When bot connects successfully
    if (botActive) {
      setStatus('connected');
      setError('');
      setIsStarting(false);
      
      // Clear any existing timer
      if (qrTimer) {
        clearTimeout(qrTimer);
        setQrTimer(null);
      }
    }
  }, [qrCode, botActive, qrTimer]);

  const handleStartBot = async () => {
    try {
      setIsStarting(true);
      setError('');
      setStatus('starting');
      onStartBot();
    } catch (error) {
      console.error('Error starting bot:', error);
      setError('שגיאה בהפעלת הבוט');
      setIsStarting(false);
      setStatus('idle');
    }
  };

  const handleStopBot = async () => {
    try {
      await axios.post('http://localhost:3001/api/bot/stop');
      setStatus('idle');
      setError('');
      onStopBot();
    } catch (error) {
      console.error('Error stopping bot:', error);
      setError('שגיאה בכיבוי הבוט');
    }
  };

  const handleDisconnectPhone = async () => {
    if (!confirm('האם אתה בטוח שברצונך לנתק את המכשיר המקושר?')) {
      return;
    }

    try {
      setIsDisconnecting(true);
      await handleStopBot();
      await handleStartBot();
      setIsDisconnecting(false);
    } catch (error) {
      console.error('Error disconnecting phone:', error);
      setError('שגיאה בניתוק המכשיר');
      setIsDisconnecting(false);
    }
  };

  const getStatusDisplay = () => {
    switch (status) {
      case 'starting':
        return (
          <div className="flex items-center text-yellow-800">
            <Loader className="h-5 w-5 mr-2 animate-spin" />
            מתחיל את הבוט...
          </div>
        );
      case 'generating-qr':
        return (
          <div className="flex items-center text-blue-800">
            <Loader className="h-5 w-5 mr-2 animate-spin" />
            מייצר קוד QR...
          </div>
        );
      case 'waiting-scan':
        return (
          <div className="flex items-center text-purple-800">
            <Smartphone className="h-5 w-5 mr-2" />
            ממתין לסריקת קוד QR...
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center text-green-800">
            <Link className="h-5 w-5 mr-2" />
            מחובר {botStatus?.connectedPhone && `למכשיר ${botStatus.connectedPhone}`}
          </div>
        );
      default:
        return (
          <div className="flex items-center text-gray-800">
            <LinkOff className="h-5 w-5 mr-2" />
            לא מחובר
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <Bot className="h-6 w-6 mr-2 text-green-600" />
          שליטה בבוט WhatsApp
        </h2>
        <div className="flex space-x-4">
          {botStatus?.active && botStatus?.connectedPhone && (
            <button
              onClick={handleDisconnectPhone}
              disabled={isDisconnecting}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              {isDisconnecting ? (
                <Loader className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <PhoneOff className="h-5 w-5 mr-2" />
              )}
              נתק מכשיר
            </button>
          )}

          {!botStatus?.active ? (
            <button
              onClick={handleStartBot}
              disabled={isStarting}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <Power className="h-5 w-5 mr-2" />
              הפעל בוט
            </button>
          ) : (
            <button
              onClick={handleStopBot}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <PowerOff className="h-5 w-5 mr-2" />
              כבה בוט
            </button>
          )}
        </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">סטטוס בוט</h3>
        <div className="space-y-4">
          {getStatusDisplay()}
          
          <div className="text-sm text-gray-600">
            {status === 'idle' && 'הבוט אינו פעיל כרגע. לחץ על "הפעל בוט" כדי להתחיל.'}
            {status === 'starting' && 'מתחיל את הבוט... אנא המתן.'}
            {status === 'generating-qr' && 'מייצר קוד QR... אנא המתן.'}
            {status === 'waiting-scan' && 'סרוק את קוד ה-QR באמצעות WhatsApp במכשיר הנייד שלך.'}
            {status === 'connected' && 'הבוט פעיל ומגיב להודעות. לחץ על "כבה בוט" כדי להפסיק את פעילות הבוט.'}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-6 rounded-lg border border-red-200">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <h3 className="text-lg font-medium text-red-800">שגיאה בהפעלת הבוט</h3>
          </div>
          <p className="mt-2 text-red-700">{error}</p>
          <div className="mt-4">
            <button
              onClick={() => {
                setError('');
                handleStartBot();
              }}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              נסה שוב
            </button>
          </div>
        </div>
      )}

      {!botStatus?.active && qrCode && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">סרוק קוד QR להתחברות</h3>
          <div className="flex justify-center">
            <img src={qrCode} alt="WhatsApp QR Code" className="max-w-xs" />
          </div>
          <p className="text-gray-600 mt-4 text-center">
            סרוק את קוד ה-QR באמצעות WhatsApp במכשיר הנייד שלך כדי להתחבר.
          </p>
          <ol className="mt-4 text-gray-600 list-decimal list-inside space-y-2">
            <li>פתח את WhatsApp בטלפון שלך</li>
            <li>הקש על שלוש הנקודות (⋮) או על הגדרות</li>
            <li>בחר "התקנים מקושרים"</li>
            <li>הקש על "קישור התקן"</li>
            <li>סרוק את קוד ה-QR המוצג כאן</li>
          </ol>
        </div>
      )}

      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">הוראות</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-600">
          <li>הפעל את השרת באמצעות הפקודה <code className="bg-gray-100 px-1 py-0.5 rounded">npm run server</code> בטרמינל נפרד</li>
          <li>הפעל את הבוט באמצעות לחיצה על כפתור "הפעל בוט"</li>
          <li>המתן לקבלת קוד QR (עד 2 דקות)</li>
          <li>סרוק את קוד ה-QR שיופיע באמצעות WhatsApp במכשיר הנייד שלך</li>
          <li>לאחר הסריקה, הבוט יהיה מחובר ומוכן לשימוש</li>
          <li>ניתן לכבות את הבוט בכל עת באמצעות לחיצה על כפתור "כבה בוט"</li>
        </ul>
      </div>
    </div>
  );
};

export default BotControl;