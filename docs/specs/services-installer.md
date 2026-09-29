# Docker services installer

## Problem Statement

Docker services are currently deployed individually through generic service
playbooks. The main repository has no single repeatable installer that can
prepare both homelab hosts and deploy the required services to their intended
locations.

## Solution

Provide one Podman-run Ansible installer for the main repository. It connects
to `onyx` and `ruby` using the existing homelab SSH convention, prepares the
required Docker networks, and deploys the existing DNS, proxy, and Portainer
service definitions in a deterministic order.

DNS runs on both hosts. Proxy and Portainer run only on `ruby`. Repeated runs
pull images and recreate containers while preserving data under
`/mnt/core_data`.

## User Stories

1. As a homelab operator, I want one installer command, so that I do not need to deploy each service manually.
2. As a homelab operator, I want the installer to run in a local Podman container, so that the host only needs the existing container runtime and repository secrets.
3. As a homelab operator, I want the installer to use the existing SSH key convention, so that credentials are not embedded in the image or committed to the repository.
4. As a homelab operator, I want the installer to target `onyx` and `ruby`, so that both homelab hosts are configured consistently.
5. As a homelab operator, I want DNS deployed to `onyx`, so that the primary host answers DNS requests.
6. As a homelab operator, I want DNS deployed to `ruby`, so that the secondary host answers DNS requests if the primary is unavailable.
7. As a homelab operator, I want proxy deployed only to `ruby`, so that its public service endpoint has one defined host.
8. As a homelab operator, I want Portainer deployed only to `ruby`, so that its management interface has one defined host.
9. As a homelab operator, I want required external Docker networks created automatically, so that Compose deployment does not fail on a clean host.
10. As a homelab operator, I want the installer to preserve service data, so that redeployment does not remove DNS, proxy, or Portainer state.
11. As a homelab operator, I want repeated runs to pull current images and recreate containers, so that updates use the same operational procedure as the existing service workflow.
12. As a homelab operator, I want the installer to stop at the first failed stage, so that a partial deployment is not reported as successful.
13. As a homelab operator, I want the installer to deploy in a fixed order, so that dependencies and failures are easy to understand.
14. As a homelab operator, I want proxy to use the two deployed DNS hosts, so that its resolver configuration matches the homelab topology.
15. As a homelab operator, I want existing Compose definitions reused, so that service configuration is not duplicated in the installer.
16. As a maintainer, I want service submodules to remain the source of deployment files, so that changes to a service are not silently forked in the main repository.
17. As a maintainer, I want the installer image built reproducibly, so that local runs and CI use the same Ansible entrypoint.
18. As a maintainer, I want Compose syntax validated, so that malformed service configuration is caught before deployment.
19. As a maintainer, I want the installer to report the current stage and target host, so that operational failures can be diagnosed without reading implementation details.
20. As a maintainer, I want existing individual service playbooks preserved, so that current CI and manual workflows continue to work.

## Implementation Decisions

- Build one local installer container containing Ansible, SSH tooling, the host inventory, and the orchestration entrypoint.
- Run the installer with Podman Compose and mount the existing secrets directory read-only.
- Use SSH user `rav`, key `id_home_lab`, `onyx` at `192.168.0.2`, and `ruby` at `192.168.0.3`.
- Reuse the existing service playbooks and Compose definitions instead of duplicating deployment logic.
- Ensure the Docker networks required by DNS and proxy exist on the target hosts before service deployment.
- Execute stages in this order: prepare Docker networks, deploy DNS to `onyx`, deploy DNS to `ruby`, deploy proxy to `ruby`, deploy Portainer to `ruby`.
- Stop immediately when any stage fails and return a non-zero exit status.
- Keep deployment repeatable by pulling images and using forced Compose recreation with orphan cleanup.
- Preserve persistent data by retaining the existing host volume mappings.
- Configure proxy DNS resolvers as `192.168.0.2` and `192.168.0.3`.
- Keep the existing individual service playbooks available for CI and manual use.

## Testing Decisions

- Test the complete installer container at its external orchestration seam with SSH/Ansible behavior mocked.
- Assert stage order, target hosts, network creation, service placement, fail-fast behavior, and repeat-run Compose options.
- Test that persistent volume mappings are passed through unchanged.
- Validate every Compose definition with the available Compose config command.
- Test only observable commands, targets, and outcomes; do not test shell helper structure.
- Use the existing service Compose validation script as prior art for syntax checks.

## Out of Scope

- Installing Docker itself on the target hosts; Docker is already installed.
- Changing the service images, exposed ports, persistent storage layout, or application settings except for proxy DNS addresses.
- Replacing the existing individual service playbooks.
- Installing K3s, NFS, GlusterFS, or other host infrastructure.
- Adding TLS or authentication changes to Docker or SSH.
- Adding a service dashboard, web UI, or long-running installer daemon.
- Synchronizing Pi-hole state beyond the existing shared storage configuration.

## Further Notes

The installer must be run only after the target storage paths are mounted and
the SSH key is available in the repository's secrets convention. The DNS
service intentionally remains active on both hosts.
