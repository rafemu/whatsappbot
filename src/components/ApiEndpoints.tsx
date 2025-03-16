import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Globe, Plus, Edit, Trash2, Save, X, Check } from 'lucide-react';

interface ApiEndpoint {
  _id: string;
  name: string;
  url: string;
  description: string;
  active: boolean;
  createdAt: string;
}

const ApiEndpoints: React.FC = () => {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newEndpoint, setNewEndpoint] = useState({
    name: '',
    url: '',
    description: '',
    active: true
  });
  
  const [editEndpoint, setEditEndpoint] = useState<{
    name: string;
    url: string;
    description: string;
    active: boolean;
  }>({
    name: '',
    url: '',
    description: '',
    active: true
  });

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3001/api/endpoints');
      setEndpoints(response.data);
      setLoading(false);
    } catch (err) {
      setError('שגיאה בטעינת כתובות ה-API');
      setLoading(false);
      console.error('Error fetching API endpoints:', err);
    }
  };

  const handleAddEndpoint = async () => {
    try {
      if (!newEndpoint.name.trim()) {
        alert('יש להזין שם לכתובת ה-API');
        return;
      }
      
      if (!newEndpoint.url.trim()) {
        alert('יש להזין כתובת URL');
        return;
      }
      
      const response = await axios.post('http://localhost:3001/api/endpoints', newEndpoint);
      
      setEndpoints([...endpoints, response.data]);
      setIsAdding(false);
      setNewEndpoint({
        name: '',
        url: '',
        description: '',
        active: true
      });
    } catch (err) {
      console.error('Error adding API endpoint:', err);
      alert('שגיאה בהוספת כתובת ה-API');
    }
  };

  const handleUpdateEndpoint = async (id: string) => {
    try {
      if (!editEndpoint.name.trim()) {
        alert('יש להזין שם לכתובת ה-API');
        return;
      }
      
      if (!editEndpoint.url.trim()) {
        alert('יש להזין כתובת URL');
        return;
      }
      
      const response = await axios.put(`http://localhost:3001/api/endpoints/${id}`, editEndpoint);
      
      setEndpoints(endpoints.map(e => e._id === id ? response.data : e));
      setEditingId(null);
    } catch (err) {
      console.error('Error updating API endpoint:', err);
      alert('שגיאה בעדכון כתובת ה-API');
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק כתובת API זו?')) {
      return;
    }
    
    try {
      await axios.delete(`http://localhost:3001/api/endpoints/${id}`);
      setEndpoints(endpoints.filter(e => e._id !== id));
    } catch (err) {
      console.error('Error deleting API endpoint:', err);
      alert('שגיאה במחיקת כתובת ה-API');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const endpoint = endpoints.find(e => e._id === id);
      if (!endpoint) return;
      
      const response = await axios.put(`http://localhost:3001/api/endpoints/${id}`, {
        ...endpoint,
        active: !currentActive
      });
      
      setEndpoints(endpoints.map(e => e._id === id ? response.data : e));
    } catch (err) {
      console.error('Error toggling API endpoint active state:', err);
      alert('שגיאה בעדכון סטטוס כתובת ה-API');
    }
  };

  const startEditing = (endpoint: ApiEndpoint) => {
    setEditingId(endpoint._id);
    setEditEndpoint({
      name: endpoint.name,
      url: endpoint.url,
      description: endpoint.description,
      active: endpoint.active
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <Globe className="h-6 w-6 mr-2 text-teal-600" />
          ניהול כתובות API למסלקה
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          disabled={isAdding}
        >
          <Plus className="h-5 w-5 mr-2" />
          הוסף כתובת API חדשה
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : error ? (
        <div className="p-4 text-red-500 text-center">{error}</div>
      ) : (
        <>
          {isAdding && (
            <div className="bg-teal-50 p-6 rounded-lg border border-teal-200 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-teal-900">הוספת כתובת API חדשה</h3>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="new-endpoint-name" className="block text-sm font-medium text-gray-700 mb-1">
                    שם כתובת ה-API
                  </label>
                  <input
                    type="text"
                    id="new-endpoint-name"
                    className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={newEndpoint.name}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, name: e.target.value })}
                    dir="rtl"
                    placeholder="לדוגמה: בדיקת זכאות"
                  />
                </div>
                
                <div>
                  <label htmlFor="new-endpoint-url" className="block text-sm font-medium text-gray-700 mb-1">
                    כתובת URL
                  </label>
                  <input
                    type="text"
                    id="new-endpoint-url"
                    className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={newEndpoint.url}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, url: e.target.value })}
                    dir="ltr"
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>
                
                <div>
                  <label htmlFor="new-endpoint-description" className="block text-sm font-medium text-gray-700 mb-1">
                    תיאור
                  </label>
                  <textarea
                    id="new-endpoint-description"
                    rows={3}
                    className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={newEndpoint.description}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, description: e.target.value })}
                    dir="rtl"
                    placeholder="תיאור קצר של מטרת כתובת ה-API והשימוש בה"
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    id="new-endpoint-active"
                    type="checkbox"
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                    checked={newEndpoint.active}
                    onChange={(e) => setNewEndpoint({ ...newEndpoint, active: e.target.checked })}
                  />
                  <label htmlFor="new-endpoint-active" className="mr-2 block text-sm text-gray-900">
                    פעיל
                  </label>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddEndpoint}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    שמור כתובת API
                  </button>
                </div>
              </div>
            </div>
          )}

          {endpoints.length === 0 ? (
            <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
              <Globe className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">אין כתובות API להצגה</p>
              <p className="text-gray-500 text-sm mt-1">לחץ על "הוסף כתובת API חדשה" כדי להתחיל</p>
            </div>
          ) : (
            <div className="space-y-4">
              {endpoints.map((endpoint) => (
                <div 
                  key={endpoint._id}
                  className={`bg-white p-6 rounded-lg border ${
                    endpoint.active ? 'border-teal-200' : 'border-gray-200'
                  }`}
                >
                  {editingId === endpoint._id ? (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor={`edit-endpoint-name-${endpoint._id}`} className="block text-sm font-medium text-gray-700 mb-1">
                          שם כתובת ה-API
                        </label>
                        <input
                          type="text"
                          id={`edit-endpoint-name-${endpoint._id}`}
                          className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={editEndpoint.name}
                          onChange={(e) => setEditEndpoint({ ...editEndpoint, name: e.target.value })}
                          dir="rtl"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor={`edit-endpoint-url-${endpoint._id}`} className="block text-sm font-medium text-gray-700 mb-1">
                          כתובת URL
                        </label>
                        <input
                          type="text"
                          id={`edit-endpoint-url-${endpoint._id}`}
                          className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={editEndpoint.url}
                          onChange={(e) => setEditEndpoint({ ...editEndpoint, url: e.target.value })}
                          dir="ltr"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor={`edit-endpoint-description-${endpoint._id}`} className="block text-sm font-medium text-gray-700 mb-1">
                          תיאור
                        </label>
                        <textarea
                          id={`edit-endpoint-description-${endpoint._id}`}
                          rows={3}
                          className="shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={editEndpoint.description}
                          onChange={(e) => setEditEndpoint({ ...editEndpoint, description: e.target.value })}
                          dir="rtl"
                        />
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id={`edit-endpoint-active-${endpoint._id}`}
                          type="checkbox"
                          className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                          checked={editEndpoint.active}
                          onChange={(e) => setEditEndpoint({ ...editEndpoint, active: e.target.checked })}
                        />
                        <label htmlFor={`edit-endpoint-active-${endpoint._id}`} className="mr-2 block text-sm text-gray-900">
                          פעיל
                        </label>
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                        >
                          <X className="h-5 w-5 mr-1" />
                          ביטול
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateEndpoint(endpoint._id)}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                        >
                          <Save className="h-5 w-5 mr-1" />
                          שמור שינויים
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              endpoint.active 
                                ? 'bg-teal-100 text-teal-800' 
                                : 'bg-gray-100 text-gray-800'
                            } mr-2`}>
                              {endpoint.active ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  פעיל
                                </>
                              ) : (
                                <>
                                  <X className="h-3 w-3 mr-1" />
                                  לא פעיל
                                </>
                              )}
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-medium text-gray-900 mb-1">{endpoint.name}</h3>
                          <div className="text-sm text-gray-500 mb-2 font-mono bg-gray-50 p-2 rounded">
                            {endpoint.url}
                          </div>
                          
                          {endpoint.description && (
                            <p className="text-sm text-gray-600 mt-2">{endpoint.description}</p>
                          )}
                          
                          <p className="text-xs text-gray-500 mt-2">
                            נוצר ב-{formatDate(endpoint.createdAt)}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleToggleActive(endpoint._id, endpoint.active)}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              endpoint.active 
                                ? 'bg-teal-100 text-teal-800 hover:bg-teal-200' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {endpoint.active ? 'כבה' : 'הפעל'}
                          </button>
                          <button
                            onClick={() => startEditing(endpoint)}
                            className="text-teal-600 hover:text-teal-800"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEndpoint(endpoint._id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ApiEndpoints;