use sqlx::{PgPool, postgres::PgPoolOptions};
use std::env;
use std::time::Duration;

pub async fn get_pool() -> PgPool {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    PgPoolOptions::new()
        .max_connections(1)
        .connect_timeout(Duration::from_secs(10))
        .connect(&database_url)
        .await
        .expect("Failed to connect to PostgreSQL")
}