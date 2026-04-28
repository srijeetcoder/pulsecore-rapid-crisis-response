use axum::{extract::State, Json};
use bcrypt::{hash, verify};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{Utc, Duration};
use rand::Rng;
use std::env;

use lettre::{Message, AsyncSmtpTransport, AsyncTransport, Tokio1Executor};
use lettre::transport::smtp::authentication::Credentials;
use lettre::message::header::ContentType;

use crate::{
    models::User,
    utils::{
        error::AppError,
        jwt::create_jwt,
    },
    AppState,
};

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub name: String,
    pub email: String,
    pub password: String,
    pub role: String,
}

#[derive(Serialize)]
pub struct RegisterResponse {
    pub message: String,
    pub email: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

#[derive(Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub email: String,
    pub otp: String,
    pub new_password: String,
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<RegisterResponse>, AppError> {
    // Use cost 4 in dev to prevent massive delays in debug mode
    let password_hash = hash(&payload.password, 4)
        .map_err(|_| AppError::InternalServerError("Failed to hash password".to_string()))?;

    let id = Uuid::new_v4();

    // Insert unverified user
    let _user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, name, email, password_hash, role, is_verified) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING *"
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&payload.role)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("unique constraint") || e.to_string().contains("duplicate key") {
            AppError::BadRequest("Email already exists".to_string())
        } else {
            AppError::InternalServerError("Failed to create user".to_string())
        }
    })?;

    // Generate 6-digit OTP
    let otp: String = (0..6).map(|_| rand::thread_rng().gen_range(0..10).to_string()).collect();
    let otp_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO otp_tokens (id, email, otp, expires_at, used) VALUES ($1, $2, $3, $4, FALSE)"
    )
    .bind(otp_id)
    .bind(&payload.email)
    .bind(&otp)
    .bind(Utc::now() + Duration::minutes(15))
    .execute(&state.db)
    .await
    .map_err(|_| AppError::InternalServerError("Failed to generate OTP".to_string()))?;

    // Attempt to send email via async SMTP (Gmail)
    let smtp_username = env::var("SMTP_USERNAME").unwrap_or_default();
    let smtp_password = env::var("SMTP_PASSWORD").unwrap_or_default().replace(" ", "");

    // Always print to terminal first as a fallback
    println!("\n=========================================");
    println!("🔐 OTP For {}: {}", payload.email, otp);
    println!("=========================================\n");

    if !smtp_username.is_empty() && !smtp_password.is_empty() {
        let from_addr = smtp_username.clone();
        let to_addr = payload.email.clone();
        let otp_clone = otp.clone();
        let user_clone = smtp_username.clone();
        let pass_clone = smtp_password.clone();

        tokio::spawn(async move {
            let email_result = Message::builder()
                .from(format!("PulseCore <{}>", from_addr).parse().unwrap())
                .to(to_addr.parse().unwrap())
                .subject("Your OTP Verification Code - PulseCore")
                .header(ContentType::TEXT_HTML)
                .body(format!(
                    r#"
                    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#1e293b;color:#f1f5f9;border-radius:12px;">
                        <h2 style="color:#ef4444;margin-bottom:8px;">🚨 PulseCore</h2>
                        <p style="color:#94a3b8;">Your email verification code is:</p>
                        <div style="font-size:48px;font-weight:bold;letter-spacing:12px;text-align:center;padding:24px;background:#0f172a;border-radius:8px;margin:16px 0;">{}</div>
                        <p style="color:#94a3b8;font-size:14px;">This code expires in 15 minutes. Do not share it with anyone.</p>
                    </div>
                    "#,
                    otp_clone
                ))
                .unwrap();

            let creds = Credentials::new(user_clone, pass_clone);

            match AsyncSmtpTransport::<Tokio1Executor>::relay("smtp.gmail.com") {
                Ok(builder) => {
                    let mailer = builder.credentials(creds).build();
                    match mailer.send(email_result).await {
                        Ok(_) => println!("✅ Email sent successfully to {}", to_addr),
                        Err(e) => println!("❌ Failed to send email: {}", e),
                    }
                }
                Err(e) => println!("❌ SMTP relay error: {}", e),
            }
        });
    } else {
        println!("⚠️  SMTP_USERNAME or SMTP_PASSWORD not set in .env — skipping email send.");
    }

    Ok(Json(RegisterResponse {
        message: "OTP generated. Check your email inbox (and terminal as backup).".to_string(),
        email: payload.email,
    }))
}


#[derive(Deserialize)]
pub struct VerifyOtpRequest {
    pub email: String,
    pub otp: String,
    pub guest_id: Option<uuid::Uuid>,
}

