# Audyt wsparcia Docker i K3s dla dziesięciu usług

Research ticket: [Audyt wsparcia Docker i K3s dla dziesięciu usług](https://github.com/KNOSERO/docker_services/issues/23).

Stan wynika z obecnych plików w checkoutcie. „Gotowe” oznacza, że istnieją artefakty wdrożeniowe dla danej platformy; nie potwierdza działania wdrożenia na żywo.

| Usługa | Docker | K3s | Wymagane zmiany, blokery i potrzebne dane panelu |
|---|---|---|---|
| PostgreSQL | **Brak Compose** | **Helm i config istnieją**: [config](../../database/postgreSQL/config.yml), [chart](../../database/postgreSQL/helm/Chart.yaml), [deployment](../../database/postgreSQL/helm/templates/deployment.yml) | Dodać definicję Docker. Przenieść parametry bazy do edytowalnej konfiguracji i wczytywać hasło z obecnego źródła sekretów zamiast używać wartości wpisanej w `config.yml`. Panel potrzebuje obrazu, portu, zmiennych środowiskowych, wolumenu i pliku [postgresql.conf](../../database/postgreSQL/config/postgresql.conf). |
| Jenkins | **Brak Compose** | **Helm i config istnieją**: [config](../../dev/jenkins/config.yml), [chart](../../dev/jenkins/helm/Chart.yaml), [deployment](../../dev/jenkins/helm/templates/deployment.yml) | Dodać definicję Docker. Zachować Jenkins Home i porty `8080`, `50000`. Panel potrzebuje obrazu, portów, TZ, ścieżki danych i domeny ingress. |
| Nexus | **Brak Compose** | **Helm i config istnieją**: [config](../../dev/nexus/config.yml), [chart](../../dev/nexus/helm/Chart.yaml), [deployment](../../dev/nexus/helm/templates/deployment.yml) | Dodać definicję Docker. Panel potrzebuje obrazu, portów `8081` i `5000`, użytkownika procesu, wolumenu danych i domeny ingress. |
| SonarQube | **Brak Compose** | **Chart istnieje, ale config jest placeholderem**: [config](../../dev/sonarqube/config.yml), [chart](../../dev/sonarqube/helm/Chart.yaml), [deployment](../../dev/sonarqube/helm/templates/deployment.yml) | Zastąpić `hello-world` rzeczywistą konfiguracją SonarQube; obecny wpis nie wdraża SonarQube. Następnie dodać Compose. Panel potrzebuje właściwego obrazu, portów, zmiennych, danych trwałych i zależności wybranej konfiguracji. |
| Grafana | **Brak Compose** | **Helm i config istnieją**: [config](../../infrastructure/grafana/config.yml), [chart](../../infrastructure/grafana/helm/Chart.yaml), [deployment](../../infrastructure/grafana/helm/templates/deployment.yml) | Dodać definicję Docker. Uwzględnić wolumen danych i [grafana.ini](../../infrastructure/grafana/config/grafana.ini). Panel potrzebuje obrazu, portu `3000`, konfiguracji, ścieżek hosta i domen ingress. |
| Prometheus | **Brak Compose** | **Helm i config istnieją**: [config](../../infrastructure/prometheus/config.yml), [chart](../../infrastructure/prometheus/helm/Chart.yaml), [deployment](../../infrastructure/prometheus/helm/templates/deployment.yml) | Dodać definicję Docker. Panel potrzebuje portu `9090`, wolumenu, [prometheus.yml](../../infrastructure/prometheus/config/prometheus.yml) i domen ingress. |
| DNS (Pi-hole) | **Compose i playbook Ansible istnieją**: [Compose](../../infrastructure/dns/docker-compose.yml), [playbook](../../infrastructure/dns/playbook.yml) | **Brak Helm/K3s** | Dodać konfigurację K3s. Zachować porty DNS `53/tcp` i `53/udp`, `67/udp`, port UI, wolumeny i zależność od sieci `dns`. |
| Portainer | **Compose i playbook Ansible istnieją**: [Compose](../../infrastructure/portainer/docker-compose.yml), [playbook](../../infrastructure/portainer/playbook.yml) | **Brak Helm/K3s** | Dodać konfigurację K3s. Montowanie `/var/run/docker.sock` wiąże usługę z Docker Engine; trzeba określić docelowy socket/runtime. Panel potrzebuje portu `9000`, wolumenu danych i ustawienia socketu. |
| Proxy (Nginx Proxy Manager) | **Compose i playbook Ansible istnieją**: [Compose](../../infrastructure/proxy/docker-compose.yml), [playbook](../../infrastructure/proxy/playbook.yml) | **Brak Helm/K3s** | Dodać konfigurację K3s. Zachować porty `80`, `443`, `81`, dane i certyfikaty oraz ustawienia DNS i sieci zewnętrznej. Panel potrzebuje mapowania portów, wolumenów, sieci i DNS. |
| VPN (wg-easy) | **Compose i playbook Ansible istnieją**: [Compose](../../infrastructure/vpn/docker-compose.yml), [playbook](../../infrastructure/vpn/playbook.yml) | **Brak Helm/K3s** | Dodać konfigurację K3s z wymaganymi uprawnieniami sieciowymi. Panel potrzebuje portów UDP/TCP, `WG_HOST`, podsieci, DNS, katalogu trwałych danych i hasła z obecnego źródła sekretów. |

## Co to oznacza dla panelu

Obecne repo ma 10 usług: 6 z artefaktami Helm/K3s i 4 z Compose. Żadna nie ma dziś obu wariantów. [Szablon K3s](../../template/k3s/config.yml) i [szablon Docker](../../template/docker/docker-compose.yml) mogą być punktem odniesienia.

Wspólny Docker playbook kopiuje katalog na host i uruchamia `docker compose pull` oraz `up`; wzorcem jest [playbook Docker dla DNS](../../infrastructure/dns/docker/playbook.yml). Walidator [validate_docker.sh](../../infrastructure/dns/docker/validate_docker.sh) sprawdza składnię Compose. Pipeline’y K3s używają `helm lint`, `helm template` i `helm upgrade --install`; przykładem jest [pipeline Jenkins](../../dev/jenkins/ci/deploy/Jenkinsfile).

Panel potrzebuje edytowalnych definicji dla obu platform oraz danych o celach, portach, wolumenach, sieciach, plikach konfiguracyjnych i zmiennych środowiskowych. Sekrety powinny być rozwiązywane przez backend z obecnego źródła, bez zapisywania ich jawnie w konfiguracji formularza.

Główne braki to 6 konfiguracji Docker, 4 konfiguracje K3s, placeholder SonarQube oraz różne wymagania runtime: socket Portainera, sieci Pi-hole/proxy i uprawnienia VPN.

## Zakres i ograniczenia

To statyczny audyt plików. Nie sprawdzałem działających wdrożeń, poprawności wszystkich chartów ani zgodności z docelową wersją Podmana/K3s. Przy migracji trzeba szczególnie chronić dane trwałe i zachować specjalne wymagania sieciowe oraz uprawnienia usług.