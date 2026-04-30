use axum::{
    routing::{get, post, put, delete},
    Router,
};

use crate::AppState;
use crate::handlers::{auth, incidents, ws, ai};

async fn health_check() -> &'static str {
    "OK"
}

pub fn app_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/verify-otp", post(auth::verify_otp))
        .route("/api/auth/forgot-password", post(auth::forgot_password))

        .route("/api/auth/reset-password", post(auth::reset_password))
        .route("/api/auth/guest", post(auth::guest_login))
        .route("/api/auth/cleanup-guest", post(auth::cleanup_guest))
        .route("/api/auth/delete-account", delete(auth::delete_account))
        .route("/api/auth/me", get(auth::get_profile))
        .route("/api/auth/profile", put(auth::update_profile))
        .route("/api/incidents", get(incidents::list_incidents).post(incidents::create_incident))
        .route("/api/incidents/{id}/status", put(incidents::update_status))
        .route("/api/incidents/{id}/respond", post(incidents::toggle_respond))
        .route("/api/incidents/{id}/messages", get(incidents::get_messages).post(incidents::send_message))
        .route("/api/incidents/{id}", delete(incidents::delete_incident))
        .route("/api/ai/chat", post(ai::ai_chat))
        .route("/api/ws", get(ws::ws_handler))
        .with_state(state)
}