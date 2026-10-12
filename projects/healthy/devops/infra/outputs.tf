# ── Outputs de la landing (CloudFront + S3) ───────────────────────────────────

output "cloudfront_domain_name" {
  description = "Dominio asignado por CloudFront (usado en los registros DNS alias)"
  value       = aws_cloudfront_distribution.landing.domain_name
}

output "cloudfront_distribution_id" {
  description = "ID de la distribucion CloudFront (necesario para invalidaciones desde CI)"
  value       = aws_cloudfront_distribution.landing.id
}

output "s3_bucket_name" {
  description = "Nombre del bucket S3 de la landing"
  value       = aws_s3_bucket.landing.bucket
}

output "s3_website_endpoint" {
  description = "Endpoint de website estatico del bucket S3 (sin SSL — usar CloudFront en produccion)"
  value       = aws_s3_bucket_website_configuration.landing.website_endpoint
}

# ── Outputs del backend (VPC, ALB, ECS, RDS, Redis) ──────────────────────────

output "vpc_id" {
  description = "ID de la VPC principal del proyecto"
  value       = aws_vpc.main.id
}

output "alb_dns_name" {
  description = "DNS name del Application Load Balancer del backend"
  value       = aws_lb.api.dns_name
}

output "alb_zone_id" {
  description = "Zone ID del ALB (para registros Route 53 alias)"
  value       = aws_lb.api.zone_id
}

output "ecr_repository_url" {
  description = "URL del repositorio ECR para las imagenes del backend"
  value       = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_name" {
  description = "Nombre del cluster ECS"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Nombre del servicio ECS del backend"
  value       = aws_ecs_service.api.name
}

output "rds_endpoint" {
  description = "Endpoint de conexion a la instancia RDS PostgreSQL"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "rds_db_name" {
  description = "Nombre de la base de datos PostgreSQL"
  value       = aws_db_instance.main.db_name
}

output "redis_primary_endpoint" {
  description = "Endpoint primario del cluster Redis"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "api_url" {
  description = "URL publica de la API del backend"
  value       = "https://api${var.environment == "production" ? "" : "-${var.environment}"}.healthy.app"
}
