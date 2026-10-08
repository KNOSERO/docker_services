# Helm

[![Build Status](https://jenkins.ravcube.com/buildStatus/icon?job=PR%20Public/PR%20Helm%20Pack&style=plastic)](https://jenkins.ravcube.com/job/PR%20Public/job/PR%20Helm%20Pack/lastBuild/pipeline-overview/)
[![Helm Version](https://img.shields.io/badge/helm-v3-blue?logo=helm&style=plastic)](https://helm.sh/)
[![Kubernetes](https://img.shields.io/badge/kubernetes-K3s-orange?logo=kubernetes&style=plastic)](https://k3s.io/)
[![License](https://img.shields.io/github/license/KNOSERO/template_service_k3s?style=plastic)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Image-blue?logo=docker&style=plastic)](https://hub.docker.com/_/hello-world)

## Install Helm Linux (Ubuntu/Debian)

```console
curl https://baltocdn.com/helm/signing.asc | sudo apt-key add -
sudo apt-get install apt-transport-https --yes
echo "deb https://baltocdn.com/helm/stable/debian/ all main" | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list
sudo apt-get update
sudo apt-get install helm
```