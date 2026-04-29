use sqlx::{PgPool, postgres::PgPoolOptions};
use std::{env, time::Duration};

pub async fn get_pool() -> PgPool {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    // Retry up to 5 times with 2-second delays to handle Render cold-start delays
    let mut attempts = 0u32;
    loop {
        attempts += 1;
        match PgPoolOptions::new()
            .max_connections(50)
            .min_connections(5)
            .acquire_timeout(Duration::from_secs(15))
            .idle_timeout(Duration::from_secs(30))
            .max_lifetime(Duration::from_secs(1800))
            .connect(&database_url)
            .await
        {
            Ok(pool) => {
                println!("✅ PostgreSQL connected (attempt {})", attempts);
                return pool;
            }
            Err(e) => {
                if attempts >= 5 {
                    panic!("Failed to connect to PostgreSQL after {} attempts: {}", attempts, e);
                }
                println!(
                    "⚠️  DB connection attempt {} failed: {}. Retrying in 2s...",
                    attempts, e
                );
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        }
    }
}