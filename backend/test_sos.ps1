$tokenResp = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/auth/guest"
$token = $tokenResp.token

$body = @{
    location = "Park Street, Kolkata"
    panic_message = "Help! There is an earthquake and people are trapped!"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/incidents" -Headers $headers -Body $body
