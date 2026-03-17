export interface TripItem {
  id: string;
  time: string; // HH:mm
  location: string;
  mapLink?: string;
  activity: string;
  notes?: string;
  type: 'accommodation' | 'activity' | 'travel' | 'food';
  lat?: number;
  lng?: number;
}

export interface DayPlan {
  id: string;
  date: string; // YYYY-MM-DD
  tripId?: string;
  items: TripItem[];
}

export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export interface Trip {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}
