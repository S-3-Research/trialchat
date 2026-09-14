// TypeScript types for Supabase database schema

export interface UserProfile {
  id: string;
  clerk_user_id: string;
  
  // Basic info
  full_name?: string;
  email?: string;
  age?: number;
  gender?: string;
  
  // Health status
  has_adrd?: boolean;
  diagnosis_type?: string;
  diagnosed_date?: string;
  current_medications?: Record<string, unknown>;
  
  // Caregiver info
  is_caregiver?: boolean;
  relationship_to_patient?: string;
  
  // Preferences
  preferred_language?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
  };
  mobility_status?: 'mobile' | 'limited' | 'homebound';
  travel_radius_miles?: number;
  
  // Metadata
  created_at?: string;
  updated_at?: string;
  last_active_at?: string;
}

export interface ConversationHistory {
  id: string;
  clerk_user_id: string;
  session_id?: string;
  
  user_message?: string;
  assistant_response?: string;
  intent?: string;
  extracted_info?: Record<string, unknown>;
  
  created_at?: string;
}

export interface UserTrialInterest {
  id: string;
  clerk_user_id: string;
  
  trial_id: string;
  trial_name?: string;
  trial_status?: 'interested' | 'applied' | 'enrolled' | 'declined';
  
  user_notes?: string;
  match_score?: number;
  
  interested_at?: string;
  updated_at?: string;
}

export interface UserQALog {
  id: string;
  clerk_user_id: string;
  
  question: string;
  answer?: string;
  category?: string;
  helpful?: boolean;
  
  created_at?: string;
}
