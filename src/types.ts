export enum LeadStatus {
  Pending = 0,
  Contacted = 1,
  FollowUp = 2,
  Replied = 3,
  Confirmed = 4,
}

export type Lead = {
  id: string;
  user_id: string;
  business_name: string;
  email: string | null;
  mobile: string | null;
  website: string | null;
  address: string | null;
  industry: string | null;
  location: string | null;
  status: LeadStatus;
  created_at: string;
};

export type LeadGenerationRequest = {
  industry: string;
  location: string;
  count: number;
};
