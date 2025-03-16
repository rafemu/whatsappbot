import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HelpCircle, Plus, Edit, Trash2, Save, X, Image, MessageSquare, List, MoveUp, MoveDown, Check, Globe, AlertCircle } from 'lucide-react';

interface Question {
  _id: string;
  text: string;
  responseOptions: string[];
  active: boolean;
  types: ('text' | 'options' | 'image' | 'conditional' | 'api')[]; // תמיד מערך, לא יכול להיות undefined

  order: number;
  isRequired: boolean;
  conditions?: {
    questionId: string;
    answer: string;
    operator: 'equals' | 'contains' | 'not_equals';
  }[];
  apiEndpointId?: string;
  apiMessages?: {
    confirmationMessage: string;
    processingMessage: string;
    declineMessage: string;
  };
  completionMessage?: {
    text: string;
    conditions: {
      questionId: string;
      answer: string;
      operator: 'equals' | 'contains' | 'not_equals';
    }[];
  };
}

interface ApiEndpoint {
  _id: string;
  name: string;
  url: string;
}

const Questions: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [apiEndpoints, setApiEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newQuestion, setNewQuestion] = useState({
    text: '',
    responseOptions: ['כן', 'לא'],
    active: true,
    types: [] as Question['types'],
    order: 0,
    isRequired: false,
    conditions: [] as Question['conditions'],
    apiEndpointId: '',
    apiMessages: {
      confirmationMessage: 'האם ברצונך לבצע את הבדיקה?',
      processingMessage: 'הבדיקה החלה, אנא המתן...',
      declineMessage: 'הבדיקה בוטלה לבקשתך.'
    },
    completionMessage: {
      text: '',
      conditions: [] as {
        questionId: string;
        answer: string;
        operator: 'equals' | 'contains' | 'not_equals';
      }[]
    }
  });

  const [editQuestion, setEditQuestion] = useState<{
    text: string;
    responseOptions: string[];
    active: boolean;
    types: Question['types'];
    order: number;
    isRequired: boolean;
    conditions: NonNullable<Question['conditions']>;
    apiEndpointId: string;
    apiMessages: NonNullable<Question['apiMessages']>;
    completionMessage: {
      text: string;
      conditions: {
        questionId: string;
        answer: string;
        operator: 'equals' | 'contains' | 'not_equals';
      }[];
    };
  }>({
    text: '',
    responseOptions: ['כן', 'לא'],
    active: true,
    types: [],
    order: 0,
    isRequired: false,
    conditions: [],
    apiEndpointId: '',
    apiMessages: {
      confirmationMessage: 'האם ברצונך לבצע את הבדיקה?',
      processingMessage: 'הבדיקה החלה, אנא המתן...',
      declineMessage: 'הבדיקה בוטלה לבקשתך.'
    },
    completionMessage: {
      text: '',
      conditions: []
    }
  });

  useEffect(() => {
    fetchQuestions();
    fetchApiEndpoints();
  }, []);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3001/api/questions');
      const fetchedQuestions = response.data.map((q: Question) => ({
        ...q,
        types: q.types || [] // וידוא שהשדה תמיד קיים
      }));
      setQuestions(fetchedQuestions);
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

      if (newQuestion.types.includes('options') && 
          newQuestion.responseOptions.filter(opt => opt.trim()).length === 0) {
        alert('יש להזין לפחות אפשרות תשובה אחת לשאלת בחירה');
        return;
      }

      if (newQuestion.types.includes('api') && !newQuestion.apiEndpointId) {
        alert('יש לבחור כתובת API');
        return;
      }
      console.log(newQuestion)
      const response = await axios.post('http://localhost:3001/api/questions', newQuestion);
      setQuestions([...questions, response.data]);
      setIsAdding(false);
      setNewQuestion({
        text: '',
        responseOptions: ['כן', 'לא'],
        active: true,
        types: [],
        order: 0,
        isRequired: false,
        conditions: [],
        apiEndpointId: '',
        apiMessages: {
          confirmationMessage: 'האם ברצונך לבצע את הבדיקה?',
          processingMessage: 'הבדיקה החלה, אנא המתן...',
          declineMessage: 'הבדיקה בוטלה לבקשתך.'
        },
        completionMessage: {
          text: '',
          conditions: []
        }
      });
    } catch (err) {
      console.error('Error adding question:', err);
      alert('שגיאה בהוספת השאלה');
    }
  };

  const handleUpdateQuestion = async (id: string) => {
    try {
      if (!editQuestion.text.trim()) {
        alert('יש להזין טקסט לשאלה');
        return;
      }

      if (editQuestion.types.includes('options') && 
          editQuestion.responseOptions.filter(opt => opt.trim()).length === 0) {
        alert('יש להזין לפחות אפשרות תשובה אחת לשאלת בחירה');
        return;
      }

      if (editQuestion.types.includes('api') && !editQuestion.apiEndpointId) {
        alert('יש לבחור כתובת API');
        return;
      }

      const response = await axios.put(`http://localhost:3001/api/questions/${id}`, editQuestion);
      setQuestions(questions.map(q => q._id === id ? response.data : q));
      setEditingId(null);
    } catch (err) {
      console.error('Error updating question:', err);
      alert('שגיאה בעדכון השאלה');
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

  const handleMoveQuestion = async (id: string, direction: 'up' | 'down') => {
    try {
      const index = questions.findIndex(q => q._id === id);
      if (index === -1) return;

      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === questions.length - 1) return;

      const newQuestions = [...questions];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      const temp = newQuestions[index].order;
      newQuestions[index].order = newQuestions[targetIndex].order;
      newQuestions[targetIndex].order = temp;

      [newQuestions[index], newQuestions[targetIndex]] = 
      [newQuestions[targetIndex], newQuestions[index]];

      const questionIds = newQuestions.map(q => q._id);
      await axios.post('http://localhost:3001/api/questions/reorder', { questionIds });

      setQuestions(newQuestions);
    } catch (err) {
      console.error('Error moving question:', err);
      alert('שגיאה בשינוי סדר השאלות');
    }
  };

  const handleTypeToggle = (type: Question['types'][0], isNew: boolean) => {
    if (isNew) {
      const types = newQuestion.types.includes(type)
        ? newQuestion.types.filter(t => t !== type)
        : [...newQuestion.types, type];

      setNewQuestion({
        ...newQuestion,
        types,
        responseOptions: types.includes('options') && newQuestion.responseOptions.length === 0 
          ? [''] 
          : newQuestion.responseOptions
      });
    } else {
      const types = editQuestion.types.includes(type)
        ? editQuestion.types.filter(t => t !== type)
        : [...editQuestion.types, type];

      setEditQuestion({
        ...editQuestion,
        types,
        responseOptions: types.includes('options') && editQuestion.responseOptions.length === 0 
          ? [''] 
          : editQuestion.responseOptions
      });
    }
  };

  const handleAddCondition = (isNew: boolean, type: 'question' | 'completion' = 'question') => {
    const newCondition = {
      questionId: '',
      answer: '',
      operator: 'equals' as const
    };

    if (isNew) {
      if (type === 'completion') {
        setNewQuestion({
          ...newQuestion,
          completionMessage: {
            ...newQuestion.completionMessage,
            conditions: [...newQuestion.completionMessage.conditions, newCondition]
          }
        });
      } else {
        setNewQuestion({
          ...newQuestion,
          conditions: [...(newQuestion.conditions || []), newCondition]
        });
      }
    } else {
      if (type === 'completion') {
        setEditQuestion({
          ...editQuestion,
          completionMessage: {
            ...editQuestion.completionMessage,
            conditions: [...editQuestion.completionMessage.conditions, newCondition]
          }
        });
      } else {
        setEditQuestion({
          ...editQuestion,
          conditions: [...editQuestion.conditions, newCondition]
        });
      }
    }
  };

  const handleRemoveCondition = (index: number, isNew: boolean, type: 'question' | 'completion' = 'question') => {
    if (isNew) {
      if (type === 'completion') {
        const conditions = [...newQuestion.completionMessage.conditions];
        conditions.splice(index, 1);
        setNewQuestion({
          ...newQuestion,
          completionMessage: {
            ...newQuestion.completionMessage,
            conditions
          }
        });
      } else {
        const conditions = [...(newQuestion.conditions || [])];
        conditions.splice(index, 1);
        setNewQuestion({ ...newQuestion, conditions });
      }
    } else {
      if (type === 'completion') {
        const conditions = [...editQuestion.completionMessage.conditions];
        conditions.splice(index, 1);
        setEditQuestion({
          ...editQuestion,
          completionMessage: {
            ...editQuestion.completionMessage,
            conditions
          }
        });
      } else {
        const conditions = [...editQuestion.conditions];
        conditions.splice(index, 1);
        setEditQuestion({ ...editQuestion, conditions });
      }
    }
  };

  const handleConditionChange = (
    index: number, 
    field: 'questionId' | 'answer' | 'operator',
    value: string,
    isNew: boolean,
    type: 'question' | 'completion' = 'question'
  ) => {
    if (isNew) {
      if (type === 'completion') {
        const conditions = [...newQuestion.completionMessage.conditions];
        conditions[index] = { ...conditions[index], [field]: value };
        setNewQuestion({
          ...newQuestion,
          completionMessage: {
            ...newQuestion.completionMessage,
            conditions
          }
        });
      } else {
        const conditions = [...(newQuestion.conditions || [])];
        conditions[index] = { ...conditions[index], [field]: value };
        setNewQuestion({ ...newQuestion, conditions });
      }
    } else {
      if (type === 'completion') {
        const conditions = [...editQuestion.completionMessage.conditions];
        conditions[index] = { ...conditions[index], [field]: value };
        setEditQuestion({
          ...editQuestion,
          completionMessage: {
            ...editQuestion.completionMessage,
            conditions
          }
        });
      } else {
        const conditions = [...editQuestion.conditions];
        conditions[index] = { ...conditions[index], [field]: value };
        setEditQuestion({ ...editQuestion, conditions });
      }
    }
  };

  const handleCompletionMessageChange = (value: string, isNew: boolean) => {
    if (isNew) {
      setNewQuestion({
        ...newQuestion,
        completionMessage: {
          ...newQuestion.completionMessage,
          text: value
        }
      });
    } else {
      setEditQuestion({
        ...editQuestion,
        completionMessage: {
          ...editQuestion.completionMessage,
          text: value
        }
      });
    }
  };

  const QuestionTypesSelector = ({ 
    types, 
    onTypeToggle 
  }: { 
    types: Question['types'];
    onTypeToggle: (type: Question['types'][0]) => void;
  }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        סוגי שאלה (ניתן לבחור מספר סוגים)
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onTypeToggle('text')}
          className={`inline-flex items-center px-3 py-2 border ${
            types.includes('text')
              ? 'border-purple-500 bg-purple-50 text-purple-700'
              : 'border-gray-300 bg-white text-gray-700'
          } rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
        >
          <MessageSquare className="h-4 w-4 mr-1" />
          טקסט
        </button>

        <button
          type="button"
          onClick={() => onTypeToggle('options')}
          className={`inline-flex items-center px-3 py-2 border ${
            types.includes('options')
              ? 'border-purple-500 bg-purple-50 text-purple-700'
              : 'border-gray-300 bg-white text-gray-700'
          } rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
        >
          <List className="h-4 w-4 mr-1" />
          בחירה
        </button>

        <button
          type="button"
          onClick={() => onTypeToggle('image')}
          className={`inline-flex items-center px-3 py-2 border ${
            types.includes('image')
              ? 'border-purple-500 bg-purple-50 text-purple-700'
              : 'border-gray-300 bg-white text-gray-700'
          } rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
        >
          <Image className="h-4 w-4 mr-1" />
          תמונה
        </button>

        <button
          type="button"
          onClick={() => onTypeToggle('conditional')}
          className={`inline-flex items-center px-3 py-2 border ${
            types.includes('conditional')
              ? 'border-purple-500 bg-purple-50 text-purple-700'
              : 'border-gray-300 bg-white text-gray-700'
          } rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
        >
          <AlertCircle className="h-4 w-4 mr-1" />
          מותנה
        </button>

        <button
          type="button"
          onClick={() => onTypeToggle('api')}
          className={`inline-flex items-center px-3 py-2 border ${
            types.includes('api')
              ? 'border-purple-500 bg-purple-50 text-purple-700'
              : 'border-gray-300 bg-white text-gray-700'
          } rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
        >
          <Globe className="h-4 w-4 mr-1" />
          API
        </button>
      </div>
    </div>
  );

  const ConditionsForm = ({
    conditions,
    isNew,
    availableQuestions,
    onAddCondition,
    onRemoveCondition,
    onConditionChange,
    type = 'question'
  }: {
    conditions: NonNullable<Question['conditions']>;
    isNew: boolean;
    availableQuestions: Question[];
    onAddCondition: () => void;
    onRemoveCondition: (index: number) => void;
    onConditionChange: (index: number, field: string, value: string) => void;
    type?: 'question' | 'completion';
  }) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">
          {type === 'completion' ? 'תנאים להצגת הודעת הסיום' : 'תנאים להצגת השאלה'}
        </h3>
        <button
          type="button"
          onClick={onAddCondition}
          className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          <Plus className="h-4 w-4 mr-1" />
          הוסף תנאי
        </button>
      </div>

      {conditions.map((condition, index) => (
        <div key={index} className="flex items-start space-x-2">
          <div className="flex-1 space-y-2">
            <select
              value={condition.questionId}
              onChange={(e) => onConditionChange(index, 'questionId', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
            >
              <option value="">בחר שאלה</option>
              {availableQuestions.map(q => (
                <option key={q._id} value={q._id}>{q.text}</option>
              ))}
            </select>

            <select
              value={condition.operator}
              onChange={(e) => onConditionChange(index, 'operator', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
            >
              <option value="equals">שווה ל</option>
              <option value="contains">מכיל</option>
              <option value="not_equals">לא שווה ל</option>
            </select>

            <input
              type="text"
              value={condition.answer}
              onChange={(e) => onConditionChange(index, 'answer', e.target.value)}
              placeholder="ערך לבדיקה"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
            />
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

  const ApiForm = ({
    apiEndpointId,
    apiMessages,
    onApiChange,
    isNew
  }: {
    apiEndpointId: string;
    apiMessages: NonNullable<Question['apiMessages']>;
    onApiChange: (field: string, value: string) => void;
    isNew: boolean;
  }) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          בחר כתובת API
        </label>
        <select
          value={apiEndpointId}
          onChange={(e) => onApiChange('apiEndpointId', e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
        >
          <option value="">בחר כתובת API</option>
          {apiEndpoints.map(endpoint => (
            <option key={endpoint._id} value={endpoint._id}>{endpoint.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          הודעת אישור
        </label>
        <input
          type="text"
          value={apiMessages.confirmationMessage}
          onChange={(e) => onApiChange('confirmationMessage', e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
          placeholder="האם ברצונך לבצע את הבדיקה?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          הודעת עיבוד
        </label>
        <input
          type="text"
          value={apiMessages.processingMessage}
          onChange={(e) => onApiChange('processingMessage', e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
          placeholder="הבדיקה החלה, אנא המתן..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          הודעת ביטול
        </label>
        <input
          type="text"
          value={apiMessages.declineMessage}
          onChange={(e) => onApiChange('declineMessage', e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
          placeholder="הבדיקה בוטלה לבקשתך."
        />
      </div>
    </div>
  );

  const CompletionMessageForm = ({
    completionMessage,
    isNew,
    availableQuestions,
    onMessageChange,
    onAddCondition,
    onRemoveCondition,
    onConditionChange
  }: {
    completionMessage: {
      text: string;
      conditions: {
        questionId: string;
        answer: string;
        operator: 'equals' | 'contains' | 'not_equals';
      }[];
    };
    isNew: boolean;
    availableQuestions: Question[];
    onMessageChange: (value: string) => void;
    onAddCondition: () => void;
    onRemoveCondition: (index: number) => void;
    onConditionChange: (index: number, field: string, value: string) => void;
  }) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          הודעת סיום
        </label>
        <textarea
          value={completionMessage.text}
          onChange={(e) => onMessageChange(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
          rows={3}
          placeholder="הודעת הסיום שתוצג למשתמש..."
        />
      </div>

      <ConditionsForm
        conditions={completionMessage.conditions}
        isNew={isNew}
        availableQuestions={availableQuestions}
        onAddCondition={onAddCondition}
        onRemoveCondition={onRemoveCondition}
        onConditionChange={onConditionChange}
        type="completion"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <HelpCircle className="h-6 w-6 mr-2 text-purple-600" />
          ניהול שאלות סקר
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          disabled={isAdding}
        >
          <Plus className="h-5 w-5 mr-2" />
          הוסף שאלה חדשה
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
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-purple-900">הוספת שאלה חדשה</h3>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="new-question-text" className="block text-sm font-medium text-gray-700 mb-1">
                    טקסט השאלה
                  </label>
                  <textarea
                    id="new-question-text"
                    rows={3}
                    className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={newQuestion.text}
                    onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                    dir="rtl"
                  />
                </div>

                <QuestionTypesSelector
                  types={newQuestion.types}
                  onTypeToggle={(type) => handleTypeToggle(type, true)}
                />

                {newQuestion.types.includes('options') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      אפשרויות תשובה
                    </label>
                    <div className="space-y-2">
                      {newQuestion.responseOptions.map((option, index) => (
                        <div key={index} className="flex items-center">
                          <input
                            type="text"
                            className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            value={option}
                            onChange={(e) => {
                              const options = [...newQuestion.responseOptions];
                              options[index] = e.target.value;
                              setNewQuestion({ ...newQuestion, responseOptions: options });
                            }}
                            placeholder={`אפשרות ${index + 1}`}
                            dir="rtl"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const options = [...newQuestion.responseOptions];
                              options.splice(index, 1);
                              setNewQuestion({ ...newQuestion, responseOptions: options });
                            }}
                            className="mr-2 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setNewQuestion({
                          ...newQuestion,
                          responseOptions: [...newQuestion.responseOptions, '']
                        })}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline- none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        הוסף אפשרות תשובה
                      </button>
                    </div>
                  </div>
                )}

                {newQuestion.types.includes('conditional') && (
                  <ConditionsForm
                    conditions={newQuestion.conditions || []}
                    isNew={true}
                    availableQuestions={questions}
                    onAddCondition={() => handleAddCondition(true)}
                    onRemoveCondition={(index) => handleRemoveCondition(index, true)}
                    onConditionChange={(index, field, value) => handleConditionChange(index, field as any, value, true)}
                  />
                )}

                {newQuestion.types.includes('api') && (
                  <ApiForm
                    apiEndpointId={newQuestion.apiEndpointId}
                    apiMessages={newQuestion.apiMessages}
                    onApiChange={(field, value) => {
                      if (field === 'apiEndpointId') {
                        setNewQuestion({ ...newQuestion, apiEndpointId: value });
                      } else {
                        setNewQuestion({
                          ...newQuestion,
                          apiMessages: {
                            ...newQuestion.apiMessages,
                            [field]: value
                          }
                        });
                      }
                    }}
                    isNew={true}
                  />
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">הודעת סיום מותאמת אישית</h3>
                  <CompletionMessageForm
                    completionMessage={newQuestion.completionMessage}
                    isNew={true}
                    availableQuestions={questions}
                    onMessageChange={(value) => handleCompletionMessageChange(value, true)}
                    onAddCondition={() => handleAddCondition(true, 'completion')}
                    onRemoveCondition={(index) => handleRemoveCondition(index, true, 'completion')}
                    onConditionChange={(index, field, value) => handleConditionChange(index, field as any, value, true, 'completion')}
                  />
                </div>

                <div className="flex items-center">
                  <input
                    id="new-question-required"
                    type="checkbox"
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    checked={newQuestion.isRequired}
                    onChange={(e) => setNewQuestion({ ...newQuestion, isRequired: e.target.checked })}
                  />
                  <label htmlFor="new-question-required" className="mr-2 block text-sm text-gray-900">
                    שאלת חובה
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    id="new-question-active"
                    type="checkbox"
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    checked={newQuestion.active}
                    onChange={(e) => setNewQuestion({ ...newQuestion, active: e.target.checked })}
                  />
                  <label htmlFor="new-question-active" className="mr-2 block text-sm text-gray-900">
                    פעיל
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    שמור שאלה
                  </button>
                </div>
              </div>
            </div>
          )}

          {questions.length === 0 ? (
            <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
              <HelpCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">אין שאלות להצגה</p>
              <p className="text-gray-500 text-sm mt-1">לחץ על "הוסף שאלה חדשה" כדי להתחיל</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div 
                  key={question._id}
                  className={`bg-white p-6 rounded-lg border ${
                    question.active ? 'border-green-200' : 'border-gray-200'
                  }`}
                >
                  {editingId === question._id ? (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor={`edit-question-${question._id}`} className="block text-sm font-medium text-gray-700 mb-1">
                          טקסט השאלה
                        </label>
                        <textarea
                          id={`edit-question-${question._id}`}
                          rows={3}
                          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={editQuestion.text}
                          onChange={(e) => setEditQuestion({ ...editQuestion, text: e.target.value })}
                          dir="rtl"
                        />
                      </div>

                      <QuestionTypesSelector
                        types={editQuestion.types}
                        onTypeToggle={(type) => handleTypeToggle(type, false)}
                      />

                      {editQuestion.types.includes('options') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            אפשרויות תשובה
                          </label>
                          <div className="space-y-2">
                            {editQuestion.responseOptions.map((option, index) => (
                              <div key={index} className="flex items-center">
                                <input
                                  type="text"
                                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                  value={option}
                                  onChange={(e) => {
                                    const options = [...editQuestion.responseOptions];
                                    options[index] = e.target.value;
                                    setEditQuestion({ ...editQuestion, responseOptions: options });
                                  }}
                                  placeholder={`אפשרות ${index + 1}`}
                                  dir="rtl"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const options = [...editQuestion.responseOptions];
                                    options.splice(index, 1);
                                    setEditQuestion({ ...editQuestion, responseOptions: options });
                                  }}
                                  className="mr-2 text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setEditQuestion({
                                ...editQuestion,
                                responseOptions: [...editQuestion.responseOptions, '']
                              })}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              הוסף אפשרות תשובה
                            </button>
                          </div>
                        </div>
                      )}

                      {editQuestion.types.includes('conditional') && (
                        <ConditionsForm
                          conditions={editQuestion.conditions}
                          isNew={false}
                          availableQuestions={questions.filter(q => q._id !== question._id)}
                          onAddCondition={() => handleAddCondition(false)}
                          onRemoveCondition={(index) => handleRemoveCondition(index, false)}
                          onConditionChange={(index, field, value) => handleConditionChange(index, field as any, value, false)}
                        />
                      )}

                      {editQuestion.types.includes('api') && (
                        <ApiForm
                          apiEndpointId={editQuestion.apiEndpointId}
                          apiMessages={editQuestion.apiMessages}
                          onApiChange={(field, value) => {
                            if (field === 'apiEndpointId') {
                              setEditQuestion({ ...editQuestion, apiEndpointId: value });
                            } else {
                              setEditQuestion({
                                ...editQuestion,
                                apiMessages: {
                                  ...editQuestion.apiMessages,
                                  [field]: value
                                }
                              });
                            }
                          }}
                          isNew={false}
                        />
                      )}

                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">הודעת סיום מותאמת אישית</h3>
                        <CompletionMessageForm
                          completionMessage={editQuestion.completionMessage}
                          isNew={false}
                          availableQuestions={questions.filter(q => q._id !== question._id)}
                          onMessageChange={(value) => handleCompletionMessageChange(value, false)}
                          onAddCondition={() => handleAddCondition(false, 'completion')}
                          onRemoveCondition={(index) => handleRemoveCondition(index, false, 'completion')}
                          onConditionChange={(index, field, value) => handleConditionChange(index, field as any, value, false, 'completion')}
                        />
                      </div>

                      <div className="flex items-center">
                        <input
                          id={`edit-question-required-${question._id}`}
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          checked={editQuestion.isRequired}
                          onChange={(e) => setEditQuestion({ ...editQuestion, isRequired: e.target.checked })}
                        />
                        <label htmlFor={`edit-question-required-${question._id}`} className="mr-2 block text-sm text-gray-900">
                          שאלת חובה
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          id={`edit-question-active-${question._id}`}
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          checked={editQuestion.active}
                          onChange={(e) => setEditQuestion({ ...editQuestion, active: e.target.checked })}
                        />
                        <label htmlFor={`edit-question-active-${question._id}`} className="mr-2 block text-sm text-gray-900">
                          פעיל
                        </label>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <X className="h-5 w-5 mr-1" />
                          ביטול
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuestion(question._id)}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                            <div className="flex flex-wrap gap-2">
                              {(question.types || []).map((type) => {
  const typeConfig = {
    text: { icon: MessageSquare, label: 'טקסט', color: 'gray' },
    options: { icon: List, label: 'בחירה', color: 'blue' },
    image: { icon: Image, label: 'תמונה', color: 'green' },
    conditional: { icon: AlertCircle, label: 'מותנה', color: 'yellow' },
    api: { icon: Globe, label: 'API', color: 'purple' }
  }[type];

  if (!typeConfig) return null;

                                const Icon = typeConfig.icon;

                                return (
                                  <span
                                    key={type}
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${typeConfig.color}-100 text-${typeConfig.color}-800`}
                                  >
                                    <Icon className="h-3 w-3 mr-1" />
                                    {typeConfig.label}
                                  </span>
                                );
                              })}

                              {question.isRequired && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <Check className="h-3 w-3 mr-1" />
                                  חובה
                                </span>
                              )}
                            </div>

                            <span className="text-sm text-gray-500 mr-2">#{question.order + 1}</span>
                          </div>

                          <h3 className="text-lg font-medium text-gray-900 mb-2">{question.text}</h3>

                          {question.types.includes('options') && question.responseOptions.length > 0 && (
                            <div className="mt-2">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">אפשרויות תשובה:</h4>
                              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                {question.responseOptions.map((option, index) => (
                                  <li key={index}>{option}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {question.types.includes('conditional') && question.conditions && question.conditions.length > 0 && (
                            <div className="mt-2">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">תנאים להצגה:</h4>
                              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                {question.conditions.map((condition, index) => {
                                  const relatedQuestion = questions.find(q => q._id === condition.questionId);
                                  return (
                                    <li key={index}>
                                      {relatedQuestion?.text} {condition.operator === 'equals' ? 'שווה ל' : condition.operator === 'contains' ? 'מכיל' : 'לא שווה ל'} "{condition.answer}"
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          {question.types.includes('api') && question.apiEndpointId && (
                            <div className="mt-2">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">הגדרות API:</h4>
                              <div className="text-sm text-gray-600">
                                <p>כתובת API: {apiEndpoints.find(e => e._id === question.apiEndpointId)?.name}</p>
                                {question.apiMessages && (
                                  <>
                                    <p>הודעת אישור: {question.apiMessages.confirmationMessage}</p>
                                    <p>הודעת עיבוד: {question.apiMessages.processingMessage}</p>
                                    <p>הודעת ביטול: {question.apiMessages.declineMessage}</p>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {question.completionMessage && question.completionMessage.text && (
                            <div className="mt-2">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">הודעת סיום מותאמת אישית:</h4>
                              <p className="text-sm text-gray-600">{question.completionMessage.text}</p>
                              {question.completionMessage.conditions && question.completionMessage.conditions.length > 0 && (
                                <div className="mt-1">
                                  <h5 className="text-sm font-medium text-gray-700">תנאים להצגת ההודעה:</h5>
                                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                    {question.completionMessage.conditions.map((condition, index) => {
                                      const relatedQuestion = questions.find(q => q._id === condition.questionId);
                                      return (
                                        <li key={index}>
                                          {relatedQuestion?.text} {condition.operator === 'equals' ? 'שווה ל' : condition.operator === 'contains' ? 'מכיל' : 'לא שווה ל'} "{condition.answer}"
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              const currentQuestion = questions.find(q => q._id === question._id);
                              if (currentQuestion) {
                                setEditingId(question._id);
                                setEditQuestion({
                                  text: currentQuestion.text,
                                  responseOptions: [...currentQuestion.responseOptions],
                                  active: currentQuestion.active,
                                  types: [...currentQuestion.types],
                                  order: currentQuestion.order,
                                  isRequired: currentQuestion.isRequired,
                                  conditions: currentQuestion.conditions || [],
                                  apiEndpointId: currentQuestion.apiEndpointId || '',
                                  apiMessages: currentQuestion.apiMessages || {
                                    confirmationMessage: 'האם ברצונך לבצע את הבדיקה?',
                                    processingMessage: 'הבדיקה החלה, אנא המתן...',
                                    declineMessage: 'הבדיקה בוטלה לבקשתך.'
                                  },
                                  completionMessage: currentQuestion.completionMessage || {
                                    text: '',
                                    conditions: []
                                  }
                                });
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(question._id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleMoveQuestion(question._id, 'up')}
                            disabled={index === 0}
                            className={`p-1 rounded ${
                              index === 0 
                                ? 'text-gray-300 cursor-not-allowed' 
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                            title="העבר למעלה"
                          >
                            <MoveUp className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleMoveQuestion(question._id, 'down')}
                            disabled={index === questions.length - 1}
                            className={`p-1 rounded ${
                              index === questions.length - 1 
                                ? 'text-gray-300 cursor-not-allowed' 
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                            title="העבר למטה"
                          >
                            <MoveDown className="h-5 w-5" />
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

export default Questions;