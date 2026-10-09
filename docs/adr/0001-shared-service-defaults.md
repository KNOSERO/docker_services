# Shared service values with generic backend templates

The panel code owns the fixed editable schema and validation. Each service keeps one tracked `services/<service>/service-defaults.yml` containing common defaults only.

All services render through the same two backend templates: `templates/docker/` and `templates/k3s/helm/`. Backend-specific behavior, such as Docker networks and sockets or K3s host networking and ingress, lives in shared templates and backend mappings in panel code. Per-service Compose and Helm deployment trees are not maintained.

Rendering layers the shared backend template, the service's common defaults, and the selected service/backend/target override in that order. Target overrides stay separate under `.config/services/`, so changing one host or cluster does not change another target.
