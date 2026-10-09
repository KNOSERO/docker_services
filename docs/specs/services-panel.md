# Docker Services Control Panel

Implementation task: [#28](https://github.com/KNOSERO/docker_services/issues/28).

## Problem Statement

The repository manages ten services through separate service repositories, deployment files, Jenkins pipelines, and a small Podman-run installer. There is no single web interface for choosing a service, deployment backend, and target, editing that deployment's settings, saving them, and running the deployment explicitly. The current files cover only part of the required matrix: six services have K3s artifacts, four have Docker Compose artifacts, and none has both. SonarQube's current K3s configuration is a placeholder.

## Solution

Provide a Hermes-style web panel in the main repository. An operator selects one of the ten services, chooses Docker or K3s and a saved target profile, edits fields for that service/backend/target combination, and chooses **Save** or **Deploy** as separate actions. The panel runs locally in Podman or as an installable K3s application. The Podman instance is the controller host, not a deployment target.

The panel is an operator interface for the existing service installers. It does not automatically deploy every service at startup.

## User Stories

1. As a homelab operator, I want to see all ten services in one panel, so that I can manage them without opening separate repositories.
2. As a homelab operator, I want to choose Docker or K3s for a service, so that I can deploy that service to either supported backend.
3. As a homelab operator, I want every service to have a real Docker and K3s deployment definition, so that the backend selector works for all ten services.
4. As a homelab operator, I want to choose a saved Docker host or K3s cluster, so that each deployment has an explicit target.
5. As a homelab operator, I want to add, edit, and remove target profiles, so that I can manage the Docker hosts and K3s clusters available in the panel.
6. As a homelab operator, I want Docker target profiles to describe the SSH host and user, so that the panel can run the existing remote Docker deployment workflow.
7. As a homelab operator, I want K3s target profiles to identify the API endpoint and credential references, so that the panel can use the selected cluster.
8. As a homelab operator, I want the form to show fields for the selected service, backend, and target profile, so that I only edit relevant deployment settings.
9. As a homelab operator, I want each service/backend/target combination to have its own saved settings, so that different hosts and clusters can use different ports, paths, networks, and application options.
10. As a homelab operator, I want forms to expose service-specific settings such as images, ports, environment values, volumes, networks, ingress, and configuration files, so that I can change deployments without editing generic manifests manually.
11. As a homelab operator, I want **Save** to persist settings without deploying, so that I can review changes before they affect a target.
12. As a homelab operator, I want **Deploy** to use the saved settings for the selected service/backend/target, so that deployment is an explicit operation.
13. As a homelab operator, I want invalid configurations to be rejected before deployment, so that malformed Compose or Helm settings do not reach a target.
14. As a homelab operator, I want to see deployment progress and the current stage, so that I know whether an operation is running, succeeded, or failed.
15. As a homelab operator, I want to inspect job logs and results, so that I can diagnose failed deployments.
16. As a homelab operator, I want a history of deployment jobs, so that I can review previous operations and their outcomes.
17. As a homelab operator, I want secrets to load through the repository's existing secrets convention, so that credentials are not copied into editable service configuration.
18. As a homelab operator, I want the panel to run locally in Podman at `127.0.0.1:6868`, so that I can use it from the controller host.
19. As a homelab operator, I want to install the panel into K3s, so that it can be used from the cluster's internal network.
20. As a homelab operator, I want the future K3s Ingress configuration to use `admin.ravcube.com`, so that the intended hostname is prepared without deploying the panel to production now.
21. As a maintainer, I want the initial panel to have no login, so that authentication can be added later without blocking the first version.
22. As a maintainer, I want the unauthenticated panel limited to localhost or the cluster's internal network, so that the future hostname does not by itself expose administrative actions publicly.
23. As a maintainer, I want the panel's saved configuration to survive a restart, so that service forms and target profiles do not reset after redeployment.
24. As a maintainer, I want all tracked file content from the ten service submodules and two Docker/K3s template submodules brought into this repository, so that the main repository can manage the complete system in one place.
25. As a maintainer, I want nested submodule file content migrated as well, so that deployment assets do not disappear when gitlinks are removed.
26. As a maintainer, I want CI pipelines, documentation, licenses, and helper files retained during migration, so that the unified repository preserves the existing operational material.
27. As a maintainer, I want upstream GitHub repositories left intact, so that unlinking submodules does not delete the original projects.

## Implementation Decisions

- The frontend follows the navigation, dashboard, configuration, job history, and job detail patterns in `KNOSERO/hermes`, adapted to service deployment. The panel is not a generic file editor.
- The main navigation provides service operations, target profiles, job history, and job details/logs.
- Target profiles are stored in `.config/targets.yml`. Service overrides are stored separately for each service/backend/target under `.config/services/`.
- `.config/` is local application state, ignored by Git, and persisted through a host bind mount in Podman or a persistent volume in K3s.
- Checked-in Compose, playbook, Helm, and configuration files remain deployment bases. Saving a form writes the selected local override and does not silently edit a checked-in service file.
- Target profiles store non-secret connection settings and references to secret files. They do not contain credential values.
- Secrets continue to be loaded from the existing `secrets/` directory in local mode, mounted read-only. In K3s, Jenkins supplies target credentials (`k3s-token`, `k3s-ca.crt`, `id_home_lab`, and `known_hosts`) through `services-panel-target-secrets`; application secret files stay in the separate, optional `services-panel-secrets` Secret so Jenkins does not overwrite them. The panel does not expose secret contents back to the browser or save them in `.config/`.
- K3s deployment follows the current Jenkinsfile credential pattern: load the API endpoint, CA certificate, and token from secrets, compose a temporary kubeconfig for the job, and invoke Helm with it. The temporary kubeconfig is not written to persistent configuration or logs.
- Docker deployment uses the selected SSH target and the service's Docker/Compose/Ansible deployment assets.
- K3s deployment uses the selected K3s target and the service's Helm deployment assets. Existing validation and install/upgrade behavior is retained where applicable.
- The existing service audit is the starting inventory for the forms. It identifies the fields each service needs, including persistent data, ports, environment values, config files, networks, and runtime permissions.
- Complete the missing Docker/K3s variants for all ten services. Replace the SonarQube placeholder with an actual SonarQube configuration.
- Disconnect all twelve top-level submodules and nested submodules from this repository only after all their tracked file content is migrated. Preserve CI, docs, licenses, and helper files. Keep all upstream repositories.
- Local mode binds only to `127.0.0.1:6868`. The K3s deployment configuration prepares Ingress host `admin.ravcube.com`, but production is not deployed as part of this work. With no login in v1, access remains limited to localhost and the cluster's internal network.

## Configuration Model (current decision)

This section supersedes earlier details that implied editing arbitrary service/backend fields or keeping duplicate common defaults in Compose and Helm.

- The fixed common schema and validation live in panel code. Each service has one maintainer-owned YAML file for common defaults; it provides values only and cannot add fields or change validation. Existing `services/<service>/config.yml` files remain Helm overrides where Jenkins already consumes them.
- The same common defaults feed Docker and K3s. Native Compose and Helm assets remain deployment bases for complex or backend-specific settings, which are not edited in the panel in this first iteration.
- The panel shows only applicable common fields for the selected service/backend. Application configuration file contents stay checked in; secrets stay external and are never returned to the browser or saved as values.
- The panel stores operator overrides separately per service/backend/target under `.config/services/`. Render precedence is native backend base, shared service defaults, then the selected target override. This keeps backend-only settings native while making common values consistent; target overrides have highest priority and do not affect other targets.
- **Save** updates only target state. **Deploy** renders and validates the selected Compose or Helm result before creating a deployment job.
- Existing saved target values are migrated automatically and idempotently. Original files remain available until successful reading of migrated state is confirmed.

## Testing Decisions

- Prefer one end-to-end integration seam at the panel's browser boundary: run the app with a temporary `.config/` store and fake external deployment adapters, then drive target selection, form editing, **Save**, and **Deploy** through the UI. Assert that Save persists without starting a job, Deploy uses the saved service/backend/target values, and job status/history/logs reflect success and failure.
- Reuse the current installer test's external-command mocking style. Do not require a live SSH server, Docker host, K3s cluster, or real credentials in the integration suite.
- At the same seam, cover representative Docker and K3s jobs and failure propagation. Keep tests focused on user-visible outcomes and commands, not internal helpers.
- Validate all Docker Compose definitions with the existing Compose config check pattern.
- Validate all K3s charts with Helm lint and template/render checks, following the existing Jenkinsfile pipelines.
- Verify that every service has both backend definitions and that secret values do not appear in saved configuration, API responses, job history, or logs.

## Out of Scope

- Production deployment of the panel to `admin.ravcube.com`.
- Login and user management in the first version.
- Installing Docker or K3s on deployment targets.
- Deleting upstream service/template repositories.
- Live deployment testing against the homelab as part of specification authoring.
- Moving application data between storage systems as part of submodule migration.

## Further Notes

- The static service audit does not prove that current or planned deployments work against live Docker/K3s targets.
- The repository does not define the permission scope of the Jenkins K3s token. The panel will inherit the rights of the token supplied through the secrets convention; its actual RBAC scope must be verified before production access is enabled.
- The service audit identifies special cases that must be represented in the backend definitions: DNS and proxy networks/ports, Portainer's Docker socket/runtime, VPN network capabilities, and per-service persistent data/configuration.
- The agreed hostname is a future configuration target. The current release remains local/internal and is not enabled in production.
