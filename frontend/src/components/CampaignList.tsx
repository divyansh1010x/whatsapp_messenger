import { Calendar, Send, CheckCircle, XCircle, Users } from 'lucide-react';
import { Campaign } from '../types';

interface CampaignListProps {
  campaigns: Campaign[];
  onStart: (id: string) => void;
}

function CampaignList({ campaigns }: CampaignListProps) {
  const handleStart = async (id: string) => {
    // Retrieve campaigns from localStorage
    const campaigns = JSON.parse(localStorage.getItem("campaigns") || "[]");
  
    // Find the campaign with the matching ID
    const campaignToSend = campaigns.find((c: Campaign) => c.id === id);
  
    if (!campaignToSend) {
      console.error("Campaign not found");
      return;
    }
  
    try {
      const response = await fetch("http://localhost:5000/api/campaign/start-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignToSend),
      });
  
      if (!response.ok) {
        throw new Error("Failed to start campaign");
      }
  
      const result = await response.json();
      console.log("Campaign started:", result);
  
      // Optional: Update localStorage to mark it as "sending"
      // const updatedCampaigns = campaigns.map((c: Campaign) =>
      //   c.id === id ? { ...c, status: "sending" } : c
      // );
      // localStorage.setItem("campaigns", JSON.stringify(updatedCampaigns));
  
      // Optionally trigger a state update
    } catch (error) {
      console.error("Error starting campaign:", error);
    }
  };
  
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
              {campaign.status === "pending" && (
                <button
                  onClick={() => handleStart(campaign.id)}
                  className="flex items-center px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-secondary transition-colors"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Start
                </button>
              )}
              {campaign.status === "sending" && (
                <div className="flex items-center text-yellow-600">
                  <Send className="h-5 w-5 mr-1 animate-pulse" />
                  Sending...
                </div>
              )}
              {campaign.status === "completed" && (
                <div className="flex items-center text-whatsapp-primary">
                  <CheckCircle className="h-5 w-5 mr-1" />
                  Completed
                </div>
              )}
              {campaign.status === "failed" && (
                <div className="flex items-center text-red-600">
                  <XCircle className="h-5 w-5 mr-1" />
                  Failed
                </div>
              )}
            </div>
          </div>
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
