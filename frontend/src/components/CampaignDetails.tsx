import React, { useState } from 'react';
import { Calendar, MessageSquare, Upload, Info } from 'lucide-react';
import { CampaignDetails } from '../types';

interface CampaignDetailsFormProps {
  onSave: (details: CampaignDetails) => void;
  onBack: () => void;
}

function CampaignDetailsForm({ onSave, onBack }: CampaignDetailsFormProps) {
  // scheduledDate is not a user input anymore; set it automatically when saving
  const [messageTemplate, setMessageTemplate] = useState("");
  const [csvData, setCsvData] = useState<{ day: string; message: string }[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
        
        // Convert CSV data to JSON format
        const formattedData = rows.map(row => ({
          day: row[0] || '',
          message: row[1] || ''
        })).filter(item => item.day && item.message);
        
        setCsvData(formattedData);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalMessageTemplate;
    
    if (csvData.length > 0) {
      // Use CSV data as base
      finalMessageTemplate = [...csvData];
      
      // If manual text exists, append it as the last day
      if (messageTemplate.trim()) {
        const lastDayNumber = csvData.length > 0 ? 
          Math.max(...csvData.map(item => parseInt(item.day) || 0)) + 1 : 1;
        finalMessageTemplate.push({
          day: lastDayNumber.toString(),
          message: messageTemplate.trim(),
        });
      }
    } else if (messageTemplate.trim()) {
      // Convert manual text to template format (day 1 gets the message)
      finalMessageTemplate = [{ day: "1", message: messageTemplate.trim() }];
    } else {
      alert("Please either upload a CSV template or enter a message template");
      return;
    }

    // Use current date-time as scheduledDate (ISO string)
    onSave({
      scheduledDate: new Date().toISOString(),
      messageTemplate: finalMessageTemplate,
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
        {/* Removed Scheduled Date input, will be set on submit */}
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

          {csvData.length > 0 && (
              <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-whatsapp-light/30 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-whatsapp-dark">
                    CSV Template Active (showing top {Math.min(csvData.length, 10)} of {csvData.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvData([]);
                      // Clear the file input so same file can be uploaded again
                      const fileInput = document.getElementById('template-upload') as HTMLInputElement;
                      if (fileInput) {
                        fileInput.value = '';
                      }
                    }}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Clear CSV
                  </button>
                </div>
                <div className="p-4 space-y-2 text-sm text-gray-700">
                  {csvData.slice(0, 10).map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between bg-whatsapp-light/30 p-4 rounded-lg border border-gray-200"
                    >
                      <div>
                        <p className="font-semibold text-whatsapp-dark">Day {item.day}</p>
                        <p className="text-gray-700 mt-1">{item.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MessageSquare className="h-5 w-5 text-whatsapp-secondary" />
            </div>
            <div className="absolute top-3 left-4 flex items-center">
              <div className="relative group">
                <Info className="h-4 w-4 text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  If CSV is uploaded, this text will be added as the last day
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                </div>
              </div>
            </div>
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="block w-full pl-16 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary focus:border-transparent"
              rows={4}
              placeholder="Enter your message template here..."
              required={!csvData.length}
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