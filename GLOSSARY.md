# Services Control Panel

This context describes how the panel manages services on Docker hosts and K3s clusters.

## Deployment

**Target profile**:
A saved Docker host or K3s cluster that services can be deployed to.
_Avoid_: environment, server config

**Deployment configuration**:
The saved settings for one service on one backend and one target profile.
_Avoid_: global service configuration

**Deployment backend**:
The runtime selected for a deployment: Docker or K3s.
_Avoid_: platform

**Shared service defaults**:
The maintainer-defined starting values for a service's common deployment settings, used by both supported backends.
_Avoid_: duplicated backend defaults

**Target override**:
Operator-saved changes for one service, deployment backend, and target profile.
_Avoid_: global override
