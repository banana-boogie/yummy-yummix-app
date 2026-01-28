//@ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RECEIVER_EMAIL = "accounts@yummyyummix.com";

interface RequestBody {
  reasons: string[];
  feedback: string;
  userId: string;
  userEmail: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { reasons, feedback, userId, userEmail } = await req
      .json() as RequestBody;

    // Format reasons as bullet points
    const formattedReasons = reasons
      .map((reason) => `  • ${reason}`)
      .join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "YummyYummix System <no-reply@yummyyummix.com>",
        to: [RECEIVER_EMAIL],
        subject: "[Account Deletion Request]",
        reply_to: "support@yummyyummix.com",
        html: `
          <h2>Account Deletion Request</h2>
          <p>A user has requested their account to be deleted. Details below:</p>

          <h3>User Information:</h3>
          <p style="margin-left: 20px; color: #666;">
            User ID: ${userId}<br>
            Email: ${userEmail}
          </p>
          
          <h3>Reasons for Leaving:</h3>
          <pre style="margin-left: 20px; color: #666;">
${formattedReasons}
          </pre>

          <h3>Additional Feedback:</h3>
          <p style="margin-left: 20px; color: #666;">
            ${feedback || "No additional feedback provided."}
          </p>

          <hr>
          <p style="color: #999; font-size: 12px;">
            This is an automated system alert from YummyYummix.<br>
            Please process this deletion request within 14 days.<br>
            For any questions, contact the development team.
          </p>
        `,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to send email: ${res.statusText}`);
    }

    const data = await res.json();
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred";
    console.error("Error sending email:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
});
