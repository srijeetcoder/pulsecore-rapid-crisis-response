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
}

#[derive(Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
}

pub async fn list_incidents(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<Incident>>, AppError> {
    let incidents = if claims.role == "guest" || claims.role == "user" {
        sqlx::query_as::<_, Incident>("SELECT * FROM incidents WHERE reporter_id = ? ORDER BY created_at DESC")
            .bind(claims.sub)
            .fetch_all(&state.db)
            .await
    } else {
        sqlx::query_as::<_, Incident>("SELECT * FROM incidents ORDER BY created_at DESC")
            .fetch_all(&state.db)
            .await
    }.map_err(|_| AppError::InternalServerError("Failed to fetch incidents".to_string()))?;

    Ok(Json(incidents))
}

pub async fn create_incident(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateIncidentRequest>,
) -> Result<Json<Incident>, AppError> {
    let id = Uuid::new_v4();

    let parsed_ai = crate::handlers::ai::parse_emergency_data(&payload.panic_message).await;

    let (emergency_type, severity, details, ai_advice) = match parsed_ai {
        Some(p) => (Some(p.emergency_type), p.severity, Some(p.details), Some(p.ai_advice)),
        None => (
            Some("Other".to_string()), 
            "high".to_string(), 
            Some(payload.panic_message.clone()), 
            Some("AI parsing failed. Dispatch immediately.".to_string())
        )
    };

    let incident = sqlx::query_as::<_, Incident>(
        "INSERT INTO incidents (id, reporter_id, location, status, severity, emergency_type, details, latitude, longitude, ai_advice) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&payload.location)
    .bind("reported")
    .bind(&severity)
    .bind(&emergency_type)
    .bind(&details)
    .bind(payload.latitude)
    .bind(payload.longitude)
    .bind(ai_advice)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        println!("DB error: {}", e);
        AppError::InternalServerError("Failed to create incident".to_string())
    })?;

    let msg = serde_json::json!({
        "type": "NEW_INCIDENT",
        "data": incident
    }).to_string();
    let _ = state.tx.send(msg);

    Ok(Json(incident))
}

pub async fn update_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    _claims: Claims,
    Json(payload): Json<UpdateStatusRequest>,
) -> Result<Json<Incident>, AppError> {
    let incident = sqlx::query_as::<_, Incident>(
        "UPDATE incidents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *"
    )
    .bind(&payload.status)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| AppError::InternalServerError("Failed to update incident".to_string()))?
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

    let check = sqlx::query_as::<_, StatusCheck>("SELECT status FROM incidents WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| AppError::InternalServerError("Database error".to_string()))?
        .ok_or(AppError::NotFound("Incident not found".to_string()))?;

    if check.status != "resolved" {
        return Err(AppError::BadRequest("Only resolved incidents can be removed".to_string()));
    }

    // Delete related records first to satisfy foreign key constraints
    sqlx::query("DELETE FROM messages WHERE incident_id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            println!("Failed to delete messages: {}", e);
            AppError::InternalServerError("Failed to delete messages".to_string())
        })?;

    sqlx::query("DELETE FROM incident_reports WHERE incident_id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| AppError::InternalServerError("Failed to delete incident reports".to_string()))?;

    sqlx::query("DELETE FROM incidents WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            println!("Failed to delete incident: {}", e);
            AppError::InternalServerError("Failed to delete incident".to_string())
        })?;

    let msg = serde_json::json!({
        "type": "DELETE_INCIDENT",
        "data": { "id": id.to_string() }
    }).to_string();
    let _ = state.tx.send(msg);

    Ok(StatusCode::NO_CONTENT)
}
