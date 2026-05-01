use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;
use axum::http::StatusCode;

use crate::{
    models::Incident,
    utils::{error::AppError, jwt::Claims},
    AppState,
};


#[derive(Deserialize)]
pub struct CreateIncidentRequest {
    pub location: String,
    pub panic_message: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub guest_name: Option<String>,
    pub is_wounded: Option<bool>,
    pub additional_details: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
    pub emergency_type: Option<String>,
}

pub async fn list_incidents(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<Incident>>, AppError> {
    let incidents = if claims.role == "guest" || claims.role == "user" {
        sqlx::query_as::<_, Incident>("SELECT * FROM incidents WHERE reporter_id = $1 ORDER BY created_at DESC")
            .bind(claims.sub)
            .fetch_all(&state.db)
            .await
    } else {
        sqlx::query_as::<_, Incident>("SELECT * FROM incidents ORDER BY created_at DESC")
            .fetch_all(&state.db)
            .await
    }.map_err(|e| {
        println!("Fetch error: {}", e);
        AppError::InternalServerError("Failed to fetch incidents".to_string())
    })?;

    Ok(Json(incidents))
}

pub async fn create_incident(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateIncidentRequest>,
) -> Result<Json<Incident>, AppError> {
    // If it's a guest and they provided a name, update their user record
    if claims.role == "guest" {
        if let Some(name) = &payload.guest_name {
            let _ = sqlx::query("UPDATE users SET name = $1 WHERE id = $2")
                .bind(name)
                .bind(claims.sub)
                .execute(&state.db)
                .await;
        }
    }

    let id = Uuid::new_v4();

    // Create the incident immediately with a placeholder for AI advice
    let incident = sqlx::query_as::<_, Incident>(
        "INSERT INTO incidents (id, reporter_id, location, status, severity, emergency_type, details, latitude, longitude, ai_advice, is_wounded, additional_details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *"
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&payload.location)
    .bind("reported")
    .bind("high") // Default to high
    .bind("Analyzing...")
    .bind(&payload.panic_message)
    .bind(payload.latitude)
    .bind(payload.longitude)
    .bind("📡 SYNCING_WITH_CRISIS_AI...")
    .bind(payload.is_wounded.unwrap_or(false))
    .bind(&payload.additional_details)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        println!("DB error: {}", e);
        AppError::InternalServerError("Failed to create incident".to_string())
    })?;

    // Broadcast the initial incident creation
    let msg = serde_json::json!({
        "type": "NEW_INCIDENT",
        "data": incident.clone()
    }).to_string();
    let _ = state.tx.send(msg);

    // Spawn a background task for real-time AI parsing
    let panic_msg = payload.panic_message.clone();
    let location_str = payload.location.clone();
    let lat = payload.latitude;
    let lng = payload.longitude;
    let state_clone = state.clone();
    let incident_id = incident.id;

    let additional_details = payload.additional_details.clone();
    let is_wounded = payload.is_wounded.unwrap_or(false);

    tokio::spawn(async move {
        if let Some(parsed) = crate::handlers::ai::parse_emergency_data(&panic_msg, &location_str, lat, lng, is_wounded, additional_details.as_deref()).await {
            // Update the incident with AI results
            let update_res = sqlx::query_as::<_, Incident>(
                "UPDATE incidents SET emergency_type = $1, severity = $2, details = $3, ai_advice = $4, hospital_contacts = $5, updated_at = NOW() WHERE id = $6 RETURNING *"
            )
            .bind(parsed.emergency_type)
            .bind(parsed.severity)
            .bind(parsed.details)
            .bind(parsed.ai_advice)
            .bind(parsed.hospital_contacts)
            .bind(incident_id)
            .fetch_one(&state_clone.db)
            .await;

            if let Ok(updated_incident) = update_res {
                // Broadcast the update via WebSocket
                let update_msg = serde_json::json!({
                    "type": "UPDATE_INCIDENT",
                    "data": updated_incident
                }).to_string();
                let _ = state_clone.tx.send(update_msg);
                println!("✅ Real-time AI advice synced for incident {}", incident_id);
            }
        }
    });

    Ok(Json(incident))
}

