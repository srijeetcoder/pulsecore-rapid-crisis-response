use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use axum::response::{IntoResponse, Response};
use serde_json::json;

use crate::utils::jwt::{verify_jwt, Claims};

impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok());

        match auth_header {
            Some(header) if header.starts_with("Bearer ") => {
                let token = header.trim_start_matches("Bearer ");
                match verify_jwt(token) {
                    Ok(claims) => Ok(claims),
                    Err(_) => Err((
                        StatusCode::UNAUTHORIZED,
                        axum::Json(json!({"error": "Invalid or expired token"})),
                    )
                        .into_response()),
                }
            }
            _ => Err((
                StatusCode::UNAUTHORIZED,
                axum::Json(json!({"error": "Missing or malformed Authorization header"})),
            )
                .into_response()),
        }
    }
}
