export interface SessionRow { id: string; startedAt: string; flagged: boolean; ownerNote: string | null; articleCode: string | null; visitorName: string | null; visitorPhone: string | null; messageCount: number; preview: string }
export interface TranscriptMessage { id: string; role: "user" | "assistant"; content: string; createdAt: string }
export interface UnansweredRow { id: string; question: string; createdAt: string; status: "open" | "resolved" }
export interface FaqRow { id: string; topic: string | null; question: string; answer: string; isActive: boolean; sortOrder: number }
export interface ChatsData { sessions: SessionRow[]; unanswered: UnansweredRow[]; faqs: FaqRow[] }
