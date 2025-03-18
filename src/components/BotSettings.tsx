import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Save, RefreshCw, Bell, Globe, Clock, Shield } from 'lucide-react';

interface BotConfig {
  maxSessions: number;
  autoRestart: {
    enabled: boolean;
    maxAttempts: number;
    delayBetweenAttempts: number;
  };
  survey: {
    allowMultipleAttempts: boolean;
    allowContinuation: boolean;
    followUp: {
      enabled: boolean;
      timing: number;
      maxAttempts: number;
      webhook: {
        url: string;
        enabled: boolean;
        customHeaders: Map<string, string>;
      };
    };
  };
  callMonitoring: {
    enabled: boolean;
    webhook: {
      url: string;
      enabled: boolean;
      customHeaders: Map<string, string>;
    };
    notifications: {
      email: {
        enabled: boolean;
        recipients: string[];
      };
    };
  };
  dataRetention: {
    surveyResponses: number;
    callLogs: number;
  };
  rateLimiting: {
    enabled: boolean;
    maxRequestsPerMinute: number;
    blockDuration: number;
  };
}

const BotSettings: React.FC = () => {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3001/api/bot/config');
      setConfig(response.data);
      setError('');
    } catch (err) {
      setError('שגיאה בטעינת ההגדרות');
      console.error('Error fetching bot config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      await axios.put('http://localhost:3001/api/bot/config', config);
      setSuccessMessage('ההגדרות נשמרו בהצלחה');
      setError('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('שגיאה בשמירת ההגדרות');
      console.error('Error saving bot config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (path: string, value: any) => {
    if (!config) return;

    const updateNestedValue = (obj: any, path: string[], value: any): any => {
      const [current, ...rest] = path;
      if (rest.length === 0) {
        return { ...obj, [current]: value };
      }
      return {
        ...obj,
        [current]: updateNestedValue(obj[current], rest, value)
      };
    };

    const pathArray = path.split('.');
    const newConfig = updateNestedValue(config, pathArray, value);
    setConfig(newConfig);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center text-red-600">
        שגיאה בטעינת ההגדרות
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <Settings className="h-6 w-6 mr-2 text-indigo-600" />
          הגדרות בוט
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchConfig}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            רענן
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            שמור הגדרות
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-700">
          {successMessage}
        </div>
      )}

      <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
        {/* Session Management */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">ניהול סשנים</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                מספר סשנים מקסימלי
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.maxSessions}
                onChange={(e) => handleInputChange('maxSessions', parseInt(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={config.autoRestart.enabled}
                onChange={(e) => handleInputChange('autoRestart.enabled', e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="mr-2 block text-sm text-gray-900">
                הפעל אתחול אוטומטי
              </label>
            </div>

            {config.autoRestart.enabled && (
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    מספר ניסיונות מקסימלי
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={config.autoRestart.maxAttempts}
                    onChange={(e) => handleInputChange('autoRestart.maxAttempts', parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    השהייה בין ניסיונות (מילישניות)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={config.autoRestart.delayBetweenAttempts}
                    onChange={(e) => handleInputChange('autoRestart.delayBetweenAttempts', parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Survey Settings */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">הגדרות סקר</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={config.survey.allowMultipleAttempts}
                onChange={(e) => handleInputChange('survey.allowMultipleAttempts', e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="mr-2 block text-sm text-gray-900">
                אפשר מספר ניסיונות
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={config.survey.allowContinuation}
                onChange={(e) => handleInputChange('survey.allowContinuation', e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="mr-2 block text-sm text-gray-900">
                אפשר המשך מהשאלה האחרונה
              </label>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-2">מעקב אחר סקרים לא מושלמים</h4>
              
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  checked={config.survey.followUp.enabled}
                  onChange={(e) => handleInputChange('survey.followUp.enabled', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="mr-2 block text-sm text-gray-900">
                  הפעל מעקב
                </label>
              </div>

              {config.survey.followUp.enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      זמן המתנה בין ניסיונות (שעות)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="72"
                      value={config.survey.followUp.timing}
                      onChange={(e) => handleInputChange('survey.followUp.timing', parseInt(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      מספר ניסיונות מקסימלי
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.survey.followUp.maxAttempts}
                      onChange={(e) => handleInputChange('survey.followUp.maxAttempts', parseInt(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <div className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={config.survey.followUp.webhook.enabled}
                        onChange={(e) => handleInputChange('survey.followUp.webhook.enabled', e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label className="mr-2 block text-sm text-gray-900">
                        שלח עדכונים ל-Webhook
                      </label>
                    </div>

                    {config.survey.followUp.webhook.enabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          כתובת Webhook
                        </label>
                        <div className="mt-1">
                          <input
                            type="url"
                            value={config.survey.followUp.webhook.url}
                            onChange={(e) => handleInputChange('survey.followUp.webhook.url', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="https://example.com/webhook/{phone}"
                            dir="ltr"
                          />
                          <p className="mt-1 text-sm text-gray-500">
                            ניתן להשתמש ב-{'{phone}'} בכתובת ה-URL כדי לכלול את מספר הטלפון של המשתמש
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Call Monitoring */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">ניטור שיחות</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={config.callMonitoring.enabled}
                onChange={(e) => handleInputChange('callMonitoring.enabled', e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="mr-2 block text-sm text-gray-900">
                הפעל ניטור שיחות
              </label>
            </div>

            {config.callMonitoring.enabled && (
              <>
                <div>
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      checked={config.callMonitoring.webhook.enabled}
                      onChange={(e) => handleInputChange('callMonitoring.webhook.enabled', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label className="mr-2 block text-sm text-gray-900">
                      שלח עדכונים ל-Webhook
                    </label>
                  </div>

                  {config.callMonitoring.webhook.enabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        כתובת Webhook
                      </label>
                      <div className="mt-1">
                        <input
                          type="url"
                          value={config.callMonitoring.webhook.url}
                          onChange={(e) => handleInputChange('callMonitoring.webhook.url', e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="https://example.com/webhook/{phone}"
                          dir="ltr"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          ניתן להשתמש ב-{'{phone}'} בכתובת ה-URL כדי לכלול את מספר הטלפון של המשתמש
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      checked={config.callMonitoring.notifications.email.enabled}
                      onChange={(e) => handleInputChange('callMonitoring.notifications.email.enabled', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label className="mr-2 block text-sm text-gray-900">
                      שלח התראות במייל
                    </label>
                  </div>

                  {config.callMonitoring.notifications.email.enabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        כתובות מייל (הפרד בפסיקים)
                      </label>
                      <input
                        type="text"
                        value={config.callMonitoring.notifications.email.recipients.join(', ')}
                        onChange={(e) => handleInputChange(
                          'callMonitoring.notifications.email.recipients',
                          e.target.value.split(',').map(email => email.trim())
                        )}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="example@domain.com, another@domain.com"
                        dir="ltr"
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Data Retention */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">שמירת נתונים</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                תקופת שמירת תשובות סקר (ימים)
              </label>
              <input
                type="number"
                min="1"
                value={config.dataRetention.surveyResponses}
                onChange={(e) => handleInputChange('dataRetention.surveyResponses', parseInt(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                תקופת שמירת לוג שיחות (ימים)
              </label>
              <input
                type="number"
                min="1"
                value={config.dataRetention.callLogs}
                onChange={(e) => handleInputChange('dataRetention.callLogs', parseInt(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Rate Limiting */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">הגבלת קצב</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={config.rateLimiting.enabled}
                onChange={(e) => handleInputChange('rateLimiting.enabled', e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="mr-2 block text-sm text-gray-900">
                הפעל הגבלת קצב
              </label>
            </div>

            {config.rateLimiting.enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    מספר בקשות מקסימלי לדקה
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={config.rateLimiting.maxRequestsPerMinute}
                    onChange={(e) => handleInputChange('rateLimiting.maxRequestsPerMinute', parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    משך חסימה (שניות)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={config.rateLimiting.blockDuration}
                    onChange={(e) => handleInputChange('rateLimiting.blockDuration', parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BotSettings;