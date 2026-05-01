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
    let r_key = env::var("RESEND_API_KEY").is_ok();
    let s_key = env::var("SENDGRID_API_KEY").is_ok();
    let b_key = env::var("BREVO_API_KEY").is_ok();

    if r_key || s_key || b_key {
        let provider = if r_key { "Resend" } else if b_key { "Brevo" } else { "SendGrid" };
        println!("✅ HTTP Email API Key detected ({})", provider);
    } else {
        println!("\n=========================================");
        println!("⚠️  NO EMAIL API KEYS DETECTED.");
        println!("Checked for: RESEND_API_KEY, BREVO_API_KEY, SENDGRID_API_KEY");
        println!("Please add one to your Render Environment Variables.");
        println!("=========================================\n");
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

    let _ = sqlx::query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS hospital_contacts TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS is_wounded BOOLEAN DEFAULT FALSE").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS additional_details TEXT").execute(&pool).await;

    // Profile fields for users
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation TEXT")
        .execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS dob DATE")
        .execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT")
        .execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT")
        .execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact TEXT")
        .execute(&pool).await;

    // Chat fields
    let _ = sqlx::query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT")
        .execute(&pool).await;

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
