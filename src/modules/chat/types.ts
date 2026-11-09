export interface SessionRow { id: string; startedAt: string; flagged: boolean; ownerNote: string | null; articleCode: string | null; visitorName: string | null; visitorPhone: string | null; messageCount: number; preview: string }
export interface TranscriptMessage { id: string; role: "user" | "assistant"; content: string; createdAt: string }
export interface UnansweredRow { id: string; question: string; createdAt: string; status: "open" | "resolved" }
export interface FaqRow { id: string; topic: string | null; question: string; answer: string; isActive: boolean; sortOrder: number }
/** One visitor, with every conversation they have had (a returning visitor is ONE row, not one per visit). */
export interface VisitorRow {
  visitorId: string; name: string | null; phone: string | null;
  leadId: string | null; leadName: string | null; leadStage: string | null;
  visits: number; messageCount: number; firstAt: string; lastAt: string; lastQuestion: string; flagged: boolean; articleCodes: string[];
}
export interface VisitorThread {
  visitorId: string; name: string | null; phone: string | null; leadId: string | null; leadName: string | null; leadStage: string | null;
  sessions: Array<{ id: string; startedAt: string; flagged: boolean; ownerNote: string | null; articleCode: string | null; messages: TranscriptMessage[] }>;
}
export interface ChatsData { visitors: VisitorRow[]; sessions: SessionRow[]; unanswered: UnansweredRow[]; faqs: FaqRow[] }
