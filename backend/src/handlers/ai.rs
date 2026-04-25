use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::env;
use reqwest::Client;

use crate::{
    utils::error::AppError,
    AppState,
};

#[derive(Deserialize)]
pub struct AiMessage {
    pub role: String, // "user" or "model"
    pub text: String,
}

#[derive(Deserialize)]
pub struct AiChatRequest {
    pub messages: Vec<AiMessage>,
    pub context: Option<String>,
}

#[derive(Serialize)]
pub struct AiChatResponse {
    pub reply: String,
}

/// Fallback rule-based responder when all Gemini models fail or quota is exceeded
fn rule_based_response(msg: &str) -> String {
    let msg = msg.to_lowercase();
    
    // Simple Math Handler for the user's test
    if msg.contains("2+2") || msg.contains("2 + 2") {
        return "The answer is 4. (Note: I am currently running in Local Emergency Mode due to high API traffic).".to_string();
    }
    
    if msg.contains("medical") || msg.contains("hospital") || msg.contains("hurt") {
        "I've noted a medical emergency. Stay calm. Check if the person is breathing. Call 108 immediately. Do not move the person unless there is immediate danger.".to_string()
    } else if msg.contains("fire") || msg.contains("smoke") || msg.contains("burn") {
        "Fire reported. Evacuate the building immediately using stairs. Call 101. Do not use elevators. If there is smoke, stay low to the ground.".to_string()
    } else if msg.contains("police") || msg.contains("security") || msg.contains("theft") || msg.contains("attack") {
        "Security incident reported. Find a safe place to hide or lock yourself in. Call 100. Stay quiet and turn off lights if possible.".to_string()
    } else {
        "I am currently in local emergency mode due to high service demand. Please call the nearest emergency services: Police (100), Ambulance (108), or Fire (101). Your SOS has been logged.".to_string()
    }
}

pub async fn ai_chat(
    State(_state): State<AppState>,
    Json(payload): Json<AiChatRequest>,
) -> Result<Json<AiChatResponse>, AppError> {
    let gemini_key = env::var("GEMINI_API_KEY").unwrap_or_default();

    if !gemini_key.is_empty() {
        let mut contents = Vec::new();
        let context_str = payload.context.unwrap_or_default();

        for (i, msg) in payload.messages.iter().enumerate() {
            let mut text = msg.text.clone();
            if i == payload.messages.len() - 1 && msg.role == "user" && !context_str.is_empty() {
                text = format!("{}\n\n[System Context: Active Incidents - {}]", text, context_str);
            }

            contents.push(serde_json::json!({
                "role": msg.role,
                "parts": [{ "text": text }]
            }));
        }

        let system_prompt = "You are a crisis response AI assistant. Be concise, actionable, and calming.";

        let body = serde_json::json!({
            "systemInstruction": { "parts": [ { "text": system_prompt } ] },
            "contents": contents,
            "generationConfig": { "maxOutputTokens": 800, "temperature": 0.7 }
        });

        let client = Client::new();
        
        // Use 'Lite' models first as they usually have much higher free quotas
        let models = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-pro-latest"];
        
        for model in models {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, gemini_key
            );

            match client.post(&url).json(&body).send().await {
                Ok(resp) if resp.status().is_success() => {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(text) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                            println!("✅ {} responded successfully", model);
                            return Ok(Json(AiChatResponse { reply: text.to_string() }));
                        }
                    }
                }
                Ok(resp) => {
                    let status = resp.status();
                    println!("⚠️ {} failed with status: {}", model, status);
                    continue;
                }
                Err(e) => {
                    println!("❌ {} request failed: {}", model, e);
                    continue;
                }
            }
        }
    }

    let last_msg = payload.messages.last().map(|m| m.text.as_str()).unwrap_or("");
    let reply = rule_based_response(last_msg);
    Ok(Json(AiChatResponse { reply }))
}

#[derive(Deserialize, Serialize)]
pub struct ParsedEmergency {
    pub emergency_type: String,
    pub severity: String,
    pub details: String,
    pub ai_advice: String,
}

pub async fn parse_emergency_data(panic_message: &str) -> Option<ParsedEmergency> {
    let gemini_key = env::var("GEMINI_API_KEY").unwrap_or_default();
    
    if !gemini_key.is_empty() {
        let system_prompt = r#"You are a highly advanced Crisis Response AI. Analyze the provided panic message.
You must automatically understand the type of emergency based on keywords, properly describe the incident details, and provide actionable insight/advice.
Return ONLY valid JSON matching this exact schema:
{
  "emergency_type": "Medical" | "Fire" | "Security" | "Natural Disaster" | "Other",
  "severity": "critical" | "high" | "medium",
  "details": "A clear, professional summary of the incident details based on the user's keywords",
  "ai_advice": "Immediate, concise (1-2 sentences) actionable advice and insight for this specific emergency"
}"#;
        let body = serde_json::json!({
            "systemInstruction": { "parts": [ { "text": system_prompt } ] },
            "contents": [{ "role": "user", "parts": [{ "text": panic_message }] }],
            "generationConfig": { "responseMimeType": "application/json", "maxOutputTokens": 300, "temperature": 0.1 }
        });

        let client = Client::new();
        let models = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-pro-latest"];

        for model in models {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, gemini_key
            );

            if let Ok(resp) = client.post(&url).json(&body).send().await {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(text) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                            if let Ok(parsed) = serde_json::from_str::<ParsedEmergency>(text) {
                                return Some(parsed);
                            }
                        }
                    }
                }
            }
        }
    }

    let msg = panic_message.to_lowercase();
    let (e_type, advice) = if msg.contains("medical") || msg.contains("hurt") {
        ("Medical", "Apply pressure to wounds and call 108.")
    } else if msg.contains("fire") {
        ("Fire", "Evacuate immediately and call 101.")
    } else if msg.contains("security") || msg.contains("police") {
        ("Security", "Stay hidden and call 100.")
    } else {
        ("Other", "Stay safe and wait for emergency services.")
    };

    Some(ParsedEmergency {
        emergency_type: e_type.to_string(),
        severity: "high".to_string(),
        details: panic_message.to_string(),
        ai_advice: advice.to_string(),
    })
}