pub async fn verify_otp(
    State(state): State<AppState>,
    Json(payload): Json<VerifyOtpRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // Only fetch id — avoids SQLite DateTime<Utc> deserialization issues
    #[derive(sqlx::FromRow)]
    struct OtpRecord {
        id: uuid::Uuid,
    }

    println!("🔍 Verifying OTP for email='{}' otp='{}'", payload.email, payload.otp);

    let record = sqlx::query_as::<_, OtpRecord>(
        "SELECT id FROM otp_tokens WHERE email = $1 AND otp = $2 AND used = FALSE AND expires_at > NOW()"
    )
    .bind(&payload.email)
    .bind(&payload.otp)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        println!("❌ DB error in verify_otp: {}", e);
        AppError::InternalServerError("Database error".to_string())
    })?
    .ok_or_else(|| {
        println!("❌ No matching OTP row found for email='{}' otp='{}'", payload.email, payload.otp);
        AppError::BadRequest("Invalid or expired OTP".to_string())
    })?;

    // Mark as used
    sqlx::query("UPDATE otp_tokens SET used = TRUE WHERE id = $1")
        .bind(&record.id)
        .execute(&state.db)
        .await
        .unwrap();

    // Mark user as verified
    let user = sqlx::query_as::<_, User>(
        "UPDATE users SET is_verified = TRUE WHERE email = $1 RETURNING *"
    )
    .bind(&payload.email)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| AppError::InternalServerError("Database error".to_string()))?
    .ok_or(AppError::NotFound("User not found".to_string()))?;

    // Transfer guest history if guest_id is provided
    if let Some(guest_id) = payload.guest_id {
        // 1. Update incidents to be owned by new user
        sqlx::query("UPDATE incidents SET reporter_id = $1 WHERE reporter_id = $2")
            .bind(user.id)
            .bind(guest_id)
            .execute(&state.db)
            .await
            .map_err(|e| {
                println!("❌ Failed to transfer incidents: {}", e);
                AppError::InternalServerError("Failed to transfer incidents".to_string())
            })?;

        // 2. Delete old guest account
        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(guest_id)
            .execute(&state.db)
            .await
            .map_err(|e| {
                println!("❌ Failed to delete guest account: {}", e);
                AppError::InternalServerError("Failed to delete guest account".to_string())
            })?;

        println!("🔄 Transferred incidents from guest {} to user {}", guest_id, user.id);
    }

    let token = create_jwt(user.id, &user.role)
        .map_err(|_| AppError::InternalServerError("Failed to create token".to_string()))?;

    Ok(Json(AuthResponse { token, user }))
}

pub async fn cleanup_guest(
    State(state): State<AppState>,
    claims: crate::utils::jwt::Claims,
) -> Result<Json<serde_json::Value>, AppError> {
    // Fetch user
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::NotFound("User not found".to_string()))?;

    // Ensure it's a temporary guest
    if user.role != "guest" || !user.email.ends_with("@pulsecore.local") {
        return Err(AppError::Unauthorized("Only temporary guests can be cleaned up".to_string()));
    }

    // Delete incidents
    sqlx::query("DELETE FROM incidents WHERE reporter_id = $1")
        .bind(claims.sub)
        .execute(&state.db)
        .await
        .map_err(|_| AppError::InternalServerError("Failed to delete incidents".to_string()))?;

    // Delete user
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(claims.sub)
        .execute(&state.db)
        .await
        .map_err(|_| AppError::InternalServerError("Failed to delete guest account".to_string()))?;

    println!("🧹 Cleaned up temporary guest account {}", claims.sub);

    Ok(Json(serde_json::json!({ "status": "success", "message": "Guest account and data deleted" })))
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| AppError::InternalServerError("Database error".to_string()))?
        .ok_or(AppError::Unauthorized("Invalid credentials".to_string()))?;

    if !user.is_verified {
        return Err(AppError::Unauthorized("Please verify your email first".to_string()));
    }

    let is_valid = verify(&payload.password, &user.password_hash)
        .map_err(|_| AppError::InternalServerError("Failed to verify password".to_string()))?;

    if !is_valid {
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    let token = create_jwt(user.id, &user.role)
        .map_err(|_| AppError::InternalServerError("Failed to create token".to_string()))?;

    Ok(Json(AuthResponse { token, user }))
}

#[derive(Serialize)]
pub struct GuestLoginResponse {
    pub token: String,
    pub user: User,
}

pub async fn guest_login(
    State(state): State<AppState>,
) -> Result<Json<GuestLoginResponse>, AppError> {
    let guest_id = Uuid::new_v4();
    let short_id = &guest_id.to_string()[..8];
    let guest_name = format!("Guest-{}", short_id);
    let guest_email = format!("guest-{}@pulsecore.local", short_id);
    // A random unusable password hash — guests can never log in conventionally
    let password_hash = hash("__guest_no_password__", 4)
        .map_err(|_| AppError::InternalServerError("Failed to hash password".to_string()))?;

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, name, email, password_hash, role, is_verified) VALUES ($1, $2, $3, $4, 'guest', TRUE) RETURNING *"
    )
    .bind(guest_id)
    .bind(&guest_name)
    .bind(&guest_email)
    .bind(&password_hash)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        println!("❌ guest_login DB error: {}", e);
        AppError::InternalServerError("Failed to create guest account".to_string())
    })?;

    let token = create_jwt(user.id, &user.role)
        .map_err(|_| AppError::InternalServerError("Failed to create token".to_string()))?;

    println!("🧑‍🤝‍🧑 Guest account created: {} ({})", guest_name, guest_email);

    Ok(Json(GuestLoginResponse { token, user }))
}

