import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Globe, Search, RefreshCw, AlertCircle, CheckCircle, Clock, User, FileText, RotateCw } from 'lucide-react';

interface ApiCall {
  _id: string;
  type: string;
  requestData: any;
  responseData: any;
  status: 'pending' | 'completed' | 'failed';
  phone: string;
  idNumber: string;
  externalRequestId: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface ApiCallsProps {
  socket: any;
}

const ApiCalls: React.FC<ApiCallsProps> = ({ socket }) => {
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [retryingCall, setRetryingCall] = useState<string | null>(null);

  useEffect(() => {
    fetchApiCalls();

    // Set up socket listener for API call updates
    socket.on('apiCallUpdate', (updatedCall: ApiCall) => {
      setApiCalls(prevCalls => {
        const index = prevCalls.findIndex(call => call._id === updatedCall._id);
        if (index !== -1) {
          const newCalls = [...prevCalls];
          newCalls[index] = updatedCall;
          return newCalls;
        }
        return [updatedCall, ...prevCalls];
      });
    });

    // Set up auto-refresh for pending calls
    let refreshInterval: NodeJS.Timeout | null = null;
    
    if (autoRefresh) {
      refreshInterval = setInterval(() => {
        const hasPendingCalls = apiCalls.some(call => call.status === 'pending');
        if (hasPendingCalls) {
          fetchApiCalls();
        }
      }, 5000); // Refresh every 5 seconds if there are pending calls
    }

    return () => {
      socket.off('apiCallUpdate');
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [socket, autoRefresh, apiCalls]);

  const fetchApiCalls = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3001/api/api-calls');
      setApiCalls(response.data);
      setError('');
    } catch (err) {
      setError('שגיאה בטעינת קריאות API');
      console.error('Error fetching API calls:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryCall = async (id: string) => {
    try {
      setRetryingCall(id);
      await axios.post(`http://localhost:3001/api/api-calls/${id}/retry`);
      
      // Update the call status in the UI
      setApiCalls(prevCalls => 
        prevCalls.map(call => 
          call._id === id 
            ? { ...call, status: 'pending', errorMessage: undefined } 
            : call
        )
      );
      
      // Emit socket event to retry the call
      socket.emit('retryApiCall', id);
    } catch (err) {
      console.error('Error retrying API call:', err);
      setError('שגיאה בשליחה מחדש של קריאת API');
    } finally {
      setRetryingCall(null);
    }
  };

  const toggleCallExpand = (id: string) => {
    setExpandedCallId(expandedCallId === id ? null : id);
  };

  const formatPhone = (phone: string) => {
    // Format WhatsApp phone number for display
    // Example: 972501234567@c.us -> +972 50-123-4567
    const match = phone.match(/^(\d+)@c\.us$/);
    if (!match) return phone;
    
    let number = match[1];
    if (number.startsWith('972')) {
      number = '+972 ' + number.substring(3, 5) + '-' + 
               number.substring(5, 8) + '-' + 
               number.substring(8);
    }
    return number;
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'לא זמין';
    const date = new Date(timestamp);
    return date.toLocaleString('he-IL');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            ממתין
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            הושלם
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            נכשל
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'id-verification':
        return 'אימות תעודת זהות';
      default:
        return type;
    }
  };

  const filteredCalls = apiCalls.filter(call => 
    call.phone?.includes(searchTerm) || 
    call.idNumber?.includes(searchTerm) ||
    call.externalRequestId?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <Globe className="h-6 w-6 mr-2 text-indigo-600" />
          קריאות API
        </h2>
        <div className="flex items-center space-x-4">
          <div className="relative w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="חיפוש לפי טלפון, ת.ז או מזהה..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              dir="rtl"
            />
          </div>
          <button
            onClick={fetchApiCalls}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            רענן
          </button>
          <div className="flex items-center">
            <input
              id="auto-refresh"
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <label htmlFor="auto-refresh" className="mr-2 block text-sm text-gray-900">
              רענון אוטומטי
            </label>
          </div>
        </div>
      </div>

      {loading && apiCalls.length === 0 ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : error ? (
        <div className="p-4 text-red-500 text-center">{error}</div>
      ) : filteredCalls.length === 0 ? (
        <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
          <Globe className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">לא נמצאו קריאות API</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCalls.map((call) => (
            <div 
              key={call._id}
              className={`bg-white rounded-lg border ${
                call.status === 'completed' ? 'border-green-200' : 
                call.status === 'failed' ? 'border-red-200' : 'border-yellow-200'
              }`}
            >
              <div 
                className="p-4 flex justify-between items-center cursor-pointer"
                onClick={() => toggleCallExpand(call._id)}
              >
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mr-2">
                      {getTypeLabel(call.type)}
                    </span>
                    {getStatusBadge(call.status)}
                    
                    {call.externalRequestId && (
                      <span className="mr-2 text-sm text-gray-500">
                        מזהה: {call.externalRequestId}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 flex flex-wrap gap-4">
                    {call.phone && (
                      <div className="flex items-center text-sm text-gray-500">
                        <User className="h-4 w-4 mr-1" />
                        <span>{formatPhone(call.phone)}</span>
                      </div>
                    )}
                    
                    {call.idNumber && (
                      <div className="flex items-center text-sm text-gray-500">
                        <FileText className="h-4 w-4 mr-1" />
                        <span>ת.ז: {call.idNumber}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>נוצר: {formatTimestamp(call.createdAt)}</span>
                    </div>
                    
                    {call.completedAt && (
                      <div className="flex items-center text-sm text-gray-500">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span>הושלם: {formatTimestamp(call.completedAt)}</span>
                      </div>
                    )}
                  </div>
                  
                  {call.errorMessage && (
                    <div className="mt-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      {call.errorMessage}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center">
                  {call.status === 'failed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetryCall(call._id);
                      }}
                      disabled={retryingCall === call._id}
                      className={`mr-4 inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white ${
                        retryingCall === call._id 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                      }`}
                    >
                      <RotateCw className={`h-4 w-4 mr-1 ${retryingCall === call._id ? 'animate-spin' : ''}`} />
                      נסה שוב
                    </button>
                  )}
                  
                  <div className="text-gray-400">
                    {expandedCallId === call._id ? (
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
              
              {expandedCallId === call._id && (
                <div className="border-t border-gray-200 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">נתוני בקשה</h3>
                      <pre className="bg-gray-50 p-3 rounded-md text-sm overflow-auto max-h-60">
                        {JSON.stringify(call.requestData, null, 2)}
                      </pre>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">נתוני תשובה</h3>
                      {call.responseData ? (
                        <pre className="bg-gray-50 p-3 rounded-md text-sm overflow-auto max-h-60">
                          {JSON.stringify(call.responseData, null, 2)}
                        </pre>
                      ) : (
                        <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-500">
                          אין נתוני תשובה
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApiCalls;