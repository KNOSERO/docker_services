# Prometheus Node Exporter Setup (Binary + Systemd)

Ten przewodnik opisuje instalację eksportera systemowego Prometheus `node-exporter` jako usługi systemowej na systemie Ubuntu.

---

## ✅ Instalacja Node Exportera

### Krok 1: Pobranie i instalacja binarki

```bash
cd /tmp && \
curl -LO https://github.com/prometheus/node_exporter/releases/download/v1.8.1/node_exporter-1.8.1.linux-arm64.tar.gz && \
tar -xzf node_exporter-1.8.1.linux-arm64.tar.gz && \
sudo mv node_exporter-1.8.1.linux-arm64/node_exporter /usr/local/bin/ && \
sudo chmod +x /usr/local/bin/node_exporter && \
sudo chown root:root /usr/local/bin/node_exporter
```

### Krok 2: Utworzenie usługi `systemd`

```bash
sudo nano /etc/systemd/system/node-exporter.service
```

Zawartość pliku:

```ini
[Unit]
Description=Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=nobody
ExecStart=/usr/local/bin/node_exporter
Restart=always

[Install]
WantedBy=multi-user.target
```

> 🛡️ Użytkownik `nobody` jest domyślnie używany – można go zmienić w zależności od potrzeb bezpieczeństwa.

### Krok 3: Uruchomienie i weryfikacja

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now node-exporter
systemctl status node-exporter
```

### Krok 4: Weryfikacja działania

```bash
curl http://localhost:9100/metrics
```

---

## 📊 Konfiguracja w Prometheus

Dodaj do pliku `prometheus.yml`:

```yaml
- job_name: 'node'
  static_configs:
    - targets: ['192.168.0.4:9100']
```

---

## ✅ Gotowe

`node-exporter` działa jako usługa systemowa i będzie automatycznie uruchamiany przy starcie systemu.
