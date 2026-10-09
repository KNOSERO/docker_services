# Prometheus PVE Exporter – Systemd Setup (Python Virtualenv)

Ten przewodnik opisuje kompletną instalację i uruchomienie `prometheus-pve-exporter` jako usługi systemowej na systemie Ubuntu z wykorzystaniem środowiska wirtualnego Pythona (`venv`) i `systemd`. Działa dla instalacji lokalnych bez Dockera.

---

## ✅ Krok 1: Instalacja eksportera w środowisku wirtualnym

```bash
python3 -m venv ~/pve-exporter/venv && \
source ~/pve-exporter/venv/bin/activate && \
pip install prometheus-pve-exporter
```

---

## 🛠️ Krok 2: Konfiguracja eksportera

Utwórz plik konfiguracyjny:

```bash
nano ~/pve-exporter/config.yaml
```

Zawartość pliku:

```yaml
default:
  user: "prometheus@pve"
  token_name: "exporter"
  token_value: "..."
  verify_ssl: false
```

> 🔐 Upewnij się, że token został utworzony w Proxmox i ma rolę `PVEAuditor` przypisaną do `/`.

---

## ⚙️ Krok 3: Utworzenie usługi systemowej

Utwórz plik:

```bash
sudo nano /etc/systemd/system/pve-exporter.service
```

Zawartość pliku:

```ini
[Unit]
Description=Proxmox Exporter for Prometheus
After=network.target

[Service]
User=rav
WorkingDirectory=/home/rav/pve-exporter
ExecStart=/home/rav/pve-exporter/venv/bin/pve_exporter --config.file=/home/rav/pve-exporter/config.yaml
Restart=always

[Install]
WantedBy=multi-user.target
```

> ✉️ Zmień `User=` i ścieżki na zgodne z Twoim systemem użytkownika.

---

## 🚀 Krok 4: Uruchomienie usługi

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pve-exporter
```

---

## 🔍 Sprawdzenie działania

Status usługi:

```bash
sudo systemctl status pve-exporter
```

Podgląd logów:

```bash
journalctl -u pve-exporter -f
```

Sprawdzenie metryk:

```bash
curl http://localhost:9221/metrics
```

---

## 📊 Konfiguracja w Prometheus

W pliku `prometheus.yml` dodaj:

```yaml
- job_name: 'pve'
  static_configs:
    - targets: ['192.168.0.4:9221']
```

---

## ✅ Gotowe!

Eksporter będzie automatycznie uruchamiał się przy starcie systemu i udostępniał metryki z Twojego klastra Proxmox do Prometheusa.
