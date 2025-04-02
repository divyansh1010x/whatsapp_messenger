export interface Contact {
  name: string;
  phoneNumber: string;
}

export interface CampaignDetails {
  scheduledDate: string;
  messageTemplate: string;
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