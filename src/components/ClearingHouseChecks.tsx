import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, FileCheck, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, Filter, Calendar, User, Globe } from 'lucide-react';

interface ClearingHouseCheck {
  _id: string;
  phone: string;
  endpointId: {
    _id: string;
    name: string;
    url: string;
  };
  requestData: object;
  responseData: object;
  status: 'pending' | 'success' | 'failed';
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

const ClearingHouseChecks: React.FC = () => {
  const [checks, setChecks] = useState<ClearingHouseCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<{ [key: string]: boolean }>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    fetchChecks();
    // Poll for updates every 30 seconds for pending checks
    const interval = setInterval(() => {
      checks
        .filter(check => check.status === 'pending')
        .forEach(check => refreshCheck(check._id));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchChecks = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3001/api/clearing-house-checks');
      setChecks(response.data);
      setLoading(false);
    } catch (err) {
      setError('שגיאה בטעינת בדיקות המסלקה');
      setLoading(false);
      console.error('Error fetching clearing house checks:', err);
    }
  };

  const refreshCheck = async (id: string) => {
    try {
      setRefreshing(prev => ({ ...prev, [id]: true }));
      const response = await axios.get(`http://localhost:3001/api/clearing-house-checks/${id}/refresh`);
      
      setChecks(checks.map(check => 
        check._id === id ? response.data : check
      ));
      
      setRefreshing(prev => ({ ...prev, [id]: false }));
    } catch (err) {
      console.error('Error refreshing check status:', err);
      setRefreshing(prev => ({ ...prev, [id]: false }));
    }
  };

  const formatPhone = (phone: string) => {
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

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'לא זמין';
    const date = new Date(timestamp);
    return date.toLocaleString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const toggleCheckExpand = (id: string) => {
    setExpandedCheckId(expandedCheckId === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            הצליח
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-4 w-4 mr-1" />
            נכשל
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-4 w-4 mr-1" />
            בתהליך
          </span>
        );
    }
  };

  const getDateFilterValue = (check: ClearingHouseCheck) => {
    const date = new Date(check.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    if (date.toDateString() === today.toDateString()) return 'today';
    if (date.toDateString() === yesterday.toDateString()) return 'yesterday';
    if (date > lastWeek) return 'week';
    if (date > lastMonth) return 'month';
    return 'older';
  };

  const filteredChecks = checks
    .filter(check => 
      (searchTerm === '' || 
       check.phone.includes(searchTerm) || 
       check.endpointId.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === 'all' || check.status === statusFilter) &&
      (dateFilter === 'all' || getDateFilterValue(check) === dateFilter)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const stats = {
    total: checks.length,
    success: checks.filter(c => c.status === 'success').length,
    failed: checks.filter(c => c.status === 'failed').length,
    pending: checks.filter(c => c.status === 'pending').length
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <FileCheck className="h-6 w-6 mr-2 text-indigo-600" />
            בדיקות מסלקה
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            ניהול ומעקב אחר בדיקות מסלקה
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="חיפוש לפי טלפון או שם API..."
              className="block w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              dir="rtl"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FileCheck className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">סה"כ בדיקות</p>
                <p className="text-2xl font-semibold text-indigo-600">{stats.total}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">הצליחו</p>
                <p className="text-2xl font-semibold text-green-600">{stats.success}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">נכשלו</p>
                <p className="text-2xl font-semibold text-red-600">{stats.failed}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">בתהליך</p>
                <p className="text-2xl font-semibold text-yellow-600">{stats.pending}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <select
                  className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">כל הסטטוסים</option>
                  <option value="success">הצליחו</option>
                  <option value="failed">נכשלו</option>
                  <option value="pending">בתהליך</option>
                </select>
              </div>

              <div className="relative">
                <select
                  className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  <option value="all">כל התאריכים</option>
                  <option value="today">היום</option>
                  <option value="yesterday">אתמול</option>
                  <option value="week">שבוע אחרון</option>
                  <option value="month">חודש אחרון</option>
                  <option value="older">ישן יותר</option>
                </select>
              </div>
            </div>

            <button
              onClick={fetchChecks}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              רענן הכל
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-red-500 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            {error}
          </div>
        ) : filteredChecks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <FileCheck className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-lg">לא נמצאו בדיקות מסלקה</p>
            {searchTerm || statusFilter !== 'all' || dateFilter !== 'all' ? (
              <p className="text-gray-400 text-sm mt-2">נסה לשנות את הסינון</p>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredChecks.map((check) => (
              <div 
                key={check._id}
                className={`hover:bg-gray-50 transition-colors duration-150 ${
                  expandedCheckId === check._id ? 'bg-gray-50' : ''
                }`}
              >
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => toggleCheckExpand(check._id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <User className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="font-medium text-gray-900">
                            {formatPhone(check.phone)}
                          </span>
                        </div>

                        {getStatusBadge(check.status)}

                        <div className="flex items-center">
                          <Globe className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-gray-600">
                            {check.endpointId.name}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>נוצר: {formatTimestamp(check.createdAt)}</span>
                        {check.completedAt && (
                          <>
                            <span className="mx-2">•</span>
                            <span>הושלם: {formatTimestamp(check.completedAt)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center">
                      {check.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            refreshCheck(check._id);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors duration-150"
                          disabled={refreshing[check._id]}
                        >
                          <RefreshCw className={`h-5 w-5 ${refreshing[check._id] ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {expandedCheckId === check._id && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-gray-900">פרטי בקשה</h3>
                        <div className="bg-gray-50 p-3 rounded-md overflow-auto max-h-96">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                            {JSON.stringify(check.requestData, null, 2)}
                          </pre>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-gray-900">פרטי תשובה</h3>
                        {check.status === 'pending' ? (
                          <div className="bg-yellow-50 p-3 rounded-md">
                            <div className="flex items-center text-yellow-800">
                              <Clock className="h-5 w-5 mr-2" />
                              <span>הבקשה עדיין בתהליך...</span>
                            </div>
                          </div>
                        ) : check.status === 'failed' ? (
                          <div className="space-y-3">
                            <div className="bg-red-50 p-3 rounded-md">
                              <div className="flex items-center text-red-800">
                                <AlertCircle className="h-5 w-5 mr-2" />
                                <span>הבקשה נכשלה</span>
                              </div>
                              {check.errorMessage && (
                                <p className="mt-2 text-sm text-red-700">{check.errorMessage}</p>
                              )}
                            </div>

                            {check.responseData && Object.keys(check.responseData).length > 0 && (
                              <div className="bg-gray-50 p-3 rounded-md overflow-auto max-h-96">
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                                  {JSON.stringify(check.responseData, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-3 rounded-md overflow-auto max-h-96">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(check.responseData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <h3 className="text-sm font-medium text-gray-900 mb-2">פרטי API</h3>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">שם:</p>
                            <p className="text-sm font-medium text-gray-900">{check.endpointId.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">כתובת:</p>
                            <p className="text-sm font-mono text-gray-900">{check.endpointId.url}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClearingHouseChecks;