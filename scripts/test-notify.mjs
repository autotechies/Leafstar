import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@leafstar.in";

console.log("=== LEAF STAR NOTIFICATION SYSTEM DIAGNOSTIC ===\n");

console.log("1. Checking Environment Configurations:");
console.log("   - Supabase URL:", supabaseUrl ? "OK" : "MISSING");
console.log("   - Supabase Service Key:", serviceKey ? "OK" : "MISSING");
console.log("   - VAPID Public Key:", vapidPublic ? `OK (${vapidPublic.slice(0, 15)}...)` : "MISSING");
console.log("   - VAPID Private Key:", vapidPrivate ? "OK" : "MISSING");
console.log("   - VAPID Subject:", vapidSubject);

if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
  console.error("\n❌ Configuration check failed. Please ensure .env.local has all required keys.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey);

async function runTest() {
  console.log("\n2. Querying Supabase for Registered Devices:");
  const { data: subs, error: subError } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, user_agent, created_at");

  if (subError) {
    console.error("❌ Failed to query push_subscriptions:", subError.message);
    return;
  }

  console.log(`   Found ${subs?.length || 0} registered device(s) in push_subscriptions.`);

  if (!subs || subs.length === 0) {
    console.log("\nℹ️  Notice: No physical devices (phone or laptop) have registered yet.");
    console.log("   To register this laptop or your phone right now:");
    console.log("   a) Start the dev server: npm run dev");
    console.log("   b) Open http://localhost:3000/admin/inbox");
    console.log("   c) Click the 'Turn on alerts here' button.");
    console.log("   d) Allow browser notifications when prompted.");
    return;
  }

  console.log("\n3. Testing Push Dispatch to Registered Device(s):");
  const testPayload = JSON.stringify({
    title: "🔔 Test Lead Notification",
    body: "Mohammed Saad (+91 9876543210) submitted an enquiry for 100 pcs shirts.",
    url: "/admin/inbox",
  });

  for (const sub of subs) {
    console.log(`   Sending push to [Device ID: ${sub.id}] (${sub.user_agent || "Unknown device"})...`);
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        testPayload,
        {
          vapidDetails: {
            subject: vapidSubject,
            publicKey: vapidPublic,
            privateKey: vapidPrivate,
          },
          TTL: 60,
        }
      );
      console.log(`   ✅ SUCCESS: Notification delivered to device ${sub.id}!`);
    } catch (err) {
      const statusCode = err.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        console.log(`   ⚠️ Device endpoint expired (HTTP ${statusCode}). Removing dead device...`);
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error(`   ❌ Push failed:`, err.message || err);
      }
    }
  }
}

runTest();

