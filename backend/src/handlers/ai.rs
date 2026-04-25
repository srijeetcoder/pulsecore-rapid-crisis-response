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

/// Fallback rule-based responder when no Gemini key is present
fn rule_based_response(_msg: &str) -> String {
    "⚠️ **Gemini API Key Missing**\n\nI am currently running in offline/pre-defined mode because the `GEMINI_API_KEY` environment variable is not set in the backend `.env` file.\n\nTo enable the real-time Gemini AI, please add your Google Gemini API key to `backend/.env` and restart the backend server.".to_string()
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
            
            // Append context only to the very last user message to keep the AI aware of the current state
            if i == payload.messages.len() - 1 && msg.role == "user" && !context_str.is_empty() {
                text = format!("{}\n\n[System Context: Active Incidents - {}]", text, context_str);
            }

            contents.push(serde_json::json!({
                "role": msg.role,
                "parts": [{ "text": text }]
            }));
        }

        let system_prompt = "You are a crisis response AI assistant for an emergency management system. Always give a response strictly based on the specific type of emergency and description provided by the user. Be concise, actionable, and calming. Use emergency numbers: Police 100, Ambulance 108, Fire 101.";

        let body = serde_json::json!({
            "systemInstruction": {
                "parts": [ { "text": system_prompt } ]
            },
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": 800,
                "temperature": 0.7
            }
        });

        let client = Client::new();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
            gemini_key
        );

        match client.post(&url).json(&body).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(text) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                        return Ok(Json(AiChatResponse { reply: text.to_string() }));
                    }
                }
            }
            Ok(resp) => {
                let status = resp.status();
                let err_text = resp.text().await.unwrap_or_default();
                println!("❌ Gemini API error: {} - {}", status, err_text);
                
                let reply = format!("⚠️ **Gemini API Error: {}**\n\nThe AI service is currently unavailable. (Detailed error: `{}`)", status, status.canonical_reason().unwrap_or("Unknown Error"));
                return Ok(Json(AiChatResponse { reply }));
            }
            Err(e) => {
                println!("❌ Gemini request failed: {}", e);
                let reply = format!("⚠️ **Network Error**\n\nFailed to connect to the Gemini API: {}", e);
                return Ok(Json(AiChatResponse { reply }));
            }
        }
    }

    // Fallback response if no API key is set at all
    let reply = "⚠️ **Gemini API Key Missing**\n\nI am currently running in offline/pre-defined mode because the `GEMINI_API_KEY` environment variable is not set in the backend `.env` file.\n\nTo enable the real-time Gemini AI, please add your Google Gemini API key to `backend/.env` and restart the backend server.".to_string();
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
    if gemini_key.is_empty() {
        return None;
    }

    let system_prompt = r#"You are a crisis response AI. The user will provide a panic message.
You must analyze the text and extract the structured data.
Return ONLY valid JSON matching this schema:
{
  "emergency_type": "Medical" | "Fire" | "Security" | "Natural Disaster" | "Other",
  "severity": "critical" | "high" | "medium",
  "details": "A clean, summarized description of the emergency based on the input",
  "ai_advice": "Immediate, brief (1-2 sentences) actionable advice for this emergency"
}"#;
    
    let body = serde_json::json!({
        "systemInstruction": {
            "parts": [ { "text": system_prompt } ]
        },
        "contents": [{
            "role": "user",
            "parts": [{ "text": panic_message }]
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "maxOutputTokens": 300,
            "temperature": 0.1
        }
    });

    let client = Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        gemini_key
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
    None
}
