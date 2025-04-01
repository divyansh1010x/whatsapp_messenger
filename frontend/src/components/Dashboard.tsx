import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, Clock, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { Campaign } from '../types';

function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    const saved = localStorage.getItem('campaigns');
    return saved ? JSON.parse(saved) : [];
  });

  const [csvFiles, setCsvFiles] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('csvFiles');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('campaigns', JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    localStorage.setItem('csvFiles', JSON.stringify(csvFiles));
  }, [csvFiles]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        
        setCsvFiles(prev => {
          const updatedFiles = { ...prev, [file.name]: text };
          localStorage.setItem('csvFiles', JSON.stringify(updatedFiles));
          return updatedFiles;
        });

        const rows = text
          .split('\n')
          .map(row => row.trim())
          .filter(row => row)
          .map(row => row.split(','));

        if (rows.length > 1 && rows[1].length > 0) {
          const newCampaign: Campaign = {
            id: Date.now().toString(),
            name: file.name.replace('.csv', ''),
            totalMessages: rows.length - 1,
            sentMessages: 0,
            status: 'pending',
            scheduledDate: rows[1][0] || '',
            createdAt: new Date().toISOString(),
          };
          setCampaigns(prev => [...prev, newCampaign]);
        }
      };
      reader.readAsText(file);
    }
  };

  const simulateSendMessages = (campaignId: string) => {
    const interval = setInterval(() => {
      setCampaigns(prev =>
        prev.map(campaign => {
          if (campaign.id === campaignId && campaign.sentMessages < campaign.totalMessages) {
            const newSentMessages = campaign.sentMessages + 1;
            return {
              ...campaign,
              sentMessages: newSentMessages,
              status: newSentMessages === campaign.totalMessages ? 'completed' : 'sending'
            };
          }
          return campaign;
        })
      );
    }, 100);

    setTimeout(() => clearInterval(interval), 10000);
  };

  return (
    <div className="space-y-8 p-8 max-w-5xl mx-auto">
      {/* File Upload Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.4 }}
        className="bg-white rounded-xl shadow-md p-6"
      >
        <h2 className="text-2xl font-semibold mb-4">Upload New Campaign</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center">
          <Upload className="h-12 w-12 text-gray-400 mb-4" />
          <label htmlFor="file-upload" className="cursor-pointer bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 transition">
            Choose CSV File
          </label>
          <input id="file-upload" type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          <p className="mt-2 text-sm text-gray-500">Format: <span className="font-medium">Date, Phone Number, Message</span></p>
        </div>
      </motion.div>

      {/* Campaigns Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-white rounded-xl shadow-md p-6"
      >
        <h2 className="text-2xl font-semibold mb-4">Your Campaigns</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campaigns.map(campaign => (
            <div key={campaign.id} className="p-4 border rounded-lg shadow-sm bg-gray-50">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">{campaign.name}</h3>
                {campaign.status === 'pending' && <Clock className="text-gray-500" />}
                {campaign.status === 'sending' && <Send className="text-blue-500 animate-bounce" />}
                {campaign.status === 'completed' && <CheckCircle className="text-green-500" />}
              </div>
              <p className="text-sm text-gray-600 mt-1">Total: {campaign.totalMessages} | Sent: {campaign.sentMessages}</p>
              <button 
                onClick={() => simulateSendMessages(campaign.id)} 
                className={`mt-3 px-4 py-2 w-full text-white rounded-md transition ${
                  campaign.status === 'completed' ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                disabled={campaign.status === 'completed'}
              >
                {campaign.status === 'completed' ? "Completed" : "Start Campaign"}
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Stored CSV Files Section */}
      {Object.keys(csvFiles).length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.4, delay: 0.4 }}
          className="bg-white rounded-xl shadow-md p-6"
        >
          <h2 className="text-2xl font-semibold mb-4">Stored CSV Files</h2>
          <div className="space-y-4">
            {Object.entries(csvFiles).map(([filename, content]) => (
              <details key={filename} className="bg-gray-100 p-4 rounded-md shadow-sm">
                <summary className="cursor-pointer font-medium flex items-center gap-2">
                  <FileText className="text-gray-600" /> {filename}
                </summary>
                <pre className="bg-white p-4 rounded-md text-sm text-gray-700 overflow-auto mt-2 max-h-40">{content}</pre>
              </details>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default Dashboard;
