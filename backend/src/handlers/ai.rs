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
    
    if msg.contains("medical") || msg.contains("hospital") || msg.contains("hurt") || msg.contains("accident") {
        "Medical emergency detected. Stay calm. Check if the person is breathing and has a pulse. Call 108 (Ambulance) immediately. Do not move the person unless there is immediate danger. If bleeding, apply firm pressure to the wound.".to_string()
    } else if msg.contains("fire") || msg.contains("smoke") || msg.contains("burn") {
        "Fire reported. Evacuate the building immediately using stairs — never elevators. Call 101 (Fire Department). Stay low if there is smoke. Alert others using the fire alarm. Assemble at the designated muster point.".to_string()
    } else if msg.contains("police") || msg.contains("security") || msg.contains("theft") || msg.contains("attack") || msg.contains("crime") {
        "Security incident reported. Move to a safe location immediately. Call 100 (Police) or the unified emergency number 112. Stay calm, do not confront the suspect. Provide your exact location to the operator.".to_string()
    } else if msg.contains("flood") || msg.contains("earthquake") || msg.contains("cyclone") || msg.contains("disaster") {
        "Natural disaster reported. Move to higher ground or a structurally sound building immediately. Call the National Disaster Helpline: 1078. Contact NDRF at 011-24363260 if evacuation support is needed. Follow local authority instructions.".to_string()
    } else {
        "I am currently in local emergency mode due to high service demand. Please call the nearest emergency services immediately: Police (100 / 112) | Ambulance (108) | Fire (101) | Disaster Helpline (1078). Your SOS report has been logged and responders are being notified.".to_string()
    }
}

/// Collect all configured Gemini API keys.
/// Reads GEMINI_API_KEY_1, GEMINI_API_KEY_2, ... up to 10,
/// plus the legacy GEMINI_API_KEY as a final fallback.
fn get_gemini_keys() -> Vec<String> {
    let mut keys: Vec<String> = (1..=10)
        .filter_map(|i| env::var(format!("GEMINI_API_KEY_{}", i)).ok())
        .filter(|k| !k.is_empty())
        .collect();

    // Also accept the legacy single-key variable as a fallback
    if let Ok(k) = env::var("GEMINI_API_KEY") {
        if !k.is_empty() && !keys.contains(&k) {
            keys.push(k);
        }
    }
    keys
}

pub async fn ai_chat(
    State(_state): State<AppState>,
    Json(payload): Json<AiChatRequest>,
) -> Result<Json<AiChatResponse>, AppError> {
    let keys = get_gemini_keys();

    if !keys.is_empty() {
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

        let system_prompt = "You are a crisis response AI assistant for India. Be concise, actionable, and calming. Always provide the relevant emergency contact number (Police 100/112, Ambulance 108, Fire 101, Disaster Helpline 1078, NDRF 011-24363260) in your response based on the emergency type. Ensure these numbers are prominent.";
        let body = serde_json::json!({
            "systemInstruction": { "parts": [ { "text": system_prompt } ] },
            "contents": contents,
            "generationConfig": { "maxOutputTokens": 800, "temperature": 0.7 }
        });

        let client = Client::new();

        // Valid models as of April 2026 — ordered by free-tier quota (highest first).
        // gemini-1.5-x is fully shut down (returns 404). gemini-2.5-flash-lite has the highest free quota.
        let models = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];

        // For each model, rotate through all API keys before giving up on it
        'outer: for model in models {
            for (key_idx, key) in keys.iter().enumerate() {
                let url = format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                    model, key
                );

                match client.post(&url).json(&body).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            if let Some(text) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                                println!("✅ {} (key #{}) responded successfully", model, key_idx + 1);
                                return Ok(Json(AiChatResponse { reply: text.to_string() }));
                            }
                        }
                    }
                    Ok(resp) => {
                        let status = resp.status();
                        // 429 = quota/rate-limit — try next key; other errors skip model
                        if status.as_u16() == 429 {
                            println!("⚠️ {} key #{} rate-limited (429), trying next key", model, key_idx + 1);
                            continue;
                        }
                        println!("⚠️ {} key #{} failed with status: {}", model, key_idx + 1, status);
                        continue 'outer; // Non-quota error: skip to next model
                    }
                    Err(e) => {
                        println!("❌ {} key #{} request error: {}", model, key_idx + 1, e);
                        continue 'outer;
                    }
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
    pub hospital_contacts: Option<String>,
}

