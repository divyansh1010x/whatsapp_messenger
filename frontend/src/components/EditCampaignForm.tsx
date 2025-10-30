import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Campaign, Contact } from '../types';
import { XCircle, ArrowLeftCircle} from 'lucide-react';

const EditCampaignForm: React.FC = () => {
  const location = useLocation();
  const campaign: Campaign | null = location.state?.campaign ?? null;
  const [contacts, setContacts] = useState<Contact[]>(campaign?.contacts || []);
  const [name, setName] = useState(campaign?.name || '');
  const [description, setDescription] = useState(campaign?.details?.messageTemplate?.[0]?.message || '');
  const [startDate, setStartDate] = useState(campaign?.details?.scheduledDate || '');
  const [messageTemplate, setMessageTemplate] = useState<{ day: string; message: string }[]>(campaign?.details?.messageTemplate || []);

  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setContacts(campaign.contacts);
      setDescription(campaign.details?.messageTemplate?.[0]?.message || '');
      setStartDate(campaign.details?.scheduledDate || '');
      setMessageTemplate(campaign.details?.messageTemplate || []);
    }
  }, [campaign]);

  const handleContactChange = (index: number, field: keyof Contact, value: string) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  };

  const handleAddContact = () => {
    setContacts([...contacts, { name: '', number: '', count: 1 }]);
  };

  const handleRemoveContact = (index: number) => {
    const updated = contacts.filter((_, i) => i !== index);
    setContacts(updated);
  };

  const handleMessageChange = (index: number, field: 'day' | 'message', value: string) => {
    const updated = [...messageTemplate];
    updated[index] = { ...updated[index], [field]: value };
    setMessageTemplate(updated);
  };

  const handleAddMessage = () => {
    setMessageTemplate([...messageTemplate, { day: `${messageTemplate.length + 1}`, message: '' }]);
  };

  const handleRemoveMessage = (index: number) => {
    const updated = messageTemplate.filter((_, i) => i !== index);
    setMessageTemplate(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    const updatedCampaign: Campaign = {
      ...campaign,
      name,
      contacts,
      details: {
        ...campaign.details,
        scheduledDate: startDate,
        messageTemplate: messageTemplate,
      },
    };

    const campaigns: Campaign[] = JSON.parse(localStorage.getItem('campaigns') || '[]');
    const updatedCampaigns = campaigns.map(c => (c.name === campaign.name ? updatedCampaign : c));
    localStorage.setItem('campaigns', JSON.stringify(updatedCampaigns));
    alert('Campaign updated successfully.');
  };

  if (!campaign) return <div className="text-center py-10">No campaign loaded. Please return to the Dashboard.</div>;

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow">
      <div className="mb-6">
        <button
          onClick={() => (window.location.href = '/')}
          className="flex items-center px-4 py-2 text-sm text-gray-600 hover:text-whatsapp-primary border border-gray-300 rounded-lg hover:border-whatsapp-primary transition-colors mb-4"
        >
          <ArrowLeftCircle className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
        <h1 className="text-xl font-semibold">Edit Campaign</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">Campaign Name</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block font-medium mb-2">Contacts</label>
          {contacts.map((contact, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="Name"
                className="flex-1 border p-2 rounded"
                value={contact.name}
                onChange={(e) => handleContactChange(index, 'name', e.target.value)}
              />
              <input
                type="text"
                placeholder="Number"
                className="flex-1 border p-2 rounded"
                value={contact.number}
                onChange={(e) => handleContactChange(index, 'number', e.target.value)}
              />
              <button
                type="button"
                onClick={() => handleRemoveContact(index)}
                className="text-red-500 text-sm"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddContact}
            className="text-blue-600 text-sm mt-2"
          >
            + Add Contact
          </button>
        </div>

        <div>
          <label className="block font-medium mb-2">Message Templates</label>
          {messageTemplate.map((template, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="Day"
                className="w-20 border p-2 rounded"
                value={template.day}
                onChange={(e) => handleMessageChange(index, 'day', e.target.value)}
              />
              <input
                type="text"
                placeholder="Message"
                className="flex-1 border p-2 rounded"
                value={template.message}
                onChange={(e) => handleMessageChange(index, 'message', e.target.value)}
              />
              <button
                type="button"
                onClick={() => handleRemoveMessage(index)}
                className="text-red-500 text-sm"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddMessage}
            className="text-blue-600 text-sm mt-2"
          >
            + Add Message Template
          </button>
        </div>

        <button
          type="submit"
          className="bg-whatsapp-primary text-white px-4 py-2 rounded hover:bg-whatsapp-secondary"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
};

export default EditCampaignForm;
