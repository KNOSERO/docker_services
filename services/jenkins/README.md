# Jenkins Service

Jenkins runs on K3s and is deployed with Helm.

[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Jenkins%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Jenkins%20Service/lastBuild/pipeline-overview/)
[![K3s](https://img.shields.io/badge/K3s-Helm-blue?logo=kubernetes&style=plastic)](https://k3s.io/)
[![License](https://img.shields.io/github/license/KNOSERO/jenkins_service?style=plastic)](LICENSE)

## Runtime configuration

- Jenkins image: `jenkins/jenkins:lts-jdk17`
- Web UI: `https://jenkins.ravcube.com` on port `8080`
- Inbound agent service: port `50000` inside the cluster
- Jenkins home: K3s host path `/mnt/core_data/docker/jenkins_home`, mounted at `/var/jenkins_home`
- Time zone: `Europe/Warsaw`

The pod runs as root to match the existing Jenkins runtime and access its mounted data directory. Kubernetes manages the pod lifecycle, and the existing host path keeps Jenkins state outside the pod.

## Deployment

The CI pipeline validates the Helm chart. The deploy pipeline installs or upgrades the `jenkins` release using `config.yml`.
