# ── Variables globales ────────────────────────────────────────────────────────

variable "aws_region" {
  description = "Region AWS principal (RGPD: datos en Europa)"
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Entorno de despliegue: staging o production"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "El entorno debe ser 'staging' o 'production'."
  }
}

variable "aws_account_id" {
  description = "ID de la cuenta AWS (necesario para ARNs de Secrets Manager)"
  type        = string
}

# ── Landing / CloudFront (archivos existentes, NO modificar) ──────────────────

variable "acm_certificate_arn" {
  description = "ARN del certificado ACM en us-east-1 para CloudFront (landing)"
  type        = string
}

variable "cloudfront_distribution_id" {
  description = "ID de la distribucion CloudFront de la landing (disponible tras el primer apply)"
  type        = string
  default     = ""
}

# ── DNS ───────────────────────────────────────────────────────────────────────

variable "route53_zone_id" {
  description = "Zone ID de la zona Route 53 para healthy.app"
  type        = string
}

# ── VPC ───────────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block de la VPC principal"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_public_1a_cidr" {
  description = "CIDR de la subnet publica en eu-west-1a (ALB, NAT)"
  type        = string
  default     = "10.0.1.0/24"
}

variable "subnet_public_1b_cidr" {
  description = "CIDR de la subnet publica en eu-west-1b (ALB redundancia)"
  type        = string
  default     = "10.0.2.0/24"
}

variable "subnet_private_1a_cidr" {
  description = "CIDR de la subnet privada en eu-west-1a (ECS tasks)"
  type        = string
  default     = "10.0.10.0/24"
}

variable "subnet_private_1b_cidr" {
  description = "CIDR de la subnet privada en eu-west-1b (ECS tasks)"
  type        = string
  default     = "10.0.11.0/24"
}

variable "subnet_db_1a_cidr" {
  description = "CIDR de la subnet de base de datos en eu-west-1a (RDS)"
  type        = string
  default     = "10.0.20.0/24"
}

variable "subnet_db_1b_cidr" {
  description = "CIDR de la subnet de base de datos en eu-west-1b (RDS Multi-AZ)"
  type        = string
  default     = "10.0.21.0/24"
}

variable "subnet_cache_1a_cidr" {
  description = "CIDR de la subnet de cache en eu-west-1a (ElastiCache)"
  type        = string
  default     = "10.0.30.0/24"
}

variable "subnet_cache_1b_cidr" {
  description = "CIDR de la subnet de cache en eu-west-1b (ElastiCache)"
  type        = string
  default     = "10.0.31.0/24"
}

# ── RDS ───────────────────────────────────────────────────────────────────────

variable "rds_instance_class" {
  description = "Tipo de instancia RDS: db.t3.micro (staging), db.t3.small (produccion)"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "Almacenamiento inicial RDS en GB"
  type        = number
  default     = 20
}

variable "rds_username" {
  description = "Usuario administrador de PostgreSQL"
  type        = string
  default     = "healthy_admin"
  sensitive   = true
}

variable "rds_password" {
  description = "Contrasena del usuario administrador de PostgreSQL — inyectar desde secrets"
  type        = string
  sensitive   = true
}

# ── ElastiCache Redis ─────────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "Tipo de nodo Redis: cache.t3.micro (staging), cache.t3.small (produccion)"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_auth_token" {
  description = "Token de autenticacion para Redis — minimo 16 caracteres — inyectar desde secrets"
  type        = string
  sensitive   = true
}

# ── ECS ───────────────────────────────────────────────────────────────────────

variable "ecs_cpu" {
  description = "CPU para la tarea ECS en unidades (256=0.25 vCPU staging, 512=0.5 vCPU produccion)"
  type        = number
  default     = 256
}

variable "ecs_memory" {
  description = "Memoria para la tarea ECS en MB (512 staging, 1024 produccion)"
  type        = number
  default     = 512
}

variable "ecs_desired_count" {
  description = "Numero de tareas ECS deseadas (1 staging, 2 produccion)"
  type        = number
  default     = 1
}

variable "api_image_tag" {
  description = "Tag de la imagen Docker del backend en ECR (ej: develop-abc1234)"
  type        = string
  default     = "latest"
}
