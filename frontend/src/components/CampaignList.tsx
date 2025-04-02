import { Calendar, Send, CheckCircle, XCircle, Users } from 'lucide-react';
import { Campaign } from '../types';

interface CampaignListProps {
  campaigns: Campaign[];
  onStart: (id: string) => void;
}

function CampaignList({ campaigns, onStart }: CampaignListProps) {
  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-whatsapp-dark">{campaign.name}</h3>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-1 text-whatsapp-secondary" />
                  {campaign.contacts.length} contacts
                </div>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-whatsapp-secondary" />
                  {new Date(campaign.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {campaign.status === 'pending' && (
                <button
                  onClick={() => onStart(campaign.id)}
                  className="flex items-center px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-secondary transition-colors"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Start
                </button>
              )}
              {campaign.status === 'sending' && (
                <div className="flex items-center text-yellow-600">
                  <Send className="h-5 w-5 mr-1 animate-pulse" />
                  Sending...
                </div>
              )}
              {campaign.status === 'completed' && (
                <div className="flex items-center text-whatsapp-primary">
                  <CheckCircle className="h-5 w-5 mr-1" />
                  Completed
                </div>
              )}
              {campaign.status === 'failed' && (
                <div className="flex items-center text-red-600">
                  <XCircle className="h-5 w-5 mr-1" />
                  Failed
                </div>
              )}
            </div>
          </div>
          {(campaign.status === 'sending' || campaign.status === 'completed') && (
            <div className="mt-4">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    campaign.status === 'completed' ? 'bg-whatsapp-primary' : 'bg-whatsapp-secondary animate-pulse'
                  }`}
                  style={{
                    width: `${(campaign.sentMessages / campaign.totalMessages) * 100}%`,
                  }}
                />
              </div>
              <div className="mt-1 text-right text-sm text-gray-500">
                {campaign.sentMessages} / {campaign.totalMessages} messages sent
              </div>
            </div>
          )}
        </div>
      ))}
      {campaigns.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-whatsapp-light/50 rounded-xl">
          <Send className="h-12 w-12 mx-auto mb-4 text-whatsapp-secondary opacity-50" />
          <p className="text-lg">No campaigns yet. Create your first campaign to get started.</p>
        </div>
      )}
    </div>
  );
}

export default CampaignList;