pub async fn update_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _claims: Claims,
    Json(payload): Json<UpdateStatusRequest>,
) -> Result<Json<Incident>, AppError> {
    let incident = if let Some(e_type) = payload.emergency_type {
        sqlx::query_as::<_, Incident>(
            "UPDATE incidents SET status = $1, emergency_type = $2, updated_at = NOW() WHERE id = $3 RETURNING *"
        )
        .bind(&payload.status)
        .bind(&e_type)
        .bind(id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query_as::<_, Incident>(
            "UPDATE incidents SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *"
        )
        .bind(&payload.status)
        .bind(id)
        .fetch_optional(&state.db)
        .await
    }
    .map_err(|e| {
        println!("Update error: {}", e);
        AppError::InternalServerError("Failed to update incident".to_string())
    })?
    .ok_or(AppError::NotFound("Incident not found".to_string()))?;

    let msg = serde_json::json!({
        "type": "UPDATE_INCIDENT",
        "data": incident
    }).to_string();
    let _ = state.tx.send(msg);

    Ok(Json(incident))
}

pub async fn delete_incident(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
) -> Result<StatusCode, AppError> {
    // Guests cannot delete incidents
    if claims.role == "guest" {
        return Err(AppError::Unauthorized("Guests cannot remove incidents".to_string()));
    }

    // Verify the incident exists and is resolved
    #[derive(sqlx::FromRow)]
    struct StatusCheck { status: String }

    let mut tx = state.db.begin().await.map_err(|_| AppError::InternalServerError("Failed to begin transaction".to_string()))?;

    let check = sqlx::query_as::<_, StatusCheck>("SELECT status FROM incidents WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| {
            println!("Check error: {}", e);
            AppError::InternalServerError("Database error".to_string())
        })?
        .ok_or(AppError::NotFound("Incident not found".to_string()))?;

    if check.status != "resolved" {
        return Err(AppError::BadRequest("Only resolved incidents can be removed".to_string()));
    }

    // Delete related records first to satisfy foreign key constraints
    sqlx::query("DELETE FROM messages WHERE incident_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            println!("Failed to delete messages: {}", e);
            AppError::InternalServerError("Failed to delete messages".to_string())
        })?;

    sqlx::query("DELETE FROM incident_reports WHERE incident_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|_| AppError::InternalServerError("Failed to delete incident reports".to_string()))?;

    sqlx::query("DELETE FROM incidents WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            println!("Failed to delete incident: {}", e);
            AppError::InternalServerError("Failed to delete incident".to_string())
        })?;

    tx.commit().await.map_err(|_| AppError::InternalServerError("Failed to commit transaction".to_string()))?;

    let msg = serde_json::json!({
        "type": "DELETE_INCIDENT",
        "data": { "id": id.to_string() }
    }).to_string();
    let _ = state.tx.send(msg);

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct ToggleRespondRequest {
    pub is_responding: bool,
}

pub async fn toggle_respond(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
    Json(payload): Json<ToggleRespondRequest>,
) -> Result<Json<Incident>, AppError> {
    if claims.role != "responder" && claims.role != "staff" {
        return Err(AppError::Unauthorized("Only authorities can respond to incidents".to_string()));
    }

    let responder_id = if payload.is_responding {
        Some(claims.sub)
    } else {
        None
    };

    let incident = sqlx::query_as::<_, Incident>(
        "UPDATE incidents SET responder_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *"
    )
    .bind(responder_id)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        println!("Update responder error: {}", e);
        AppError::InternalServerError("Failed to update responder".to_string())
    })?
    .ok_or(AppError::NotFound("Incident not found".to_string()))?;

    let msg = serde_json::json!({
        "type": "UPDATE_INCIDENT",
        "data": incident
    }).to_string();
    let _ = state.tx.send(msg);

    Ok(Json(incident))
}

pub async fn get_messages(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
) -> Result<Json<Vec<crate::models::Message>>, AppError> {
    if claims.role == "guest" || claims.role == "user" {
        let is_owner = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM incidents WHERE id = $1 AND reporter_id = $2)"
        )
        .bind(id)
        .bind(claims.sub)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::InternalServerError("Database error".to_string()))?;

        if !is_owner {
            return Err(AppError::Unauthorized("Unauthorized access to incident messages".to_string()));
        }
    }

    let messages = sqlx::query_as::<_, crate::models::Message>(
        "SELECT * FROM messages WHERE incident_id = $1 ORDER BY timestamp ASC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        println!("Fetch messages error: {}", e);
        AppError::InternalServerError("Failed to fetch messages".to_string())
    })?;

    Ok(Json(messages))
}

#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
}

pub async fn send_message(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
    Json(payload): Json<SendMessageRequest>,
) -> Result<Json<crate::models::Message>, AppError> {
    if claims.role == "guest" || claims.role == "user" {
        let is_owner = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM incidents WHERE id = $1 AND reporter_id = $2)"
        )
        .bind(id)
        .bind(claims.sub)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::InternalServerError("Database error".to_string()))?;

        if !is_owner {
            return Err(AppError::Unauthorized("Unauthorized access to incident".to_string()));
        }
    }

    let sender_name = sqlx::query_scalar::<_, String>("SELECT name FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::InternalServerError("Failed to fetch sender name".to_string()))?;

    let message_id = Uuid::new_v4();
    let message = sqlx::query_as::<_, crate::models::Message>(
        "INSERT INTO messages (id, incident_id, sender_id, sender_name, content) VALUES ($1, $2, $3, $4, $5) RETURNING *"
    )
    .bind(message_id)
    .bind(id)
    .bind(claims.sub)
    .bind(sender_name)
    .bind(&payload.content)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        println!("Send message error: {}", e);
        AppError::InternalServerError("Failed to send message".to_string())
    })?;

    let msg = serde_json::json!({
        "type": "NEW_MESSAGE",
        "data": message
    }).to_string();
    let _ = state.tx.send(msg);

    Ok(Json(message))
}
