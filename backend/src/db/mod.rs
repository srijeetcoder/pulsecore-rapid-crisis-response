use sqlx::{PgPool, postgres::{PgPoolOptions, PgConnectOptions}};
use std::env;
use std::str::FromStr;

pub async fn get_pool() -> PgPool {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    // Disable statement caching for compatibility with PgBouncer/Render
    let options = PgConnectOptions::from_str(&database_url)
        .expect("Invalid DATABASE_URL")
        .statement_cache_capacity(0);

    PgPoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .expect("Failed to connect to PostgreSQL")
}