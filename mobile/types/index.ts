export type DayEvent = {
  time: string;        // "9:00 AM"
  title: string;       // "Team Meeting"
  location?: string;   // "Office Building A"
  travelMode?: string; // "car" | "bike" | "walk" | "transit"
  travelTime?: string; // "25 min"
  category: string;    // "work" | "health" | "errand" | "break" | "focus"
  weather?: string;    // "☀️ 28°C"
};

export type DayPlan = {
  date: string;
  events: DayEvent[];
  weather_summary: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
};

export type UserProfile = {
  name: string;
  work_hours: string;
  home_address: string;
  office_address: string;
  energy_type: string;
  peak_focus_hours: string;
  transport: string;
  exercise_preferences: string;
  sleep_target: number;
  hobbies: string[];
};

export type SleepEntry = {
  bedtime: string;
  wake_time: string;
  hours: number;
  date: string;
};

export type ChatResponse = {
  response: string;
  session_id: string;
};

export type SleepResponse = {
  response: string;
  wake_time?: string;
  alarm_scheduled: boolean;
  session_id: string;
};

export type HealthResponse = {
  status: string;
  agent: string;
  model: string;
  scheduler_running: boolean;
  firebase_configured: boolean;
};