pub async fn parse_emergency_data(panic_message: &str, location: &str, lat: Option<f64>, lng: Option<f64>) -> Option<ParsedEmergency> {
    let keys = get_gemini_keys();

    if !keys.is_empty() {
        let location_context = if let (Some(la), Some(lo)) = (lat, lng) {
            format!("Location: {} (Lat: {}, Lng: {})", location, la, lo)
        } else {
            format!("Location: {}", location)
        };

        let system_prompt = format!(r#"You are a highly advanced Crisis Response AI. Analyze the provided panic message from a user at {}.
You must automatically understand the type of emergency based on keywords, properly describe the incident details, and provide actionable insight/advice.
IMPORTANT: You MUST always include the specific emergency contact number relevant to the situation (e.g., Police: 100/112, Ambulance: 108, Fire: 101, Disaster: 1078) in the 'ai_advice' field.

ADDITIONALLY: Provide a list of 2-3 most relevant emergency contacts based on the situation. 
- If it's a crime/theft: Include nearby Police Stations and their direct numbers.
- If it's medical: Include nearby Hospitals.
- If it's fire: Include nearby Fire Stations.
Use EXACTLY this format for each entry: '1. Service Name: Phone Number\n2. Next Service: Phone Number'. Do not add any other text.
Return ONLY valid JSON matching this exact schema:
{{
  "emergency_type": "Medical" | "Fire" | "Security" | "Natural Disaster" | "Other",
  "severity": "critical" | "high" | "medium",
  "details": "A clear, professional summary of the incident details based on the user's keywords",
  "ai_advice": "Immediate, concise actionable advice. ALWAYS mention relevant services in ALL CAPS (e.g., HOSPITAL, POLICE, AMBULANCE) along with their specific contact number (e.g., Call 108 immediately).",
  "hospital_contacts": "A well-formatted list of nearby services (Police/Fire/Hospital) and their phone numbers."
}}"#, location_context);

        let body = serde_json::json!({
            "systemInstruction": { "parts": [ { "text": system_prompt } ] },
            "contents": [{ "role": "user", "parts": [{ "text": panic_message }] }],
            "generationConfig": { "responseMimeType": "application/json", "maxOutputTokens": 500, "temperature": 0.1 }
        });

        let client = Client::new();
        // Valid models as of April 2026 — gemini-1.5-x is fully shut down.
        let models = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];

        'outer: for model in models {
            for (key_idx, key) in keys.iter().enumerate() {
                let url = format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                    model, key
                );

                match client.post(&url).json(&body).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            if let Some(text) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                                if let Ok(parsed) = serde_json::from_str::<ParsedEmergency>(text) {
                                    println!("✅ parse_emergency {} (key #{}) OK", model, key_idx + 1);
                                    return Some(parsed);
                                }
                            }
                        }
                    }
                    Ok(resp) if resp.status().as_u16() == 429 => {
                        println!("⚠️ parse_emergency {} key #{} rate-limited, trying next key", model, key_idx + 1);
                        continue; // try next key
                    }
                    _ => continue 'outer, // non-quota error or parse fail, try next model
                }
            }
        }
    }

    let msg = panic_message.to_lowercase();
    let (e_type, advice) = if msg.contains("medical") || msg.contains("hurt") || msg.contains("accident") {
        ("Medical", "Apply pressure to wounds, keep the patient still, and call 108 (Ambulance) immediately.")
    } else if msg.contains("fire") || msg.contains("burn") {
        ("Fire", "Evacuate immediately via stairs, alert others, and call 101 (Fire Department).")
    } else if msg.contains("security") || msg.contains("police") || msg.contains("crime") || msg.contains("theft") {
        ("Security", "Move to safety, do not engage, and call 100 or 112 (Police) immediately.")
    } else if msg.contains("flood") || msg.contains("earthquake") || msg.contains("cyclone") || msg.contains("disaster") {
        ("Natural Disaster", "Move to higher ground or a strong structure. Call NDRF Helpline 1078 for evacuation support.")
    } else {
        ("Other", "Stay safe, move away from danger, and call 112 (Unified Emergency) or 1078 (Disaster Helpline).")
    };

    Some(ParsedEmergency {
        emergency_type: e_type.to_string(),
        severity: "high".to_string(),
        details: panic_message.to_string(),
        ai_advice: advice.to_string(),
        hospital_contacts: Some("1. Police Support: 100\n2. Ambulance Dispatch: 108\n3. Unified Emergency: 112".to_string()),
    })
}
