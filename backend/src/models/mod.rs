use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: String,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Incident {
    pub id: Uuid,
    pub reporter_id: Uuid,
    pub location: String,
    pub status: String,
    pub severity: String,
    pub emergency_type: Option<String>,
    pub details: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub ai_advice: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Message {
    pub id: Uuid,
    pub incident_id: Uuid,
    pub sender_id: Uuid,
    pub content: String,
    pub timestamp: DateTime<Utc>,
}
