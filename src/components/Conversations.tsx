import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Search, User, Bot as BotIcon, Image } from 'lucide-react';

interface Message {
  from: string;
  content: string;
  timestamp: string;
  imageUrl?: string;
}

interface Conversation {
  _id: string;
  phone: string;
  messages: Message[];
  createdAt: string;
}

const Conversations: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchConversations();

    // Set up socket connection for real-time updates
    const socket = new WebSocket('ws://localhost:3001');
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'conversationUpdate') {
          updateConversation(data.conversation);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3001/api/conversations');
      setConversations(response.data);
      setLoading(false);
    } catch (err) {
      setError('שגיאה בטעינת השיחות');
      setLoading(false);
      console.error('Error fetching conversations:', err);
    }
  };

  const updateConversation = (updatedConversation: Conversation) => {
    setConversations(prevConversations => {
      const index = prevConversations.findIndex(conv => conv._id === updatedConversation._id);
      if (index !== -1) {
        const newConversations = [...prevConversations];
        newConversations[index] = updatedConversation;
        
        // If this is the currently selected conversation, update it
        if (selectedConversation && selectedConversation._id === updatedConversation._id) {
          setSelectedConversation(updatedConversation);
        }
        
        return newConversations;
      }
      return [updatedConversation, ...prevConversations];
    });
  };

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
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
    const date = new Date(timestamp);
    return date.toLocaleString('he-IL');
  };

  const filteredConversations = conversations.filter(conv => 
    conv.phone.includes(searchTerm) || 
    conv.messages.some(msg => msg.content.includes(searchTerm))
  );

  return (
    <div className="h-[calc(100vh-240px)] flex">
      {/* Conversations list */}
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="חיפוש שיחות..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-gray-500 text-center">לא נמצאו שיחות</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredConversations.map((conversation) => (
              <li 
                key={conversation._id}
                className={`hover:bg-gray-50 cursor-pointer ${
                  selectedConversation?._id === conversation._id ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleConversationSelect(conversation)}
              >
                <div className="p-4">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-900 flex items-center">
                      <User className="h-4 w-4 mr-1" />
                      {formatPhone(conversation.phone)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(conversation.createdAt).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 truncate">
                    {conversation.messages.length > 0 
                      ? conversation.messages[conversation.messages.length - 1].content 
                      : 'אין הודעות'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Conversation details */}
      <div className="w-2/3 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center">
                <MessageSquare className="h-5 w-5 text-gray-500 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">
                  שיחה עם {formatPhone(selectedConversation.phone)}
                </h3>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                התחילה ב-{new Date(selectedConversation.createdAt).toLocaleDateString('he-IL')}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedConversation.messages.map((message, index) => (
                <div 
                  key={index}
                  className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
                      message.from === 'user' 
                        ? 'bg-blue-100 text-blue-900' 
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center mb-1">
                      {message.from === 'user' ? (
                        <User className="h-4 w-4 mr-1" />
                      ) : (
                        <BotIcon className="h-4 w-4 mr-1" />
                      )}
                      <span className="text-xs font-medium">
                        {message.from === 'user' ? 'משתמש' : 'בוט'}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    
                    {message.imageUrl && (
                      <div className="mt-2">
                        <div className="flex items-center text-xs text-gray-500 mb-1">
                          <Image className="h-3 w-3 mr-1" />
                          <span>תמונה</span>
                        </div>
                        <div className="mt-1 border border-gray-200 rounded-md overflow-hidden">
                          <img 
                            src={`http://localhost:3001${message.imageUrl}`} 
                            alt="תמונה שנשלחה" 
                            className="max-w-full h-auto max-h-64 object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-gray-400" />
              <p className="mt-2">בחר שיחה מהרשימה כדי לצפות בפרטים</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Conversations;