# Docker Services
A repository with configuration files for Docker and Kubernetes-based services.

## Homelab services installer

Prerequisites: Podman Compose locally, mounted storage on `onyx` and `ruby`,
the SSH files `secrets/id_home_lab` and `secrets/id_home_lab.pub`, and a K3s
    kubeconfig at `secrets/kubeconfig-k3s.yaml`. The kubeconfig API endpoint must
be reachable from the installer container.

Copy the K3s kubeconfig from the server:

```bash
scp rav@192.168.0.2:/etc/rancher/k3s/k3s.yaml secrets/kubeconfig-k3s.yaml
```

Initialize the service repositories, including Jenkins' Helm chart, before
building the installer:

```powershell
git submodule update --init --recursive
```

Run the installer from the repository root:

```powershell
podman compose -f docker/services/compose.yml run --rm --build services-installer
```

It prepares the Docker networks, deploys DNS to both hosts, and deploys proxy
and Portainer to `ruby`. It then installs or upgrades Jenkins on K3s with Helm.
The target hosts must have Docker Compose v2 installed. Re-running it pulls
images and recreates containers without removing data under `/mnt/core_data`.

-----

# Subproject
## Database

### Postgresql
PostgreSQL an open-source relational database used for storing and managing application data.

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/service_postgreSQL)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20PostgreSQL%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20PostgreSQL%20Service/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/service_postgreSQL?style=plastic)](https://github.com/KNOSERO/service_postgreSQL/blob/master/LICENSE)

## Dev
### Jenkins
Jenkins a CI/CD server for automating application build, test, and deployment processes

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/jenkins_service)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Jenkins%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Jenkins%20Service/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/jenkins_service?style=plastic)](https://github.com/KNOSERO/jenkins_service/blob/master/LICENSE)

### Nexus
Nexus Repository an artifact management system for hosting, storing, and distributing packages and Docker images

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/nexus_service)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Nexus%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Nexus%20Service/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/nexus_service?style=plastic)](https://github.com/KNOSERO/nexus_service/blob/master/LICENSE)

### Sonarqube
SonarQube a tool for code quality analysis, identifying bugs, and detecting security vulnerabilities

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/sonarqube_service)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20SonarQube%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20SonarQube%20Service/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/sonarqube_service?style=plastic)](https://github.com/KNOSERO/sonarqube_service/blob/master/LICENSE)

## Infrastructure
### DNS
Pi-hole central DNS for the local network

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/dns_service)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20DNS%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20DNS%20Service/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/dns_service?style=plastic)](https://github.com/KNOSERO/dns_service/blob/master/LICENSE)

### Grafana
Grafana graphical panel for visualizing, analyzing, and monitoring metrics from systems and applications.

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/grafana_service)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Grafana%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Grafana%20Service/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/grafana_service?style=plastic)](https://github.com/KNOSERO/grafana_service/blob/master/LICENSE)

### Portainer
Portainer graphical panel enabling control and monitoring of Docker Swarm and Kubernetes clusters.

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/portainer_service)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Portainer%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Portainer%20Service/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/portainer_service?style=plastic)](https://github.com/KNOSERO/portainer_services/blob/master/LICENSE)

### Prometheus
Prometheus tool for monitoring and collecting system and application metrics

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/prometheus_service)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Prometheus%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Prometheus%20Service/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/prometheus_service?style=plastic)](https://github.com/KNOSERO/prometheus_service/blob/master/LICENSE)

### Proxy
Deployment of Nginx with a management interface

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/proxy_service)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Proxy%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Proxy%20Service/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/proxy_service?style=plastic)](https://github.com/KNOSERO/proxy_service/blob/master/LICENSE)

### VPN
Vanguard VPN a solution providing secure and encrypted connections to the local network and remote access.

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/vpn_service)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20VPN%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20VPN%20Service/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/vpn_service?style=plastic)](https://github.com/KNOSERO/vpn_service/blob/master/LICENSE)

## Template
### Docker
Application deployment template for docker

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/template_service_docker)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Template%20Service%20Docker&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Template%20Service%20Docker/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/template_service_docker?style=plastic)](https://github.com/KNOSERO/template_service_docker/blob/master/LICENSE)

### Kubernetes
Application deployment template for k3s

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/template_service_k3s)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Template%20Service%20K3s&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Template%20Service%20K3s/lastBuild/pipeline-overview/)
[![License](https://img.shields.io/github/license/KNOSERO/template_service_k3s?style=plastic)](https://github.com/KNOSERO/template_service_k3s/blob/master/LICENSE)

## Services control panel

Run the local Podman controller from the repository root:

```bash
podman compose -f docker/panel/compose.yml up -d --build
```

Open `http://127.0.0.1:6868`. Target profiles and saved service settings live in
the ignored `.config/` directory. Secret files remain under `secrets/` and are
mounted read-only. The panel binds to localhost in Podman mode.

The Next.js application lives in `web/`. Install dependencies and start its
development server from the repository root with `npm --prefix web ci` and
`npm --prefix web run dev`.

The K3s chart is in `services/panel/helm`; its service is ClusterIP and its
Ingress is disabled by default. `admin.ravcube.com` is prepared as the future
Ingress host. The deployment Jenkinsfile follows the existing K3s credential
IDs and removes its temporary kubeconfig after the install.

The K3s Jenkins job builds and publishes the panel image before installing it, then creates the ghcr-pull Kubernetes Secret. Configure a Jenkins username/password credential named ghcr-package with permission to publish and pull the GHCR package.

The K3s job creates `services-panel-target-secrets` from `jenkins-k3s`, `jenkins-k3s-ca-cert`, and Jenkins Secret file credentials `panel-docker-ssh-key` (private key) and `panel-docker-known-hosts` (pinned host keys). These target credentials are mounted separately from application secrets. Create `services-panel-secrets` with the application secret files you use; the Jenkins job leaves this Secret untouched:

```bash
kubectl create secret generic services-panel-secrets --namespace services \
  --from-file=postgres_password=secrets/postgres_password \
  --from-file=grafana_password=secrets/grafana_password \
  --from-file=vpn_password_hash=secrets/vpn_password_hash
```

Remove entries for services whose secret files are not present.

Set each K3s target API endpoint in its editable profile.
