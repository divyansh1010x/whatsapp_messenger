import React, { useState } from 'react';
import { Calendar, MessageSquare, Upload } from 'lucide-react';
import { CampaignDetails } from '../types';

interface CampaignDetailsFormProps {
  onSave: (details: CampaignDetails) => void;
  onBack: () => void;
}

function CampaignDetailsForm({ onSave, onBack }: CampaignDetailsFormProps) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [rawCsvData, setRawCsvData] = useState<string[][]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvContent(text);
        // Parse CSV data into rows and columns
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
        setRawCsvData(rows);
        // Use first row as message template
        if (rows.length > 0) {
          setMessageTemplate(rows[0].join(',').trim());
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      scheduledDate,
      messageTemplate: csvContent || messageTemplate,
    });
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
      <button
        onClick={onBack}
        className="mb-6 text-whatsapp-dark hover:text-whatsapp-secondary flex items-center transition-colors"
      >
        ← Back
      </button>

      <h2 className="text-xl font-semibold mb-6 text-whatsapp-dark">Campaign Details</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scheduled Date
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-whatsapp-secondary" />
            </div>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary focus:border-transparent"
              required
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Message Template
          </label>

          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-whatsapp-primary transition-colors">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-whatsapp-primary" />
              <div className="mt-4">
                <label htmlFor="template-upload" className="cursor-pointer bg-whatsapp-primary text-white px-6 py-3 rounded-lg hover:bg-whatsapp-secondary transition-colors inline-block">
                  Upload Template CSV
                </label>
                <input
                  id="template-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">Or enter message template below</p>
            </div>
          </div>

          {rawCsvData.length > 0 && (
            <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-whatsapp-light/30 px-3 py-2 border-b border-gray-200">
                <h3 className="text-sm font-medium text-whatsapp-dark">CSV Preview</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {rawCsvData.map((row, rowIndex) => (
                      <tr 
                        key={rowIndex} 
                        className={`
                          ${rowIndex === 0 ? 'bg-gray-50 font-medium' : 'bg-white'}
                          ${rowIndex !== rawCsvData.length - 1 ? 'border-b border-gray-200' : ''}
                        `}
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={`
                              px-3 py-1.5 text-sm text-gray-600
                              ${cellIndex !== row.length - 1 ? 'border-r border-gray-200' : ''}
                            `}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MessageSquare className="h-5 w-5 text-whatsapp-secondary" />
            </div>
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary focus:border-transparent"
              rows={4}
              placeholder="Enter your message template here..."
              required={!csvContent}
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-whatsapp-primary hover:bg-whatsapp-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-whatsapp-primary"
        >
          Save Campaign Details
        </button>
      </form>
    </div>
  );
}

export default CampaignDetailsForm;