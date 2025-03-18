import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Plus, Edit, Trash2, Save, X, Clock, Calendar, Check } from 'lucide-react';

interface WelcomeMessage {
  _id: string;
  text: string;
  active: boolean;
  conditions: {
    field: 'time' | 'day' | 'date';
    operator: 'equals' | 'greater_than' | 'less_than' | 'between';
    value: string;
    value2?: string;
  }[];
  createdAt: string;
}

const WelcomeMessages: React.FC = () => {
  const [messages, setMessages] = useState<WelcomeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newMessage, setNewMessage] = useState({
    text: '',
    active: true,
    conditions: [] as WelcomeMessage['conditions']
  });

  const [editMessage, setEditMessage] = useState({
    text: '',
    active: true,
    conditions: [] as WelcomeMessage['conditions']
  });

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3001/api/welcome-messages');
      setMessages(response.data);
      setLoading(false);
    } catch (err) {
      setError('שגיאה בטעינת הודעות הפתיחה');
      setLoading(false);
      console.error('Error fetching welcome messages:', err);
    }
  };

  const handleAddMessage = async () => {
    try {
      if (!newMessage.text.trim()) {
        alert('יש להזין טקסט להודעת הפתיחה');
        return;
      }

      const response = await axios.post('http://localhost:3001/api/welcome-messages', newMessage);
      setMessages([...messages, response.data]);
      setIsAdding(false);
      setNewMessage({
        text: '',
        active: true,
        conditions: []
      });
    } catch (err) {
      console.error('Error adding welcome message:', err);
      alert('שגיאה בהוספת הודעת הפתיחה');
    }
  };

  const handleUpdateMessage = async (id: string) => {
    try {
      if (!editMessage.text.trim()) {
        alert('יש להזין טקסט להודעת הפתיחה');
        return;
      }

      const response = await axios.put(`http://localhost:3001/api/welcome-messages/${id}`, editMessage);
      setMessages(messages.map(m => m._id === id ? response.data : m));
      setEditingId(null);
    } catch (err) {
      console.error('Error updating welcome message:', err);
      alert('שגיאה בעדכון הודעת הפתיחה');
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק הודעת פתיחה זו?')) {
      return;
    }

    try {
      await axios.delete(`http://localhost:3001/api/welcome-messages/${id}`);
      setMessages(messages.filter(m => m._id !== id));
    } catch (err) {
      console.error('Error deleting welcome message:', err);
      alert('שגיאה במחיקת הודעת הפתיחה');
    }
  };

  const handleAddCondition = (isNew: boolean) => {
    const newCondition = {
      field: 'time' as const,
      operator: 'equals' as const,
      value: ''
    };

    if (isNew) {
      setNewMessage({
        ...newMessage,
        conditions: [...newMessage.conditions, newCondition]
      });
    } else {
      setEditMessage({
        ...editMessage,
        conditions: [...editMessage.conditions, newCondition]
      });
    }
  };

  const handleRemoveCondition = (index: number, isNew: boolean) => {
    if (isNew) {
      const conditions = [...newMessage.conditions];
      conditions.splice(index, 1);
      setNewMessage({ ...newMessage, conditions });
    } else {
      const conditions = [...editMessage.conditions];
      conditions.splice(index, 1);
      setEditMessage({ ...editMessage, conditions });
    }
  };

  const handleConditionChange = (
    index: number,
    field: keyof WelcomeMessage['conditions'][0],
    value: string,
    isNew: boolean
  ) => {
    if (isNew) {
      const conditions = [...newMessage.conditions];
      conditions[index] = { ...conditions[index], [field]: value };
      setNewMessage({ ...newMessage, conditions });
    } else {
      const conditions = [...editMessage.conditions];
      conditions[index] = { ...conditions[index], [field]: value };
      setEditMessage({ ...editMessage, conditions });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('he-IL');
  };

  const ConditionsForm = ({
    conditions,
    isNew,
    onAddCondition,
    onRemoveCondition,
    onConditionChange
  }: {
    conditions: WelcomeMessage['conditions'];
    isNew: boolean;
    onAddCondition: () => void;
    onRemoveCondition: (index: number) => void;
    onConditionChange: (index: number, field: string, value: string) => void;
  }) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">תנאים להצגת ההודעה</h3>
        <button
          type="button"
          onClick={onAddCondition}
          className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-4 w-4 mr-1" />
          הוסף תנאי
        </button>
      </div>

      {conditions.map((condition, index) => (
        <div key={index} className="flex items-start space-x-2">
          <div className="flex-1 space-y-2">
            <select
              value={condition.field}
              onChange={(e) => onConditionChange(index, 'field', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="time">שעה</option>
              <option value="day">יום</option>
              <option value="date">תאריך</option>
            </select>

            <select
              value={condition.operator}
              onChange={(e) => onConditionChange(index, 'operator', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="equals">שווה ל</option>
              <option value="greater_than">גדול מ</option>
              <option value="less_than">קטן מ</option>
              <option value="between">בין</option>
            </select>

            <input
              type="text"
              value={condition.value}
              onChange={(e) => onConditionChange(index, 'value', e.target.value)}
              placeholder={condition.field === 'time' ? '8-12 או 14' : condition.field === 'day' ? '0-6' : 'YYYY-MM-DD'}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />

            {condition.operator === 'between' && (
              <input
                type="text"
                value={condition.value2 || ''}
                onChange={(e) => onConditionChange(index, 'value2', e.target.value)}
                placeholder="ערך שני (לדוגמה: 13-17)"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => onRemoveCondition(index)}
            className="mt-1 text-red-600 hover:text-red-800"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <MessageSquare className="h-6 w-6 mr-2 text-indigo-600" />
          ניהול הודעות פתיחה
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={isAdding}
        >
          <Plus className="h-5 w-5 mr-2" />
          הוסף הודעת פתיחה
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
            <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-indigo-900">הוספת הודעת פתיחה חדשה</h3>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="new-message-text" className="block text-sm font-medium text-gray-700 mb-1">
                    טקסט ההודעה
                  </label>
                  <textarea
                    id="new-message-text"
                    rows={3}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={newMessage.text}
                    onChange={(e) => setNewMessage({ ...newMessage, text: e.target.value })}
                    dir="rtl"
                    placeholder="הזן את טקסט הודעת הפתיחה..."
                  />
                </div>

                <ConditionsForm
                  conditions={newMessage.conditions}
                  isNew={true}
                  onAddCondition={() => handleAddCondition(true)}
                  onRemoveCondition={(index) => handleRemoveCondition(index, true)}
                  onConditionChange={(index, field, value) => handleConditionChange(index, field as any, value, true)}
                />

                <div className="flex items-center">
                  <input
                    id="new-message-active"
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked={newMessage.active}
                    onChange={(e) => setNewMessage({ ...newMessage, active: e.target.checked })}
                  />
                  <label htmlFor="new-message-active" className="mr-2 block text-sm text-gray-900">
                    פעיל
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddMessage}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    שמור הודעה
                  </button>
                </div>
              </div>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">אין הודעות פתיחה להצגה</p>
              <p className="text-gray-500 text-sm mt-1">לחץ על "הוסף הודעת פתיחה" כדי להתחיל</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div 
                  key={message._id}
                  className={`bg-white p-6 rounded-lg border ${
                    message.active ? 'border-green-200' : 'border-gray-200'
                  }`}
                >
                  {editingId === message._id ? (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor={`edit-message-${message._id}`} className="block text-sm font-medium text-gray-700 mb-1">
                          טקסט ההודעה
                        </label>
                        <textarea
                          id={`edit-message-${message._id}`}
                          rows={3}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={editMessage.text}
                          onChange={(e) => setEditMessage({ ...editMessage, text: e.target.value })}
                          dir="rtl"
                        />
                      </div>

                      <ConditionsForm
                        conditions={editMessage.conditions}
                        isNew={false}
                        onAddCondition={() => handleAddCondition(false)}
                        onRemoveCondition={(index) => handleRemoveCondition(index, false)}
                        onConditionChange={(index, field, value) => handleConditionChange(index, field as any, value, false)}
                      />

                      <div className="flex items-center">
                        <input
                          id={`edit-message-active-${message._id}`}
                          type="checkbox"
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          checked={editMessage.active}
                          onChange={(e) => setEditMessage({ ...editMessage, active: e.target.checked })}
                        />
                        <label htmlFor={`edit-message-active-${message._id}`} className="mr-2 block text-sm text-gray-900">
                          פעיל
                        </label>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <X className="h-5 w-5 mr-1" />
                          ביטול
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateMessage(message._id)}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
                              message.active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            } mr-2`}>
                              {message.active ? (
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

                          <div className="text-lg font-medium text-gray-900 mb-2 whitespace-pre-wrap">
                            {message.text}
                          </div>

                          {message.conditions.length > 0 && (
                            <div className="mt-2">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">תנאי הצגה:</h4>
                              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                {message.conditions.map((condition, index) => (
                                  <li key={index} className="flex items-center">
                                    {condition.field === 'time' && <Clock className="h-4 w-4 mr-1 text-gray-400" />}
                                    {condition.field === 'day' && <Calendar className="h-4 w-4 mr-1 text-gray-400" />}
                                    {condition.field === 'time' && (
                                      <>
                                        שעה{' '}
                                        {condition.operator === 'equals' && 'שווה ל'}
                                        {condition.operator === 'greater_than' && 'אחרי'}
                                        {condition.operator === 'less_than' && 'לפני'}
                                        {condition.operator === 'between' && 'בין'}{' '}
                                        {condition.value}
                                        {condition.operator === 'between' && condition.value2 && ` ל-${condition.value2}`}
                                      </>
                                    )}
                                    {condition.field === 'day' && (
                                      <>
                                        יום {condition.value === '6' ? 'שבת' : condition.value === '5' ? 'שישי' : `${condition.value}`}
                                      </>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <p className="text-xs text-gray-500 mt-2">
                            נוצר ב-{formatTimestamp(message.createdAt)}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingId(message._id);
                              setEditMessage({
                                text: message.text,
                                active: message.active,
                                conditions: [...message.conditions]
                              });
                            }}
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(message._id)}
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

export default WelcomeMessages;