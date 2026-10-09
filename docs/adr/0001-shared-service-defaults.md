# Shared service defaults with native backend bases

The panel code owns the fixed common schema and validation. Each service keeps one tracked YAML file for common editable defaults; existing `config.yml` files stay as Helm overrides for Jenkins. Rendering layers the native Compose or Helm base first, shared service defaults second, and the selected target override last. This avoids duplicated defaults while keeping complex backend-specific settings native and operator changes isolated per target.
