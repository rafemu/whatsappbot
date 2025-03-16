import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GitBranch, Plus, Edit, Trash2, Save, X, Globe, FileQuestion, ArrowRight } from 'lucide-react';

interface Question {
  _id: string;
  text: string;
  type: string;
  order: number;
}

interface ApiEndpoint {
  _id: string;
  name: string;
  url: string;
}

interface Condition {
  questionId: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'startsWith' | 'endsWith';
  value: string;
}

interface ConditionalQuestion {
  _id: string;
  baseQuestionId: {
    _id: string;
    text: string;
  };
  conditions: Condition[];
  nextQuestionId: {
    _id: string;
    text: string;
  };
  apiEndpointId?: {
    _id: string;
    name: string;
  };
  active: boolean;
}

const ConditionalQuestions: React.FC = () => {
  const [conditionalQuestions, setConditionalQuestions] = useState<ConditionalQuestion[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [apiEndpoints, setApiEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newConditional, setNewConditional] = useState({
    baseQuestionId: '',
    conditions: [{ questionId: '', operator: 'equals' as const, value: '' }],
    nextQuestionId: '',
    apiEndpointId: '',
    active: true
  });
  
  const [editConditional, setEditConditional] = useState<{
    baseQuestionId: string;
    conditions: Condition[];
    nextQuestionId: string;
    apiEndpointId: string;
    active: boolean;
  }>({
    baseQuestionId: '',
    conditions: [{ questionId: '', operator: 'equals', value: '' }],
    nextQuestionId: '',
    apiEndpointId: '',
    active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch questions
      const questionsResponse = await axios.get('http://localhost:3001/api/questions');
      setQuestions(questionsResponse.data);
      
      // Fetch API endpoints
      const endpointsResponse = await axios.get('http://localhost:3001/api/api-endpoints');
      setApiEndpoints(endpointsResponse.data);
      
      // Fetch conditional questions
      const conditionalsResponse = await axios.get('http://localhost:3001/api/conditional-questions');
      setConditionalQuestions(conditionalsResponse.data);
      
      setLoading(false);
    } catch (err) {
      setError('שגיאה בטעינת הנתונים');
      setLoading(false);
      console.error('Error fetching data:', err);
    }
  };

  const handleAddConditional = async () => {
    try {
      if (!newConditional.baseQuestionId || !newConditional.nextQuestionId) {
        alert('יש לבחור שאלת בסיס ושאלה הבאה');
        return;
      }
      
      // Validate conditions
      for (const condition of newConditional.conditions) {
        if (!condition.questionId || !condition.value) {
          alert('יש למלא את כל פרטי התנאים');
          return;
        }
      }
      
      const response = await axios.post('http://localhost:3001/api/conditional-questions', newConditional);
      
      setConditionalQuestions([...conditionalQuestions, response.data]);
      setIsAdding(false);
      setNewConditional({
        baseQuestionId: '',
        conditions: [{ questionId: '', operator: 'equals', value: '' }],
        nextQuestionId: '',
        apiEndpointId: '',
        active: true
      });
    } catch (err) {
      console.error('Error adding conditional question:', err);
      alert('שגיאה בהוספת שאלה מותנית');
    }
  };

  const handleUpdateConditional = async (id: string) => {
    try {
      if (!editConditional.baseQuestionId || !editConditional.nextQuestionId) {
        alert('יש לבחור שאלת בסיס ושאלה הבאה');
        return;
      }
      
      // Validate conditions
      for (const condition of editConditional.conditions) {
        if (!condition.questionId || !condition.value) {
          alert('יש למלא את כל פרטי התנאים');
          return;
        }
      }
      
      const response = await axios.put(`http://localhost:3001/api/conditional-questions/${id}`, editConditional);
      
      setConditionalQuestions(conditionalQuestions.map(c => c._id === id ? response.data : c));
      setEditingId(null);
    } catch (err) {
      console.error('Error updating conditional question:', err);
      alert('שגיאה בעדכון שאלה מותנית');
    }
  };

  const handleDeleteConditional = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק שאלה מותנית זו?')) {
      return;
    }
    
    try {
      await axios.delete(`http://localhost:3001/api/conditional-questions/${id}`);
      setConditionalQuestions(conditionalQuestions.filter(c => c._id !== id));
    } catch (err) {
      console.error('Error deleting conditional question:', err);
      alert('שגיאה במחיקת שאלה מותנית');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const conditional = conditionalQuestions.find(c => c._id === id);
      if (!conditional) return;
      
      const response = await axios.put(`http://localhost:3001/api/conditional-questions/${id}`, {
        baseQuestionId: conditional.baseQuestionId._id,
        conditions: conditional.conditions,
        nextQuestionId: conditional.nextQuestionId._id,
        apiEndpointId: conditional.apiEndpointId?._id || '',
        active: !currentActive
      });
      
      setConditionalQuestions(conditionalQuestions.map(c => c._id === id ? response.data : c));
    } catch (err) {
      console.error('Error toggling conditional question active state:', err);
      alert('שגיאה בעדכון סטטוס שאלה מותנית');
    }
  };

  const handleConditionChange = (index: number, field: keyof Condition, value: string, isNew: boolean) => {
    if (isNew) {
      const conditions = [...newConditional.conditions];
      conditions[index] = { ...conditions[index], [field]: value };
      setNewConditional({
        ...newConditional,
        conditions
      });
    } else {
      const conditions = [...editConditional.conditions];
      conditions[index] = { ...conditions[index], [field]: value };
      setEditConditional({
        ...editConditional,
        conditions
      });
    }
  };

  const handleAddCondition = (isNew: boolean) => {
    if (isNew) {
      setNewConditional({
        ...newConditional,
        conditions: [...newConditional.conditions, { questionId: '', operator: 'equals', value: '' }]
      });
    } else {
      setEditConditional({
        ...editConditional,
        conditions: [...editConditional.conditions, { questionId: '', operator: 'equals', value: '' }]
      });
    }
  };

  const handleRemoveCondition = (index: number, isNew: boolean) => {
    if (isNew) {
      const conditions = [...newConditional.conditions];
      conditions.splice(index, 1);
      setNewConditional({
        ...newConditional,
        conditions
      });
    } else {
      const conditions = [...editConditional.conditions];
      conditions.splice(index, 1);
      setEditConditional({
        ...editConditional,
        conditions
      });
    }
  };

  const startEditing = (conditional: ConditionalQuestion) => {
    setEditingId(conditional._id);
    setEditConditional({
      baseQuestionId: conditional.baseQuestionId._id,
      conditions: [...conditional.conditions],
      nextQuestionId: conditional.nextQuestionId._id,
      apiEndpointId: conditional.apiEndpointId?._id || '',
      active: conditional.active
    });
  };

  const getQuestionById = (id: string) => {
    return questions.find(q => q._id === id);
  };

  const getApiEndpointById = (id: string) => {
    return apiEndpoints.find(e => e._id === id);
  };

  const getOperatorLabel = (operator: string) => {
    switch (operator) {
      case 'equals':
        return 'שווה ל';
      case 'notEquals':
        return 'לא שווה ל';
      case 'contains':
        return 'מכיל';
      case 'startsWith':
        return 'מתחיל ב';
      case 'endsWith':
        return 'מסתיים ב';
      default:
        return operator;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <GitBranch className="h-6 w-6 mr-2 text-indigo-600" />
          ניהול שאלות מותנות
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={isAdding}
        >
          <Plus className="h-5 w-5 mr-2" />
          הוסף שאלה מותנית חדשה
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
                <h3 className="text-lg font-medium text-indigo-900">הוספת שאלה מותנית חדשה</h3>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="new-conditional-base-question" className="block text-sm font-medium text-gray-700 mb-1">
                    שאלת בסיס
                  </label>
                  <select
                    id="new-conditional-base-question"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={newConditional.baseQuestionId}
                    onChange={(e) => setNewConditional({ ...newConditional, baseQuestionId: e.target.value })}
                    dir="rtl"
                  >
                    <option value="">בחר שאלת בסיס...</option>
                    {questions.map(question => (
                      <option key={question._id} value={question._id}>
                        {question.text}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    תנאים
                  </label>
                  <div className="space-y-3">
                    {newConditional.conditions.map((condition, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-700">תנאי {index + 1}</h4>
                          {newConditional.conditions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCondition(index, true)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label htmlFor={`condition-${index}-question`} className="block text-xs font-medium text-gray-500 mb-1">
                              שאלה
                            </label>
                            <select
                              id={`condition-${index}-question`}
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              value={condition.questionId}
                              onChange={(e) => handleConditionChange(index, 'questionId', e.target.value, true)}
                              dir="rtl"
                            >
                              <option value="">בחר שאלה...</option>
                              {questions.map(question => (
                                <option key={question._id} value={question._id}>
                                  {question.text}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label htmlFor={`condition-${index}-operator`} className="block text-xs font-medium text-gray-500 mb-1">
                              אופרטור
                            </label>
                            <select
                              id={`condition-${index}-operator`}
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              value={condition.operator}
                              onChange={(e) => handleConditionChange(index, 'operator', e.target.value as any, true)}
                              dir="rtl"
                            >
                              <option value="equals">שווה ל</option>
                              <option value="notEquals">לא שווה ל</option>
                              <option value="contains">מכיל</option>
                              <option value="startsWith">מתחיל ב</option>
                              <option value="endsWith">מסתיים ב</option>
                            </select>
                          </div>
                          
                          <div>
                            <label htmlFor={`condition-${index}-value`} className="block text-xs font-medium text-gray-500 mb-1">
                              ערך
                            </label>
                            <input
                              id={`condition-${index}-value`}
                              type="text"
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              value={condition.value}
                              onChange={(e) => handleConditionChange(index, 'value', e.target.value, true)}
                              dir="rtl"
                              placeholder="ערך לבדיקה"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => handleAddCondition(true)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      הוסף תנאי
                    </button>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="new-conditional-next-question" className="block text-sm font-medium text-gray-700 mb-1">
                    שאלה הבאה
                  </label>
                  <select
                    id="new-conditional-next-question"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={newConditional.nextQuestionId}
                    onChange={(e) => setNewConditional({ ...newConditional, nextQuestionId: e.target.value })}
                    dir="rtl"
                  >
                    <option value="">בחר שאלה הבאה...</option>
                    {questions.map(question => (
                      <option key={question._id} value={question._id}>
                        {question.text}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="new-conditional-api-endpoint" className="block text-sm font-medium text-gray-700 mb-1">
                    קריאת API (אופציונלי)
                  </label>
                  <select
                    id="new-conditional-api-endpoint"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={newConditional.apiEndpointId}
                    onChange={(e) => setNewConditional({ ...newConditional, apiEndpointId: e.target.value })}
                    dir="rtl"
                  >
                    <option value="">ללא קריאת API</option>
                    {apiEndpoints.map(endpoint => (
                      <option key={endpoint._id} value={endpoint._id}>
                        {endpoint.name} - {endpoint.url}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="new-conditional-active"
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked={newConditional.active}
                    onChange={(e) => setNewConditional({ ...newConditional, active: e.target.checked })}
                  />
                  <label htmlFor="new-conditional-active" className="mr-2 block text-sm text-gray-900">
                    פעיל
                  </label>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddConditional}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    שמור שאלה מותנית
                  </button>
                </div>
              </div>
            </div>
          )}

          {conditionalQuestions.length === 0 ? (
            <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
              <GitBranch className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">אין שאלות מותנות להצגה</p>
              <p className="text-gray-500 text-sm mt-1">לחץ על "הוסף שאלה מותנית חדשה" כדי להתחיל</p>
            </div>
          ) : (
            <div className="space-y-4">
              {conditionalQuestions.map((conditional) => (
                <div 
                  key={conditional._id}
                  className={`bg-white p-6 rounded-lg border ${
                    conditional.active ? 'border-indigo-200' : 'border-gray-200'
                  }`}
                >
                  {editingId === conditional._id ? (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor={`edit-conditional-base-question-${conditional._id}`} className="block text-sm font-medium text-gray-700 mb-1">
                          שאלת בסיס
                        </label>
                        <select
                          id={`edit-conditional-base-question-${conditional._id}`}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={editConditional.baseQuestionId}
                          onChange={(e) => setEditConditional({ ...editConditional, baseQuestionId: e.target.value })}
                          dir="rtl"
                        >
                          <option value="">בחר שאלת בסיס...</option>
                          {questions.map(question => (
                            <option key={question._id} value={question._id}>
                              {question.text}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          תנאים
                        </label>
                        <div className="space-y-3">
                          {editConditional.conditions.map((condition, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-gray-700">תנאי {index + 1}</h4>
                                {editConditional.conditions.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCondition(index, false)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label htmlFor={`edit-condition-${index}-question-${conditional._id}`} className="block text-xs font-medium text-gray-500 mb-1">
                                    שאלה
                                  </label>
                                  <select
                                    id={`edit-condition-${index}-question-${conditional._id}`}
                                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    value={condition.questionId}
                                    onChange={(e) => handleConditionChange(index, 'questionId', e.target.value, false)}
                                    dir="rtl"
                                  >
                                    <option value="">בחר שאלה...</option>
                                    {questions.map(question => (
                                      <option key={question._id} value={question._id}>
                                        {question.text}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                
                                <div>
                                  <label htmlFor={`edit-condition-${index}-operator-${conditional._id}`} className="block text-xs font-medium text-gray-500 mb-1">
                                    אופרטור
                                  </label>
                                  <select
                                    id={`edit-condition-${index}-operator-${conditional._id}`}
                                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    value={condition.operator}
                                    onChange={(e) => handleConditionChange(index, 'operator', e.target.value as any, false)}
                                    dir="rtl"
                                  >
                                    <option value="equals">שווה ל</option>
                                    <option value="notEquals">לא שווה ל</option>
                                    <option value="contains">מכיל</option>
                                    <option value="startsWith">מתחיל ב</option>
                                    <option value="endsWith">מסתיים ב</option>
                                  </select>
                                </div>
                                
                                <div>
                                  <label htmlFor={`edit-condition-${index}-value-${conditional._id}`} className="block text-xs font-medium text-gray-500 mb-1">
                                    ערך
                                  </label>
                                  <input
                                    id={`edit-condition-${index}-value-${conditional._id}`}
                                    type="text"
                                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    value={condition.value}
                                    onChange={(e) => handleConditionChange(index, 'value', e.target.value, false)}
                                    dir="rtl"
                                    placeholder="ערך לבדיקה"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          <button
                            type="button"
                            onClick={() => handleAddCondition(false)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            הוסף תנאי
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor={`edit-conditional-next-question-${conditional._id}`} className="block text-sm font-medium text-gray-700 mb-1">
                          שאלה הבאה
                        </label>
                        <select
                          id={`edit-conditional-next-question-${conditional._id}`}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={editConditional.nextQuestionId}
                          onChange={(e) => setEditConditional({ ...editConditional, nextQuestionId: e.target.value })}
                          dir="rtl"
                        >
                          <option value="">בחר שאלה הבאה...</option>
                          {questions.map(question => (
                            <option key={question._id} value={question._id}>
                              {question.text}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor={`edit-conditional-api-endpoint-${conditional._id}`} className="block text-sm font-medium text-gray-700 mb-1">
                          קריאת API (אופציונלי)
                        </label>
                        <select
                          id={`edit-conditional-api-endpoint-${conditional._id}`}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={editConditional.apiEndpointId}
                          onChange={(e) => setEditConditional({ ...editConditional, apiEndpointId: e.target.value })}
                          dir="rtl"
                        >
                          <option value="">ללא קריאת API</option>
                          {apiEndpoints.map(endpoint => (
                            <option key={endpoint._id} value={endpoint._id}>
                              {endpoint.name} - {endpoint.url}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id={`edit-conditional-active-${conditional._id}`}
                          type="checkbox"
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          checked={editConditional.active}
                          onChange={(e) => setEditConditional({ ...editConditional, active: e.target.checked })}
                        />
                        <label htmlFor={`edit-conditional-active-${conditional._id}`} className="mr-2 block text-sm text-gray-900">
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
                          onClick={() => handleUpdateConditional(conditional._id)}
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
                              conditional.active ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'
                            } mr-2`}>
                              {conditional.active ? 'פעיל' : 'לא פעיל'}
                            </span>
                            
                            {conditional.apiEndpointId && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Globe className="h-3 w-3 mr-1" />
                                כולל קריאת API
                              </span>
                            )}
                          </div>
                          
                          <div className="mb-4">
                            <h3 className="text-lg font-medium text-gray-900 mb-1">
                              {conditional.baseQuestionId?.text || 'שאלה לא קיימת'}
                            </h3>
                            <div className="flex items-center text-sm text-gray-500">
                              <FileQuestion className="h-4 w-4 mr-1" />
                              <span>שאלת בסיס</span>
                            </div>
                          </div>
                          
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">תנאים:</h4>
                            <div className="space-y-2">
                              {conditional.conditions.map((condition, index) => {
                                const questionText = getQuestionById(condition.questionId)?.text || 'שאלה לא קיימת';
                                return (
                                  <div key={index} className="flex items-center text-sm">
                                    <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                      {questionText}
                                    </span>
                                    <span className="mx-2 text-gray-500">
                                      {getOperatorLabel(condition.operator)}
                                    </span>
                                    <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                      "{condition.value}"
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div className="flex items-center mb-2">
                            <ArrowRight className="h-5 w-5 text-indigo-500 mr-2" />
                            <div>
                              <div className="text-sm font-medium">
                                {conditional.nextQuestionId?.text || 'שאלה לא קיימת'}
                              </div>
                              <div className="text-xs text-gray-500">
                                שאלה הבאה
                              </div>
                            </div>
                          </div>
                          
                          {conditional.apiEndpointId && (
                            <div className="mt-3 flex items-center text-sm text-gray-600">
                              <Globe className="h-4 w-4 mr-1 text-blue-500" />
                              <span>
                                קריאת API: {conditional.apiEndpointId.name || 'נקודת קצה לא קיימת'}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleToggleActive(conditional._id, conditional.active)}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              conditional.active 
                                ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {conditional.active ? 'הפוך ללא פעיל' : 'הפוך לפעיל'}
                          </button>
                          <button
                            onClick={() => startEditing(conditional)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteConditional(conditional._id)}
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

export default ConditionalQuestions;