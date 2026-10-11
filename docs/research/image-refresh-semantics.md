# Odświeżanie obrazu przed wdrożeniem

Issue: [#45](https://github.com/KNOSERO/docker_services/issues/45)

## Wnioski

- **Docker Compose:** obecny playbook już pobiera obraz przed uruchomieniem usługi i wymusza odtworzenie kontenera. `docker compose pull` pobiera obraz dla skonfigurowanego tagu, a `docker compose up --force-recreate` odtwarza kontener. Jawne `--policy always` może wyrazić zamiar aktualizowania obrazu za każdym razem, ale należy potwierdzić dostępność flagi w wersji Compose wspieranej przez projekt.
- **K3s:** wartości Helm ustawiają obecnie `imagePullPolicy: IfNotPresent`. Przy ponownym użyciu tego samego tagu kubelet może wykorzystać lokalny obraz. Zmiana polityki na `Always` powoduje sprawdzenie obrazu przy starcie poda. Aby wdrożenie utworzyło nowe pody, aktualizacja musi też zmienić szablon poda (np. adnotację z identyfikatorem wykonania).
- **Jedna semantyka procesu:** w obu backendach wykonanie powinno najpierw pobrać wskazany tag obrazu, a potem wymusić wdrożenie/restart workloadu. Błąd pobrania powinien zakończyć wykonanie przed zmianą działającej usługi.

## Stan obecny w repozytorium

- Docker: `templates/docker/playbook.yml` zawiera krok `docker compose pull`, a następnie `docker compose up --detach --force-recreate --remove-orphans`.
- K3s: `web/api.js` tworzy wartości z `pullPolicy: 'IfNotPresent'`; `templates/k3s/helm/templates/deployment.yml` przekazuje je do manifestu; wdrożenie jest wykonywane przez `helm upgrade --install`.

## Rekomendacja do specyfikacji

Zachować pobieranie i wymuszone odtworzenie kontenera dla Docker Compose. Dla K3s ustawić `Always` oraz zmieniać pole w szablonie poda przy każdym wykonaniu (np. adnotację). Doprecyzować minimalną wersję Compose przed dodaniem `--policy always`; bieżący krok pull już spełnia wymagany przepływ.

## Źródła

- [Docker Compose pull](https://docs.docker.com/reference/cli/docker/compose/pull/)
- [Docker Compose up](https://docs.docker.com/reference/cli/docker/compose/up/)
- [Kubernetes: obrazy kontenerów i imagePullPolicy](https://kubernetes.io/docs/concepts/containers/images/)
- [Kubernetes: aktualizacja Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#updating-a-deployment)
- [Helm upgrade](https://helm.sh/docs/helm/helm_upgrade/)
