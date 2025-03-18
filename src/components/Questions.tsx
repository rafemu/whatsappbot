import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HelpCircle, Plus, Edit, Trash2, Save, X, Check, Globe, CircleDot as DragHandleDots2, ChevronDown, ChevronUp } from 'lucide-react';

interface Question {
  _id: string;
  text: string;
  responseOptions: string[];
  active: boolean;
  order: number;
  types: string[];
  isRequired: boolean;
  conditions: {
    questionId: string;
    answer: string;
    operator: 'equals' | 'contains' | 'not_equals';
  }[];
  apiEndpointId?: string;
  apiDataMapping: {
    key: string;
    source: 'question' | 'static' | 'phone';
    value: string;
  }[];
}

interface ApiEndpoint {
  _id: string;
  name: string;
  url: string;
  active: boolean;
}

const Questions: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [apiEndpoints, setApiEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newQuestion, setNewQuestion] = useState<Omit<Question, '_id'>>({
    text: '',
    responseOptions: [],
    active: true,
    order: 0,
    types: ['text'],
    isRequired: false,
    conditions: [],
    apiDataMapping: []
  });

  const [editQuestion, setEditQuestion] = useState<Omit<Question, '_id'>>({
    text: '',
    responseOptions: [],
    active: true,
    order: 0,
    types: ['text'],
    isRequired: false,
    conditions: [],
    apiDataMapping: []
  });

  useEffect(() => {
    fetchQuestions();
    fetchApiEndpoints();
  }, []);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3001/api/questions');
      setQuestions(response.data);
      setLoading(false);
    } catch (err) {
      setError('שגיאה בטעינת השאלות');
      setLoading(false);
      console.error('Error fetching questions:', err);
    }
  };

  const fetchApiEndpoints = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/endpoints');
      setApiEndpoints(response.data);
    } catch (err) {
      console.error('Error fetching API endpoints:', err);
    }
  };

  const handleAddQuestion = async () => {
    try {
      if (!newQuestion.text.trim()) {
        alert('יש להזין טקסט לשאלה');
        return;
      }

      // Validate API configuration if type includes 'api'
      if (newQuestion.types.includes('api')) {
        if (!newQuestion.apiEndpointId) {
          alert('יש לבחור כתובת API');
          return;
        }
        if (!newQuestion.apiDataMapping || newQuestion.apiDataMapping.length === 0) {
          alert('יש להגדיר לפחות מיפוי נתונים אחד');
          return;
        }
      }

      const response = await axios.post('http://localhost:3001/api/questions', {
        ...newQuestion,
        // Only include API-related fields if type includes 'api'
        ...(newQuestion.types.includes('api') ? {
          apiEndpointId: newQuestion.apiEndpointId,
          apiDataMapping: newQuestion.apiDataMapping
        } : {
          apiEndpointId: undefined,
          apiDataMapping: []
        })
      });

      setQuestions([...questions, response.data]);
      setIsAdding(false);
      setNewQuestion({
        text: '',
        responseOptions: [],
        active: true,
        order: questions.length,
        types: ['text'],
        isRequired: false,
        conditions: [],
        apiDataMapping: []
      });
    } catch (err) {
      console.error('Error adding question:', err);
      alert('שגיאה בהוספת השאלה: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateQuestion = async (id: string) => {
    try {
      if (!editQuestion.text.trim()) {
        alert('יש להזין טקסט לשאלה');
        return;
      }

      // Validate API configuration if type includes 'api'
      if (editQuestion.types.includes('api')) {
        if (!editQuestion.apiEndpointId) {
          alert('יש לבחור כתובת API');
          return;
        }
        if (!editQuestion.apiDataMapping || editQuestion.apiDataMapping.length === 0) {
          alert('יש להגדיר לפחות מיפוי נתונים אחד');
          return;
        }
      }

      const response = await axios.put(`http://localhost:3001/api/questions/${id}`, {
        ...editQuestion,
        // Only include API-related fields if type includes 'api'
        ...(editQuestion.types.includes('api') ? {
          apiEndpointId: editQuestion.apiEndpointId,
          apiDataMapping: editQuestion.apiDataMapping
        } : {
          apiEndpointId: undefined,
          apiDataMapping: []
        })
      });

      setQuestions(questions.map(q => q._id === id ? response.data : q));
      setEditingId(null);
    } catch (err) {
      console.error('Error updating question:', err);
      alert('שגיאה בעדכון השאלה: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק שאלה זו?')) {
      return;
    }

    try {
      await axios.delete(`http://localhost:3001/api/questions/${id}`);
      setQuestions(questions.filter(q => q._id !== id));
    } catch (err) {
      console.error('Error deleting question:', err);
      alert('שגיאה במחיקת השאלה');
    }
  };

  const handleTypeToggle = (type: string, isNew: boolean) => {
    const currentTypes = isNew ? newQuestion.types : editQuestion.types;
    const setQuestion = isNew ? setNewQuestion : setEditQuestion;
    
    if (currentTypes.includes(type)) {
      setQuestion(prev => ({
        ...prev,
        types: prev.types.filter(t => t !== type),
        ...(type === 'api' && { 
          apiEndpointId: undefined,
          apiDataMapping: []
        })
      }));
    } else {
      setQuestion(prev => ({
        ...prev,
        types: [...prev.types, type]
      }));
    }
  };

  const handleAddApiMapping = (isNew: boolean) => {
    const newMapping = {
      key: '',
      source: 'question' as const,
      value: ''
    };

    if (isNew) {
      setNewQuestion(prev => ({
        ...prev,
        apiDataMapping: [...prev.apiDataMapping, newMapping]
      }));
    } else {
      setEditQuestion(prev => ({
        ...prev,
        apiDataMapping: [...prev.apiDataMapping, newMapping]
      }));
    }
  };

  const handleRemoveApiMapping = (index: number, isNew: boolean) => {
    if (isNew) {
      setNewQuestion(prev => ({
        ...prev,
        apiDataMapping: prev.apiDataMapping.filter((_, i) => i !== index)
      }));
    } else {
      setEditQuestion(prev => ({
        ...prev,
        apiDataMapping: prev.apiDataMapping.filter((_, i) => i !== index)
      }));
    }
  };

  const handleApiMappingChange = (
    index: number,
    field: keyof Question['apiDataMapping'][0],
    value: string,
    isNew: boolean
  ) => {
    if (isNew) {
      setNewQuestion(prev => ({
        ...prev,
        apiDataMapping: prev.apiDataMapping.map((mapping, i) => 
          i === index ? { ...mapping, [field]: value } : mapping
        )
      }));
    } else {
      setEditQuestion(prev => ({
        ...prev,
        apiDataMapping: prev.apiDataMapping.map((mapping, i) => 
          i === index ? { ...mapping, [field]: value } : mapping
        )
      }));
    }
  };

  const ApiMappingForm = ({
    mappings,
    isNew,
    onAddMapping,
    onRemoveMapping,
    onMappingChange,
    availableQuestions
  }: {
    mappings: Question['apiDataMapping'];
    isNew: boolean;
    onAddMapping: () => void;
    onRemoveMapping: (index: number) => void;
    onMappingChange: (index: number, field: string, value: string) => void;
    availableQuestions: Question[];
  }) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">מיפוי נתונים ל-API</h3>
        <button
          type="button"
          onClick={onAddMapping}
          className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-4 w-4 mr-1" />
          הוסף שדה
        </button>
      </div>

      {mappings.map((mapping, index) => (
        <div key={index} className="flex items-start space-x-2">
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={mapping.key}
              onChange={(e) => onMappingChange(index, 'key', e.target.value)}
              placeholder="שם השדה (key)"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              dir="ltr"
            />

            <select
              value={mapping.source}
              onChange={(e) => onMappingChange(index, 'source', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="question">תשובה לשאלה</option>
              <option value="static">ערך קבוע</option>
              <option value="phone">מספר טלפון</option>
            </select>

            {mapping.source === 'question' ? (
              <select
                value={mapping.value}
                onChange={(e) => onMappingChange(index, 'value', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">בחר שאלה</option>
                {availableQuestions.map(q => (
                  <option key={q._id} value={q._id}>{q.text}</option>
                ))}
              </select>
            ) : mapping.source === 'static' ? (
              <input
                type="text"
                value={mapping.value}
                onChange={(e) => onMappingChange(index, 'value', e.target.value)}
                placeholder="ערך קבוע"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onRemoveMapping(index)}
            className="mt-1 text-red-600 hover:text-red-800"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );

  const QuestionForm = ({
    question,
    isNew,
    onSave,
    onCancel
  }: {
    question: Omit<Question, '_id'>;
    isNew: boolean;
    onSave: () => void;
    onCancel: () => void;
  }) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          טקסט השאלה
        </label>
        <textarea
          rows={3}
          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          value={question.text}
          onChange={(e) => isNew 
            ? setNewQuestion({ ...question, text: e.target.value })
            : setEditQuestion({ ...question, text: e.target.value })
          }
          dir="rtl"
          placeholder="הזן את טקסט השאלה..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          סוג השאלה
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleTypeToggle('text', isNew)}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
              question.types.includes('text')
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            טקסט
          </button>

          <button
            type="button"
            onClick={() => handleTypeToggle('options', isNew)}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
              question.types.includes('options')
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            <Check className="h-4 w-4 mr-1" />
            בחירה
          </button>

          <button
            type="button"
            onClick={() => handleTypeToggle('api', isNew)}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
              question.types.includes('api')
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            <Globe className="h-4 w-4 mr-1" />
            API
          </button>
        </div>
      </div>

      {question.types.includes('options') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            אפשרויות תשובה
          </label>
          <div className="space-y-2">
            {question.responseOptions.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...question.responseOptions];
                    newOptions[index] = e.target.value;
                    isNew
                      ? setNewQuestion({ ...question, responseOptions: newOptions })
                      : setEditQuestion({ ...question, responseOptions: newOptions });
                  }}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder={`אפשרות ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = question.responseOptions.filter((_, i) => i !== index);
                    isNew
                      ? setNewQuestion({ ...question, responseOptions: newOptions })
                      : setEditQuestion({ ...question, responseOptions: newOptions });
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const newOptions = [...question.responseOptions, ''];
                isNew
                  ? setNewQuestion({ ...question, responseOptions: newOptions })
                  : setEditQuestion({ ...question, responseOptions: newOptions });
              }}
              className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-1" />
              הוסף אפשרות
            </button>
          </div>
        </div>
      )}

      {question.types.includes('api') && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              בחר כתובת API
            </label>
            <select
              value={question.apiEndpointId}
              onChange={(e) => isNew
                ? setNewQuestion({ ...question, apiEndpointId: e.target.value })
                : setEditQuestion({ ...question, apiEndpointId: e.target.value })
              }
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="">בחר כתובת API</option>
              {apiEndpoints.filter(e => e.active).map(endpoint => (
                <option key={endpoint._id} value={endpoint._id}>
                  {endpoint.name}
                </option>
              ))}
            </select>
          </div>

          <ApiMappingForm
            mappings={question.apiDataMapping}
            isNew={isNew}
            onAddMapping={() => handleAddApiMapping(isNew)}
            onRemoveMapping={(index) => handleRemoveApiMapping(index, isNew)}
            onMappingChange={(index, field, value) => 
              handleApiMappingChange(index, field as any, value, isNew)
            }
            availableQuestions={questions}
          />
        </div>
      )}

      <div className="flex items-center">
        <input
          type="checkbox"
          checked={question.active}
          onChange={(e) => isNew
            ? setNewQuestion({ ...question, active: e.target.checked })
            : setEditQuestion({ ...question, active: e.target.checked })
          }
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
        />
        <label className="mr-2 block text-sm text-gray-900">
          פעיל
        </label>
      </div>

      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <X className="h-5 w-5 mr-1" />
          ביטול
        </button>
        <button
          type="button"
          onClick={onSave}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Save className="h-5 w-5 mr-1" />
          {isNew ? 'הוסף שאלה' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <HelpCircle className="h-6 w-6 mr-2 text-indigo-600" />
          ניהול שאלות
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={isAdding}
        >
          <Plus className="h-5 w-5 mr-2" />
          הוסף שאלה
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
                <h3 className="text-lg font-medium text-indigo-900">הוספת שאלה חדשה</h3>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <QuestionForm
                question={newQuestion}
                isNew={true}
                onSave={handleAddQuestion}
                onCancel={() => setIsAdding(false)}
              />
            </div>
          )}

          {questions.length === 0 ? (
            <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
              <HelpCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">אין שאלות להצגה</p>
              <p className="text-gray-500 text-sm mt-1">לחץ על "הוסף שאלה" כדי להתחיל</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question) => (
                <div 
                  key={question._id}
                  className={`bg-white rounded-lg border ${
                    question.active ? 'border-green-200' : 'border-gray-200'
                  }`}
                >
                  {editingId === question._id ? (
                    <div className="p-6">
                      <QuestionForm
                        question={editQuestion}
                        isNew={false}
                        onSave={() => handleUpdateQuestion(question._id)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="p-4 flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              question.active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            } mr-2`}>
                              {question.active ? (
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

                            {question.types.map(type => (
                              <span 
                                key={type}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mr-2"
                              >
                                {type === 'text' && <HelpCircle className="h-3 w-3 mr-1" />}
                                {type === 'options' && <Check className="h-3 w-3 mr-1" />}
                                {type === 'api' && <Globe className="h-3 w-3 mr-1" />}
                                {type === 'text' && 'טקסט'}
                                {type === 'options' && 'בחירה'}
                                {type === 'api' && 'API'}
                              </span>
                            ))}
                          </div>

                          <div 
                            className="cursor-pointer"
                            onClick={() => setExpandedId(expandedId === question._id ? null : question._id)}
                          >
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-medium text-gray-900">
                                {question.text}
                              </h3>
                              {expandedId === question._id ? (
                                <ChevronUp className="h-5 w-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingId(question._id);
                              setEditQuestion({
                                text: question.text,
                                responseOptions: [...question.responseOptions],
                                active: question.active,
                                order: question.order,
                                types: [...question.types],
                                isRequired: question.isRequired,
                                conditions: [...question.conditions],
                                apiEndpointId: question.apiEndpointId,
                                apiDataMapping: [...question.apiDataMapping]
                              });
                            }}
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(question._id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                          <button className="cursor-move text-gray-400">
                            <DragHandleDots2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {expandedId === question._id && (
                        <div className="border-t border-gray-200 p-4">
                          {question.types.includes('options') && question.responseOptions.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-sm font-medium text-gray-700 mb-2">אפשרויות תשובה:</h4>
                              <ul className="list-disc list-inside space-y-1">
                                {question.responseOptions.map((option, index) => (
                                  <li key={index} className="text-gray-600">{option}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {question.types.includes('api') && (
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">כתובת API:</h4>
                                <div className="text-gray-600">
                                  {apiEndpoints.find(e => e._id === question.apiEndpointId)?.name || 'לא נבחרה כתובת'}
                                </div>
                              </div>

                              {question.apiDataMapping.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">מיפוי נתונים:</h4>
                                  <div className="bg-gray-50 p-4 rounded-md">
                                    <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                                      {JSON.stringify(question.apiDataMapping, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
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

export default Questions;