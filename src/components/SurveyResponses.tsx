import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ClipboardList, Search, User, Calendar, CheckCircle, XCircle, Image, ChevronDown, ChevronUp } from 'lucide-react';

interface Question {
  _id: string;
  text: string;
  type: string;
}

interface Response {
  questionId: Question;
  answer: string;
  imageUrl?: string;
  answeredAt: string;
}

interface SurveyResponse {
  _id: string;
  phone: string;
  responses: Response[];
  currentQuestionId: Question | null;
  isCompleted: boolean;
  startedAt: string;
  completedAt?: string;
}

const SurveyResponses: React.FC = () => {
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedResponseId, setExpandedResponseId] = useState<string | null>(null);

  useEffect(() => {
    fetchSurveyResponses();
  }, []);

  const fetchSurveyResponses = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3001/api/survey-responses');
      setSurveyResponses(response.data);
      setLoading(false);
    } catch (err) {
      setError('שגיאה בטעינת תשובות הסקר');
      setLoading(false);
      console.error('Error fetching survey responses:', err);
    }
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

  const toggleResponseExpand = (id: string) => {
    if (expandedResponseId === id) {
      setExpandedResponseId(null);
    } else {
      setExpandedResponseId(id);
    }
  };

  const filteredResponses = surveyResponses.filter(response => 
    response.phone.includes(searchTerm) || 
    response.responses.some(r => r.answer.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <ClipboardList className="h-6 w-6 mr-2 text-indigo-600" />
          תשובות סקר
        </h2>
        <div className="relative w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="חיפוש לפי טלפון או תשובה..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            dir="rtl"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : error ? (
        <div className="p-4 text-red-500 text-center">{error}</div>
      ) : filteredResponses.length === 0 ? (
        <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
          <ClipboardList className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">לא נמצאו תשובות סקר</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResponses.map((response) => (
            <div 
              key={response._id}
              className={`bg-white rounded-lg border ${
                response.isCompleted ? 'border-green-200' : 'border-yellow-200'
              }`}
            >
              <div 
                className="p-4 flex justify-between items-center cursor-pointer"
                onClick={() => toggleResponseExpand(response._id)}
              >
                <div className="flex-1">
                  <div className="flex items-center">
                    <User className="h-5 w-5 text-gray-500 mr-2" />
                    <span className="font-medium text-gray-900">{formatPhone(response.phone)}</span>
                    
                    <span className={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      response.isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {response.isCompleted ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          הושלם
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          בתהליך
                        </>
                      )}
                    </span>
                  </div>
                  
                  <div className="mt-1 flex items-center text-sm text-gray-500">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>התחלה: {formatTimestamp(response.startedAt)}</span>
                    {response.completedAt && (
                      <span className="mr-4">סיום: {formatTimestamp(response.completedAt)}</span>
                    )}
                  </div>
                  
                  <div className="mt-1 text-sm text-gray-500">
                    <span>{response.responses.length} תשובות</span>
                  </div>
                </div>
                
                <div>
                  {expandedResponseId === response._id ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
              
              {expandedResponseId === response._id && (
                <div className="border-t border-gray-200 p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">תשובות</h3>
                  
                  {response.responses.length === 0 ? (
                    <p className="text-gray-500 text-center">אין תשובות עדיין</p>
                  ) : (
                    <div className="space-y-4">
                      {response.responses.map((resp, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-md">
                          <div className="flex justify-between">
                            <h4 className="font-medium text-gray-900">{resp.questionId?.text || 'שאלה לא זמינה'}</h4>
                            <span className="text-sm text-gray-500">{formatTimestamp(resp.answeredAt)}</span>
                          </div>
                          
                          {resp.questionId?.type === 'image' && resp.imageUrl ? (
                            <div className="mt-2">
                              <div className="flex items-center text-sm text-gray-500 mb-2">
                                <Image className="h-4 w-4 mr-1" />
                                <span>תמונה</span>
                              </div>
                              <div className="mt-2 border border-gray-200 rounded-md overflow-hidden">
                                <img 
                                  src={`http://localhost:3001${resp.imageUrl}`} 
                                  alt="תמונת תשובה" 
                                  className="max-w-full h-auto max-h-64 object-contain mx-auto"
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 text-gray-700">{resp.answer}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {!response.isCompleted && response.currentQuestionId && (
                    <div className="mt-4 bg-yellow-50 p-4 rounded-md">
                      <h4 className="font-medium text-yellow-800">שאלה נוכחית</h4>
                      <p className="mt-1 text-yellow-700">{response.currentQuestionId.text}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SurveyResponses;