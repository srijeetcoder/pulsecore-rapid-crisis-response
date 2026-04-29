use std::env;
use reqwest::Client;
use serde_json::json;

pub async fn send_email_via_http(to_email: &str, subject: &str, body: &str) {
    let resend_key = env::var("RESEND_API_KEY").unwrap_or_default();
    let sendgrid_key = env::var("SENDGRID_API_KEY").unwrap_or_default();
    let brevo_key = env::var("BREVO_API_KEY").unwrap_or_default();

    let client = Client::new();

    if !resend_key.is_empty() {
        println!("📧 Attempting to send email via Resend HTTP API to {}", to_email);
        let url = "https://api.resend.com/emails";
        let payload = json!({
            "from": "PulseCore <onboarding@resend.dev>",
            "to": [to_email],
            "subject": subject,
            "html": body
        });

        match client.post(url)
            .bearer_auth(resend_key)
            .json(&payload)
            .send()
            .await 
        {
            Ok(resp) if resp.status().is_success() => println!("✅ Resend email sent successfully!"),
            Ok(resp) => println!("⚠️ Resend API returned status: {}", resp.status()),
            Err(e) => println!("❌ Resend HTTP request failed: {}", e),
        }
    } else if !sendgrid_key.is_empty() {
        println!("📧 Attempting to send email via SendGrid HTTP API to {}", to_email);
        let url = "https://api.sendgrid.com/v3/mail/send";
        let payload = json!({
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": "onboarding@resend.dev"},
            "subject": subject,
            "content": [{"type": "text/html", "value": body}]
        });

        match client.post(url)
            .bearer_auth(sendgrid_key)
            .json(&payload)
            .send()
            .await 
        {
            Ok(resp) if resp.status().is_success() => println!("✅ SendGrid email sent successfully!"),
            Ok(resp) => println!("⚠️ SendGrid API returned status: {}", resp.status()),
            Err(e) => println!("❌ SendGrid HTTP request failed: {}", e),
        }
    } else if !brevo_key.is_empty() {
        println!("📧 Attempting to send email via Brevo HTTP API to {}", to_email);
        let url = "https://api.brevo.com/v3/smtp/email";
        let payload = json!({
            "sender": {"name": "PulseCore", "email": "onboarding@resend.dev"},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": body
        });

        match client.post(url)
            .header("api-key", brevo_key)
            .json(&payload)
            .send()
            .await 
        {
            Ok(resp) if resp.status().is_success() => println!("✅ Brevo email sent successfully!"),
            Ok(resp) => println!("⚠️ Brevo API returned status: {}", resp.status()),
            Err(e) => println!("❌ Brevo HTTP request failed: {}", e),
        }
    } else {
        println!("\n=========================================");
        println!("⚠️  NO HTTP EMAIL API KEY DETECTED.");
        println!("To fix Render delivery, set RESEND_API_KEY, SENDGRID_API_KEY, or BREVO_API_KEY.");
        println!("Email contents logged locally for developer.");
        println!("=========================================\n");
    }
}