pub async fn forgot_password(
    State(state): State<AppState>,
    Json(payload): Json<ForgotPasswordRequest>,
) -> Result<Json<RegisterResponse>, AppError> {
    // Check if user exists
    let _user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| AppError::InternalServerError("Database error".to_string()))?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    // Generate 6-digit OTP
    let otp: String = (0..6).map(|_| rand::thread_rng().gen_range(0..10).to_string()).collect();
    let otp_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO otp_tokens (id, email, otp, expires_at, used) VALUES ($1, $2, $3, $4, FALSE)"
    )
    .bind(otp_id)
    .bind(&payload.email)
    .bind(&otp)
    .bind(Utc::now() + Duration::minutes(15))
    .execute(&state.db)
    .await
    .map_err(|_| AppError::InternalServerError("Failed to generate OTP".to_string()))?;

    // Send email (reusing the logic from register)
    let smtp_username = env::var("SMTP_USERNAME").unwrap_or_default();
    let smtp_password = env::var("SMTP_PASSWORD").unwrap_or_default().replace(" ", "");

    println!("\n=========================================");
    println!("🔐 Password Reset OTP For {}: {}", payload.email, otp);
    println!("=========================================\n");

    if !smtp_username.is_empty() && !smtp_password.is_empty() {
        let from_addr = smtp_username.clone();
        let to_addr = payload.email.clone();
        let otp_clone = otp.clone();
        let user_clone = smtp_username.clone();
        let pass_clone = smtp_password.clone();

        tokio::spawn(async move {
            let email_result = Message::builder()
                .from(format!("PulseCore <{}>", from_addr).parse().unwrap())
                .to(to_addr.parse().unwrap())
                .subject("Password Reset OTP - PulseCore")
                .header(ContentType::TEXT_HTML)
                .body(format!(
                    r#"
                    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#1e293b;color:#f1f5f9;border-radius:12px;">
                        <h2 style="color:#ef4444;margin-bottom:8px;">🚨 PulseCore</h2>
                        <p style="color:#94a3b8;">Your password reset verification code is:</p>
                        <div style="font-size:48px;font-weight:bold;letter-spacing:12px;text-align:center;padding:24px;background:#0f172a;border-radius:8px;margin:16px 0;">{}</div>
                        <p style="color:#94a3b8;font-size:14px;">This code expires in 15 minutes. If you didn't request this, please ignore this email.</p>
                    </div>
                    "#,
                    otp_clone
                ))
                .unwrap();

            let creds = Credentials::new(user_clone, pass_clone);

            match AsyncSmtpTransport::<Tokio1Executor>::relay("smtp.gmail.com") {
                Ok(builder) => {
                    let mailer = builder.credentials(creds).build();
                    match mailer.send(email_result).await {
                        Ok(_) => println!("✅ Reset email sent successfully to {}", to_addr),
                        Err(e) => println!("❌ Failed to send reset email: {}", e),
                    }
                }
                Err(e) => println!("❌ SMTP relay error: {}", e),
            }
        });
    }

    Ok(Json(RegisterResponse {
        message: "Password reset OTP sent. Check your email.".to_string(),
        email: payload.email,
    }))
}

pub async fn reset_password(
    State(state): State<AppState>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<Json<RegisterResponse>, AppError> {
    // Verify OTP
    let record = sqlx::query_as::<_, (Uuid,)> (
        "SELECT id FROM otp_tokens WHERE email = $1 AND otp = $2 AND used = FALSE AND expires_at > NOW()"
    )
    .bind(&payload.email)
    .bind(&payload.otp)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| AppError::InternalServerError("Database error".to_string()))?
    .ok_or(AppError::BadRequest("Invalid or expired OTP".to_string()))?;

    // Mark as used
    sqlx::query("UPDATE otp_tokens SET used = TRUE WHERE id = $1")
        .bind(&record.0)
        .execute(&state.db)
        .await
        .unwrap();

    // Hash new password
    let password_hash = hash(&payload.new_password, 4)
        .map_err(|_| AppError::InternalServerError("Failed to hash password".to_string()))?;

    // Update password
    sqlx::query("UPDATE users SET password_hash = $1 WHERE email = $2")
        .bind(&password_hash)
        .bind(&payload.email)
        .execute(&state.db)
        .await
        .map_err(|_| AppError::InternalServerError("Failed to update password".to_string()))?;

    Ok(Json(RegisterResponse {
        message: "Password updated successfully. You can now login.".to_string(),
        email: payload.email,
    }))
}

pub async fn get_profile(
    State(state): State<AppState>,
    claims: crate::utils::jwt::Claims,
) -> Result<Json<User>, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::NotFound("User not found".to_string()))?;
    
    Ok(Json(user))
}
