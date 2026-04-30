pub mod db;
pub mod handlers;
pub mod models;
pub mod routes;
pub mod utils;

use axum::http::{header, Method};
use dotenvy::dotenv;
use sqlx::PgPool;
use std::env;
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub tx: broadcast::Sender<String>,
}

#[tokio::main]
async fn main() {
    // Load .env explicitly from the backend directory (handles running from any CWD)
    dotenv().ok();

    // Check for HTTP Email API keys
    let resend_key = env::var("RESEND_API_KEY").is_ok();
    let sendgrid_key = env::var("SENDGRID_API_KEY").is_ok();
    let brevo_key = env::var("BREVO_API_KEY").is_ok();

    if resend_key || sendgrid_key || brevo_key {
        println!("✅ HTTP Email API Key detected. Ready to send emails on Render.");
    } else {
        println!("⚠️  NO HTTP EMAIL API KEY DETECTED.");
        println!("   Email delivery will fail on Render. Please set RESEND_API_KEY.");
    }
    
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,backend=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let pool = db::get_pool().await;
    
    // Safe raw SQL migration to ensure responder_id column exists
    let _ = sqlx::query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS responder_id UUID REFERENCES users(id)")
        .execute(&pool)
        .await;

    // Run migrations
    //sqlx::migrate!("./migrations")
    //  .run(&pool)
    //  .await
    //  .expect("Failed to run migrations");

    let (tx, _rx) = broadcast::channel(100);

    let state = AppState {
        db: pool,
        tx,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    let app = routes::app_router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);
    
    tracing::info!("Server listening on {}", addr);
    let listener = TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
