# Build stage
FROM rust:1.88-bookworm as builder
WORKDIR /usr/src/app
COPY . .
RUN apt-get update && apt-get install -y pkg-config libssl-dev
RUN cargo build --release

# Run stage
FROM debian:bookworm-slim
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/src/app/target/release/backend /usr/local/bin/backend
COPY --from=builder /usr/src/app/migrations /usr/src/app/migrations
EXPOSE 8080
CMD ["backend"]