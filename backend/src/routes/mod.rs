use axum::{
    routing::{get, post, put, delete},
    Router,
};

use crate::AppState;
use crate::handlers::{auth, incidents, ws, ai};

pub fn app_router(state: AppState) -> Router {
    Router::new()
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/verify-otp", post(auth::verify_otp))
        .route("/api/auth/forgot-password", post(auth::forgot_password))
        .route("/api/auth/reset-password", post(auth::reset_password))
        .route("/api/auth/guest", post(auth::guest_login))
        .route("/api/incidents", get(incidents::list_incidents).post(incidents::create_incident))
        .route("/api/incidents/{id}/status", put(incidents::update_status))
        .route("/api/incidents/{id}", delete(incidents::delete_incident))
        .route("/api/ai/chat", post(ai::ai_chat))
        .route("/api/ws", get(ws::ws_handler))
        .with_state(state)
}