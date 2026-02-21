import { ChatResponse, SleepResponse, HealthResponse } from '../types';

// Change this to your backend URL
// Local dev: http://10.0.2.2:8000 (Android emulator) or http://localhost:8000 (web)
// ngrok: https://your-ngrok-url.ngrok-free.app
// Production: https://your-cloud-run-url
const API_URL = 'http://10.50.73.36:8000';

const DEFAULT_TIMEOUT = 60000; // 60s — agent responses can be slow

async function request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout = DEFAULT_TIMEOUT
): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!res.ok) {
            const errorBody = await res.text().catch(() => '');
            throw new Error(`API Error ${res.status}: ${errorBody || res.statusText}`);
        }

        return await res.json();
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. The agent might be processing — try again.');
        }
        if (error.message?.includes('Network request failed')) {
            throw new Error(`Cannot reach backend at ${API_URL}. Is the server running?`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

export const api = {
    /**
     * Send a message to the Day Planner agent.
     * POST /api/chat
     */
    chat: (message: string, userId = 'default_user', sessionId = ''): Promise<ChatResponse> =>
        request<ChatResponse>('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ message, user_id: userId, session_id: sessionId }),
        }),

    /**
     * Log bedtime and schedule morning alarm.
     * POST /api/sleep
     */
    logSleep: (bedtime: string, userId = 'default_user'): Promise<SleepResponse> =>
        request<SleepResponse>('/api/sleep', {
            method: 'POST',
            body: JSON.stringify({ bedtime, user_id: userId }),
        }),

    /**
     * Trigger morning plan generation.
     * POST /api/morning-plan
     */
    triggerMorningPlan: (userId = 'default_user'): Promise<any> =>
        request<any>(`/api/morning-plan?user_id=${encodeURIComponent(userId)}`, {
            method: 'POST',
        }),

    /**
     * Register device FCM token for push notifications.
     * POST /api/fcm-token
     */
    registerFCMToken: (token: string, userId = 'default_user'): Promise<any> =>
        request<any>('/api/fcm-token', {
            method: 'POST',
            body: JSON.stringify({ token, user_id: userId }),
        }),

    /**
     * Send a test push notification.
     * POST /api/notify
     */
    sendNotification: (title: string, body: string, userId = 'default_user'): Promise<any> =>
        request<any>('/api/notify', {
            method: 'POST',
            body: JSON.stringify({ title, body, user_id: userId }),
        }),

    /**
     * Health check.
     * GET /api/health
     */
    healthCheck: (): Promise<HealthResponse> =>
        request<HealthResponse>('/api/health', { method: 'GET' }),

    /**
     * Save user profile to MongoDB.
     * POST /api/profile
     */
    saveProfile: (profileData: Record<string, any>, userId = 'default_user'): Promise<any> =>
        request<any>('/api/profile', {
            method: 'POST',
            body: JSON.stringify({ ...profileData, user_id: userId }),
        }),

    /**
     * Get user profile from MongoDB.
     * GET /api/profile/:userId
     */
    getProfile: (userId = 'default_user'): Promise<any> =>
        request<any>(`/api/profile/${encodeURIComponent(userId)}`, { method: 'GET' }),

    /**
     * Register a new user.
     * POST /api/register
     */
    register: (email: string, password: string, name: string = ''): Promise<any> =>
        request<any>('/api/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name }),
        }),

    /**
     * Login with email/password.
     * POST /api/login
     */
    login: (email: string, password: string): Promise<any> =>
        request<any>('/api/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),
};
