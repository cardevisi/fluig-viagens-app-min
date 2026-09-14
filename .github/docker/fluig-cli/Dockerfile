FROM node:22-bookworm-slim

WORKDIR /workspace

ARG TARGETARCH

COPY .tools/fluig-studio-cli-v0.1.0/standalone /tmp/fluig-standalone

RUN case "${TARGETARCH}" in \
    "amd64") cp /tmp/fluig-standalone/fluig-cli-linux-x64 /usr/local/bin/fluig ;; \
    "arm64") cp /tmp/fluig-standalone/fluig-cli-linux-arm64 /usr/local/bin/fluig ;; \
    *) echo "Arquitetura sem binario local: ${TARGETARCH}" && exit 1 ;; \
  esac \
  && chmod +x /usr/local/bin/fluig

CMD ["node", ".github/scripts/fluig-resource-deploy.mjs"]
