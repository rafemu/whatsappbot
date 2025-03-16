import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileCheck, Search, CheckCircle, XCircle } from 'lucide-react';

interface Verification {
  _id: string;
  phone: string;
  idNumber: string;
  verificationResult: {
    valid: boolean;
    idNumber: string;
    checkDate: string;
    reason: string;
  };
  verifiedAt: string;
}

const Verifications: React.FC = () => {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3001/api/verifications');
      setVerifications(response.data);
      setLoading(false);
    } catch (err) {
      setError('שגיאה בטעינת אימותי תעודות זהות');
      setLoading(false);
      console.error('Error fetching verifications:', err);
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
    const date = new Date(timestamp);
    return date.toLocaleString('he-IL');
  };

  const filteredVerifications = verifications.filter(v => 
    v.phone.includes(searchTerm) || 
    v.idNumber.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <FileCheck className="h-6 w-6 mr-2 text-blue-600" />
          אימותי תעודות זהות
        </h2>
        <div className="relative w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="חיפוש לפי טלפון או ת.ז..."
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
      ) : filteredVerifications.length === 0 ? (
        <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
          <FileCheck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">לא נמצאו אימותי תעודות זהות</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מספר טלפון
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  תעודת זהות
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סטטוס
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סיבה
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  תאריך אימות
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVerifications.map((verification) => (
                <tr key={verification._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatPhone(verification.phone)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                    {verification.idNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {verification.verificationResult.valid ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        תקין
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="h-4 w-4 mr-1" />
                        לא תקין
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {verification.verificationResult.reason}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTimestamp(verification.verifiedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Verifications;