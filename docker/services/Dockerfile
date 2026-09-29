FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    openssh-client \
    ca-certificates \
    && python3 -m pip install --no-cache-dir ansible-core==2.17.14 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/services
COPY docker/services/inventory.ini ./inventory.ini
COPY docker/services/prepare.yml ./prepare.yml
COPY docker/services/entrypoint.sh /usr/local/bin/services-installer
COPY infrastructure/dns ./infrastructure/dns
COPY infrastructure/proxy ./infrastructure/proxy
COPY infrastructure/portainer ./infrastructure/portainer

RUN sed -i 's/\r$//' /usr/local/bin/services-installer \
    && chmod +x /usr/local/bin/services-installer

ENTRYPOINT ["/usr/local/bin/services-installer"]
