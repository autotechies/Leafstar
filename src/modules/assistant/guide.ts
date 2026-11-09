/*
  What each part of the admin does. This is the assistant's whole knowledge of "how the app works", written by hand so it
  stays accurate. Update it when a screen changes (AGENTS.md lists this file).
*/
export const APP_GUIDE = `ADMIN SECTIONS (left menu) AND WHAT THEY DO
- Dashboard (/admin): the day at a glance: stock, sales pieces, leads, what needs attention.
- Inbox (/admin/inbox): everyone who tried to reach us (callback requests, taps on Call, chats, price requests, contact form). Each is marked handled after you call or message back.
- Inventory (/admin/inventory): every article with colours and sizes and stock. Open an article to see its history, correct a count (a reason is required; Undo works once), archive it or delete it if it never had real history. Filters include out of stock (?stock=out).
- Add stock (/admin/stock/add): add a new article, add pieces to an existing one, or import an Excel file. Each save can be undone for 15 seconds.
- Scan bills (/admin/bills/scan): upload photos, PDFs, Word or Excel bills. They are read in the background and become drafts.
- Review bill (/admin/bills): check each line against the original. Lines that are not matched must be settled. For an assorted line ("Sizes S-XXL, Assorted Colours") press "Split this line" and choose colours and sizes by hand; a summary shows what you chose. Nothing is deducted until you press Deduct stock; Undo is available for 15 seconds and later from Bills.
- CRM (/admin/crm): leads on a board by stage (new, contacted, quoted, negotiation, won, lost). Open a lead for its articles, website chat, and timeline. Buyers (/admin/crm/buyers) lists saved customers.
- Chats (/admin/chats): website assistant conversations, one entry per visitor; questions it could not answer; "Your answers" (FAQ) that teach it. Never put prices in answers.
- Settings (/admin/settings): business details (name, address, phone, social links, shown in the website footer), brands (hide a brand to keep it private), FAQ, AI daily limit and pause switch, change password, two-step login.
RULES OF THE BUSINESS APP
- Stock is counted in pieces per article, colour and size. It only changes through bills, Add stock and corrections, and every change is kept in a history that cannot be edited.
- Prices are never shown on the public website or told by the website assistant.
- Hidden brands never appear on the public website.`;
