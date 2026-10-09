# Shared service defaults with native backend bases

Common editable deployment values are defined once per service and rendered into both Docker Compose and Helm. Each backend keeps its native assets for complex platform-specific settings, while operator overrides remain isolated per target; this avoids duplicated defaults without hiding Docker and Kubernetes differences behind an untyped manifest editor.
