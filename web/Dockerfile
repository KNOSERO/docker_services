FROM node:24-bookworm-slim
ARG HELM_VERSION=3.22.0
ARG KUBECTL_VERSION=1.37.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ansible-core ca-certificates curl openssh-client python3 tar \
    && rm -rf /var/lib/apt/lists/* \
    && case "$(dpkg --print-architecture)" in \
        amd64) HELM_ARCH=amd64; HELM_SHA256=1e4ab49e429626cf6c6958d914248b78c9730803c2751b87627e171dc800e7bb ;; \
        arm64) HELM_ARCH=arm64; HELM_SHA256=0236e2ebea9577799375a236c5e0e98d0eded4b9a3260678e51bfbc9dcca97a1 ;; \
        *) echo "Unsupported Helm architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac \
    && curl -fsSL "https://get.helm.sh/helm-v${HELM_VERSION}-linux-${HELM_ARCH}.tar.gz" -o /tmp/helm.tar.gz \
    && echo "${HELM_SHA256}  /tmp/helm.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/helm.tar.gz -C /tmp \
    && install "/tmp/linux-${HELM_ARCH}/helm" /usr/local/bin/helm \
    && rm -rf /tmp/helm.tar.gz "/tmp/linux-${HELM_ARCH}" \
    && case "$(dpkg --print-architecture)" in \
        amd64) KUBECTL_ARCH=amd64 ;; \
        arm64) KUBECTL_ARCH=arm64 ;; \
        *) echo "Unsupported kubectl architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac \
    && curl -fsSL "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/${KUBECTL_ARCH}/kubectl" -o /tmp/kubectl \
    && curl -fsSL "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/${KUBECTL_ARCH}/kubectl.sha256" -o /tmp/kubectl.sha256 \
    && echo "$(cat /tmp/kubectl.sha256)  /tmp/kubectl" | sha256sum -c - \
    && install /tmp/kubectl /usr/local/bin/kubectl \
    && rm -f /tmp/kubectl /tmp/kubectl.sha256

WORKDIR /app
COPY web/package.json web/package-lock.json /app/web/
WORKDIR /app/web
RUN npm ci --no-audit --no-fund
COPY web /app/web
RUN npm run build
WORKDIR /app
COPY services /app/services
COPY templates/docker /app/templates/docker
ENV NODE_ENV=production PORT=6868 PANEL_BIND_HOST=0.0.0.0 PANEL_SECRETS_DIR=/app/secrets
EXPOSE 6868
CMD ["node", "/app/web/server.js"]
