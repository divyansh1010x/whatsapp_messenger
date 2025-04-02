export interface Contact {
  name: string;
  phoneNumber: string;
  count: number;
}

export interface CampaignDetails {
  scheduledDate: string;
  messageTemplate: { day: string; message: string }[]; // Array of objects instead of string
}

export interface Campaign {
  id: string;
  name: string;
  countryCode: string;
  contacts: Contact[];
  totalMessages: number;
  sentMessages: number;
  status: 'pending' | 'sending' | 'completed' | 'failed';
  createdAt: string;
  details?: CampaignDetails;
}

export interface CountryCode {
  code: string;
  name: string;
  dialCode: string;
}