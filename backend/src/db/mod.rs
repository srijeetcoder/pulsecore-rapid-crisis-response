use sqlx::{sqlite::{SqliteConnectOptions, SqlitePoolOptions}, SqlitePool};
use std::str::FromStr;
use std::env;

pub async fn get_pool() -> SqlitePool {
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:sqlite.db".to_string());
    let options = SqliteConnectOptions::from_str(&database_url)
        .expect("Invalid database URL")
        .create_if_missing(true);

    SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .expect("Failed to connect to SQLite")
}
