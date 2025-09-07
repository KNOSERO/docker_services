# Docker Services
A repository with configuration files for Docker and Kubernetes-based services.

## Config

```ini
[HOST]
{{SERWER}} ansible_host=={{IP}} ansible_user={{USER}} ansible_ssh_private_key_file=~/.ssh/id_home_lab
...

[HOME_SERWER]
...

[PRIMAL_SERWER]
...

[K3S]
...

```

## Subproject
### Kubernetes
##### Prometheus
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/prometheus_service)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Prometheus%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Prometheus%20Service/lastBuild/pipeline-overview/)

##### Grafana
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/grafana_service)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Grafana%20Service&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Grafana%20Service/lastBuild/pipeline-overview/)

##### Postgresql
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/service_postgreSQL)

##### Sonarqube
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/sonarqube_service)

### Template
##### Kubernetes
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github&style=plastic)](https://github.com/KNOSERO/template_service_k3s)
[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Template%20Service%20K3s&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Template%20Service%20K3s/lastBuild/pipeline-overview/)
