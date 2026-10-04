FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ARG HELM_VERSION=3.22.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    openssh-client \
    ca-certificates \
    curl \
    tar \
    && python3 -m pip install --no-cache-dir ansible-core==2.17.14 \
    && case "$(dpkg --print-architecture)" in \
        amd64) HELM_ARCH=amd64; HELM_SHA256=1e4ab49e429626cf6c6958d914248b78c9730803c2751b87627e171dc800e7bb ;; \
        arm64) HELM_ARCH=arm64; HELM_SHA256=0236e2ebea9577799375a236c5e0e98d0eded4b9a3260678e51bfbc9dcca97a1 ;; \
        *) echo "Unsupported architecture for Helm: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac \
    && curl -fsSL "https://get.helm.sh/helm-v${HELM_VERSION}-linux-${HELM_ARCH}.tar.gz" -o /tmp/helm.tar.gz \
    && echo "${HELM_SHA256}  /tmp/helm.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/helm.tar.gz -C /tmp \
    && install "/tmp/linux-${HELM_ARCH}/helm" /usr/local/bin/helm \
    && rm -rf /tmp/helm.tar.gz "/tmp/linux-${HELM_ARCH}" \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/services
COPY docker/services/inventory.ini ./inventory.ini
COPY docker/services/prepare.yml ./prepare.yml
COPY docker/services/entrypoint.sh /usr/local/bin/services-installer
COPY infrastructure/dns ./infrastructure/dns
COPY infrastructure/proxy ./infrastructure/proxy
COPY infrastructure/portainer ./infrastructure/portainer
COPY dev/jenkins ./dev/jenkins

RUN sed -i 's/\r$//' /usr/local/bin/services-installer \
    && chmod +x /usr/local/bin/services-installer

ENTRYPOINT ["/usr/local/bin/services-installer"]
