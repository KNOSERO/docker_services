import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { createPanel, deploymentValues, dockerCompose, dockerComposeFromBase, helmValuesForDeployment, serviceDefaults, validateRenderedDeployment } from '../api.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let root;
let server;
let baseUrl;
let deployed;
let validations;
let validationResult;

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'services-panel-'));
  deployed = [];
  validations = [];
  validationResult = { code: 0, output: '' };
  server = createPanel({
    dataDir: root,
    validator: async (job) => {
      validations.push(job);
      return typeof validationResult === 'function' ? validationResult(job) : validationResult;
    },
    adapter: async (job) => {
      deployed.push(job);
      return { code: job.service === 'grafana' ? 1 : 0, output: job.service === 'grafana' ? 'deployment failed' : 'deployment complete' };
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
});

const request = async (url, options) => {
  const response = await fetch(`${baseUrl}${url}`, options);
  return { status: response.status, body: await response.json() };
};

const saveTarget = async (target) => request('/api/targets', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(target),
});

test('panel API exposes its managed services', async () => {
  const state = (await request('/api/state')).body;
  assert.equal(state.services.length, 10);
  assert.deepEqual(state.backends, ['docker', 'k3s']);
});

test('panel rejects cross-origin browser requests', async () => {
  const badOrigin = await fetch(`${baseUrl}/api/state`, { headers: { origin: 'https://admin.example' } });
  assert.equal(badOrigin.status, 403);
});

test('saving a deployment configuration persists it without creating a job', async () => {
  const saved = await request('/api/configurations/postgresql/docker/local', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ port: '5433' }),
  });

  assert.equal(saved.status, 200);
  assert.equal(saved.body.configuration.port, '5433');
  assert.equal('configContents' in saved.body.configuration, false);
  assert.equal('password' in saved.body.configuration, false);
  assert.equal((await request('/api/jobs')).body.length, 0);
  assert.match(await readFile(path.join(root, 'services', 'postgresql', 'docker', 'local.yml'), 'utf8'), /5433/);
  assert.doesNotMatch(await readFile(path.join(root, 'services', 'postgresql', 'docker', 'local.yml'), 'utf8'), /real-secret-value/);
});

test('panel configuration defaults come from the tracked service catalog', async () => {
  const response = await request('/api/configurations/postgresql/docker/catalog-check');
  assert.equal(response.status, 200);
  assert.equal(response.body.configuration.image, 'postgres:16');
  assert.equal(response.body.configuration.port, '5432');
  assert.equal(response.body.configuration.dataPath, '/mnt/core_data/postgresql');
  const state = (await request('/api/state')).body;
  const proxy = state.services.find(({ id }) => id === 'proxy');
  assert.equal(proxy.fields.find(([key]) => key === 'network'), undefined);
});

test('service forms expose only the agreed common fields with typed ports', async () => {
  const state = (await request('/api/state')).body;
  const field = (serviceId, key) => state.services.find(({ id }) => id === serviceId).fields.find(([name]) => name === key);

  assert.equal(field('postgresql', 'image')[4], 'text');
  assert.equal(field('postgresql', 'port')[4], 'number');
  assert.equal(field('postgresql', 'database')[4], 'text');
  assert.equal(field('postgresql', 'username')[4], 'text');
  assert.equal(field('postgresql', 'dataPath')[4], 'text');
  assert.equal(field('postgresql', 'configFile')[4], 'text');
  assert.equal(field('postgresql', 'configMountPath')[2], '/etc/postgresql/postgresql.conf');
  assert.equal(field('grafana', 'configMountPath')[2], '/etc/grafana/grafana.ini');
  assert.equal(field('prometheus', 'configMountPath')[2], '/etc/prometheus/prometheus.yml');
  for (const key of ['passwordSecret', 'configContents', 'network', 'dockerSocket', 'ingressHost', 'ingressEnabled']) {
    assert.equal(field('postgresql', key), undefined, `postgresql form must not expose ${key}`);
  }
  assert.equal(field('proxy', 'network'), undefined);
  assert.equal(field('portainer', 'dockerSocket'), undefined);
  assert.equal(field('vpn', 'passwordHashSecret'), undefined);
  assert.equal(field('dns', 'webPort')[4], 'number');
});

test('Docker preflight validates VPN Compose without resolving target-side env files', async () => {
  let invocation;
  const result = await validateRenderedDeployment({ service: 'vpn', backend: 'docker', configuration: serviceDefaults('vpn') }, async (program, args) => {
    invocation = { program, args };
    return { code: 0, output: '' };
  });

  assert.equal(invocation.program, 'docker');
  assert.deepEqual(invocation.args.slice(0, 2), ['compose', '-f']);
  assert.equal(invocation.args[3], 'config');
  assert.ok(invocation.args.includes('--no-env-resolution'));
  assert.equal(invocation.args.at(-1), '-q');
  assert.deepEqual(result.compose.services.vpn.env_file, ['/opt/docker-secrets/vpn/password_hash.env']);
});

test('configuration mount destinations can be edited and must remain safe absolute container paths', async () => {
  const saved = await request('/api/configurations/postgresql/docker/mount-target', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ configMountPath: '/custom/postgresql.conf' }),
  });
  assert.equal(saved.status, 200);
  assert.equal((await request('/api/configurations/postgresql/docker/mount-target')).body.configuration.configMountPath, '/custom/postgresql.conf');

  for (const configMountPath of ['', 'relative/postgresql.conf', '/', '/etc/../secrets/postgresql.conf', '/etc/postgresql:conf']) {
    const invalid = await request('/api/configurations/postgresql/docker/mount-target', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ configMountPath }),
    });
    assert.equal(invalid.status, 400, `must reject ${configMountPath}`);
  }
});

test('saving visible fields preserves hidden legacy target overrides', async () => {
  const configFile = path.join(root, 'services', 'proxy', 'docker', 'hidden-state.yml');
  await mkdir(path.dirname(configFile), { recursive: true });
  await writeFile(configFile, JSON.stringify({ schemaVersion: 2, overrides: { httpPort: '80', network: 'legacy-network' } }));

  const hiddenInput = await request('/api/configurations/proxy/docker/hidden-state', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ network: 'replacement-network' }),
  });
  assert.equal(hiddenInput.status, 400);

  const saved = await request('/api/configurations/proxy/docker/hidden-state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: 'jc21/nginx-proxy-manager:latest', httpPort: '8080', httpsPort: '8443', adminPort: '8181', dataPath: '/srv/proxy', dnsServers: '192.168.0.2' }),
  });

  assert.equal(saved.status, 200);
  assert.equal('network' in saved.body.configuration, false);
  assert.deepEqual(JSON.parse(await readFile(configFile, 'utf8')).overrides, {
    httpPort: '8080', network: 'legacy-network',
    image: 'jc21/nginx-proxy-manager:latest', httpsPort: '8443', adminPort: '8181', dataPath: '/srv/proxy', dnsServers: '192.168.0.2',
  });
});

test('legacy target configuration migrates once and remains recoverable', async () => {
  const legacyPath = path.join(root, 'services', 'postgresql', 'docker', 'legacy-target.yml');
  const legacy = '{"port":"5544","username":"legacy-user","passwordSecret":"legacy-password-file","configContents":"legacy app config"}\n';
  await mkdir(path.dirname(legacyPath), { recursive: true });
  await writeFile(legacyPath, legacy);

  const migrated = await request('/api/configurations/postgresql/docker/legacy-target');
  assert.equal(migrated.status, 200);
  assert.equal(migrated.body.configuration.image, 'postgres:16');
  assert.equal(migrated.body.configuration.port, '5544');
  assert.equal('configContents' in migrated.body.configuration, false);
  assert.equal('passwordSecret' in migrated.body.configuration, false);
  assert.deepEqual(JSON.parse(await readFile(legacyPath, 'utf8')), {
    schemaVersion: 2,
    overrides: { port: '5544', username: 'legacy-user', passwordSecret: 'legacy-password-file' },
  });
  assert.equal(await readFile(`${legacyPath}.legacy`, 'utf8'), legacy);

  const migratedFile = await readFile(legacyPath, 'utf8');
  const again = await request('/api/configurations/postgresql/docker/legacy-target');
  assert.equal(again.body.configuration.port, '5544');
  assert.equal(await readFile(legacyPath, 'utf8'), migratedFile);
  assert.equal(await readFile(`${legacyPath}.legacy`, 'utf8'), legacy);
  assert.equal((await request('/api/configurations/postgresql/k3s/legacy-target')).body.configuration.port, '5432');
});

test('target profiles store secret references but never raw credential fields', async () => {
  const saved = await saveTarget({ id: 'safe-host', name: 'Safe host', backend: 'docker', host: '192.168.0.30', user: 'deploy', keySecret: 'id_home_lab', password: 'do-not-store-this' });
  assert.equal(saved.status, 200);
  assert.equal('password' in saved.body.target, false);
  const targetFile = await readFile(path.join(root, 'targets.yml'), 'utf8');
  assert.match(targetFile, /id_home_lab/);
  assert.doesNotMatch(targetFile, /do-not-store-this/);
});

test('invalid or cross-backend configurations are rejected before a job is created', async () => {
  await saveTarget({ id: 'local', name: 'Local Docker', backend: 'docker', host: '192.0.2.11', user: 'deploy', keySecret: 'id_home_lab' });
  const invalid = await request('/api/configurations/postgresql/docker/local', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ port: '65536' }),
  });
  assert.equal(invalid.status, 400);
  await request('/api/configurations/postgresql/k3s/local', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ port: '5432' }),
  });
  const mismatch = await request('/api/deployments', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ service: 'postgresql', backend: 'k3s', targetId: 'local' }),
  });
  assert.equal(mismatch.status, 400);
  assert.equal((await request('/api/jobs')).body.length, 0);
});

test('render validation failure returns a useful error and creates no job', async () => {
  await saveTarget({ id: 'preflight-host', name: 'Preflight host', backend: 'docker', host: '192.0.2.12', user: 'deploy', keySecret: 'id_home_lab' });
  await request('/api/configurations/sonarqube/docker/preflight-host', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ port: '9000' }),
  });
  const jobsBefore = (await request('/api/jobs')).body.length;
  const deploysBefore = deployed.length;
  validationResult = { code: 1, output: 'services.sonarqube.ports must be a list' };

  const response = await request('/api/deployments', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ service: 'sonarqube', backend: 'docker', targetId: 'preflight-host' }),
  });

  assert.equal(response.status, 422);
  assert.match(response.body.error, /Compose validation failed/);
  assert.match(response.body.error, /ports must be a list/);
  assert.deepEqual(
    { service: validations.at(-1).service, backend: validations.at(-1).backend, targetId: validations.at(-1).targetId, port: validations.at(-1).configuration.port },
    { service: 'sonarqube', backend: 'docker', targetId: 'preflight-host', port: '9000' },
  );
  assert.equal((await request('/api/jobs')).body.length, jobsBefore);
  assert.equal(deployed.length, deploysBefore);
  validationResult = { code: 0, output: '' };
});

test('legacy hidden backend overrides are retained but excluded from rendered deployment input', async () => {
  await saveTarget({ id: 'legacy-docker', name: 'Legacy Docker', backend: 'docker', host: '192.0.2.13', user: 'deploy', keySecret: 'id_home_lab' });
  const legacyPath = path.join(root, 'services', 'proxy', 'docker', 'legacy-docker.yml');
  const legacy = { schemaVersion: 2, overrides: { httpPort: '8080', network: 'untrusted-network' } };
  await mkdir(path.dirname(legacyPath), { recursive: true });
  await writeFile(legacyPath, JSON.stringify(legacy));
  validationResult = async (job) => ({ compose: await dockerComposeFromBase(job.service, job.configuration) });

  const response = await request('/api/deployments', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ service: 'proxy', backend: 'docker', targetId: 'legacy-docker' }),
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(response.status, 202);
  assert.equal('network' in validations.at(-1).configuration, false);
  assert.deepEqual(deployed.at(-1).rendered.compose.services.proxy.networks, ['proxy']);
  assert.deepEqual(deployed.at(-1).rendered.compose.networks.proxy, { external: true });
  assert.deepEqual(JSON.parse(await readFile(legacyPath, 'utf8')), legacy);
  validationResult = { code: 0, output: '' };
});

test('every managed service has Docker and K3s deployment definitions', async () => {
  const state = (await request('/api/state')).body;
  assert.equal(state.services.length, 10);
  for (const service of state.services) {
    const serviceRoot = path.join(projectRoot, 'services', service.id);
    const defaults = parse(await readFile(path.join(serviceRoot, 'service-defaults.yml'), 'utf8'));
    assert.deepEqual(Object.keys(defaults), ['common'], `${service.id} defaults must not duplicate backend settings`);
    assert.ok(defaults.common.image, `${service.id} must define its shared image default`);
    for (const [key, , fallback, backend] of service.fields) {
      assert.equal(fallback, defaults.common[key] ?? defaults[backend || 'docker']?.[key] ?? defaults.k3s?.[key] ?? '', `${service.id}.${key} API default must come from its service YAML`);
    }
    const compose = await readFile(path.join(serviceRoot, 'docker-compose.yml'), 'utf8');
    assert.doesNotMatch(compose, /^\*\*\* Add File:/m);
    assert.ok(parse(compose).services[service.id], `${service.id} Compose must parse and define its service`);
    await readFile(path.join(serviceRoot, 'helm', 'Chart.yaml'), 'utf8');
    const helmValues = JSON.parse(await readFile(path.join(serviceRoot, 'helm', 'values.yaml'), 'utf8'));
    assert.equal(helmValues.name, service.id);
    assert.notEqual(helmValues.image.repository, 'hello-world');
  }
  const vpn = state.services.find(({ id }) => id === 'vpn');
  assert.equal(vpn.fields.some(([key]) => key === 'passwordHashSecret'), false);
  assert.ok(vpn.fields.some(([key]) => key === 'allowedIPs'));
  const postgresql = state.services.find(({ id }) => id === 'postgresql');
  assert.ok(postgresql.fields.some(([key]) => key === 'configFile'));
  const sonarqube = await readFile(path.join(projectRoot, 'services', 'sonarqube', 'config.yml'), 'utf8');
  assert.match(sonarqube, /repository: sonarqube/);
  assert.doesNotMatch(sonarqube, /hello-world/);
  const postgres = await readFile(path.join(projectRoot, 'services', 'postgresql', 'config.yml'), 'utf8');
  assert.match(postgres, /POSTGRES_PASSWORD_FILE/);
  assert.doesNotMatch(postgres, /mypassword/);
});

test('K3s installation mounts the credentials used by the panel', async () => {
  const pipeline = await readFile(path.join(projectRoot, 'services/panel/ci/deploy/Jenkinsfile'), 'utf8');
  const deployment = await readFile(path.join(projectRoot, 'services/panel/helm/templates/deployment.yaml'), 'utf8');
  const values = await readFile(path.join(projectRoot, 'services/panel/helm/values.yaml'), 'utf8');
  assert.match(pipeline, /create secret generic services-panel-target-secrets/);
  assert.doesNotMatch(pipeline, /create secret generic services-panel-secrets/);
  assert.match(pipeline, /--from-file=k3s-token=/);
  assert.match(pipeline, /--from-file=k3s-ca\.crt=/);
  assert.match(pipeline, /credentialsId: 'panel-docker-ssh-key'/);
  assert.match(pipeline, /credentialsId: 'panel-docker-known-hosts'/);
  assert.match(pipeline, /--from-file=id_home_lab=/);
  assert.match(pipeline, /--from-file=known_hosts=/);
  assert.match(deployment, /secretName: \{\{ \.Values\.secrets\.name \}\}[\s\S]*optional: true/);
  assert.match(deployment, /secretName: \{\{ \.Values\.targetCredentials\.name \}\}[\s\S]*defaultMode: 0400/);
  assert.match(deployment, /mountPath: \/app\/secrets[\s\S]*mountPath: \/app\/target-secrets/);
  assert.match(values, /targetCredentials:\s+name: services-panel-target-secrets/);
});

test('backend adapters preserve service-specific settings and secret handling', async () => {
  const dockerVpn = dockerCompose('vpn', serviceDefaults('vpn')).services.vpn;
  assert.equal(dockerVpn.image, 'ghcr.io/wg-easy/wg-easy:latest');
  assert.deepEqual(dockerVpn.ports, ['51820:51820/udp', '83:51821/tcp']);
  assert.deepEqual(dockerVpn.env_file, ['/opt/docker-secrets/vpn/password_hash.env']);
  assert.equal(dockerVpn.sysctls['net.ipv4.ip_forward'], '1');

  const k3sVpn = deploymentValues('vpn', serviceDefaults('vpn'));
  assert.equal(k3sVpn.hostNetwork, true);
  assert.equal(k3sVpn.env.find(({ name }) => name === 'PASSWORD_HASH').valueFrom.secretKeyRef.key, 'vpn_password_hash');
  assert.ok(k3sVpn.containerSecurityContext.capabilities.add.includes('NET_ADMIN'));

  const postgresql = deploymentValues('postgresql', serviceDefaults('postgresql'));
  assert.equal(postgresql.env.find(({ name }) => name === 'POSTGRES_PASSWORD_FILE').value, '/run/secrets/postgres_password');
  assert.equal(postgresql.configMounts[0].mountPath, '/etc/postgresql/postgresql.conf');
  assert.equal(deploymentValues('dns', serviceDefaults('dns')).hostNetwork, true);

  const compose = await dockerComposeFromBase('postgresql', { ...serviceDefaults('postgresql'), port: '5433' });
  assert.equal(compose.services.postgresql.container_name, 'postgresql');
  assert.deepEqual(compose.services.postgresql.ports, ['5433:5432']);
  assert.ok(compose.services.postgresql.volumes.some((mount) => mount.endsWith(':/etc/postgresql/postgresql.conf:ro')));
  const customCompose = await dockerComposeFromBase('postgresql', { ...serviceDefaults('postgresql'), configMountPath: '/etc/postgresql/custom.conf' });
  assert.ok(customCompose.services.postgresql.volumes.some((mount) => mount.endsWith(':/etc/postgresql/custom.conf:ro')));
  assert.equal(customCompose.services.postgresql.volumes.some((mount) => mount.endsWith(':/etc/postgresql/postgresql.conf:ro')), false);
  const portainerCompose = await dockerComposeFromBase('portainer', { ...serviceDefaults('portainer', 'docker'), dockerSocket: 'false' });
  assert.ok(portainerCompose.services.portainer.volumes.includes('/var/run/docker.sock:/var/run/docker.sock'));
  assert.equal(serviceDefaults('portainer', 'docker').dockerSocket, undefined);
  assert.equal(serviceDefaults('proxy', 'docker').network, undefined);
  assert.equal(serviceDefaults('dns', 'k3s').ingressHost, undefined);

  const helmValues = await helmValuesForDeployment('grafana', { ...serviceDefaults('grafana', 'k3s'), port: '3333', ingressHost: 'hidden.example', ingressEnabled: 'true' });
  assert.deepEqual(helmValues.ingress.hosts.map(({ domain }) => domain), ['grafana.k3s.ravnet', 'grafana.ravcube.com']);
  assert.equal(helmValues.service.type, 'NodePort');
  assert.equal(helmValues.runAsUser, 0);
  assert.equal(helmValues.servicePorts[0].port, 3333);
  const customHelmValues = await helmValuesForDeployment('grafana', { ...serviceDefaults('grafana', 'k3s'), configMountPath: '/etc/grafana/custom.ini' });
  assert.equal(customHelmValues.configMounts.find(({ name }) => name === 'grafana-config').mountPath, '/etc/grafana/custom.ini');
  const legacyHelmValues = await helmValuesForDeployment('grafana', { port: '3000' });
  assert.equal(legacyHelmValues.configMounts.find(({ name }) => name === 'grafana-config').mountPath, '/etc/grafana/grafana.ini');
  const basePortainerHelmValues = parse(await readFile(path.join(projectRoot, 'services', 'portainer', 'helm', 'values.yaml'), 'utf8'));
  const renderedPortainerHelmValues = await helmValuesForDeployment('portainer', serviceDefaults('portainer', 'k3s'));
  assert.deepEqual(renderedPortainerHelmValues.volumes.find(({ name }) => name === 'docker-socket'), basePortainerHelmValues.volumes.find(({ name }) => name === 'docker-socket'));
  const baseVpnHelmValues = parse(await readFile(path.join(projectRoot, 'services', 'vpn', 'helm', 'values.yaml'), 'utf8'));
  const renderedVpnHelmValues = await helmValuesForDeployment('vpn', serviceDefaults('vpn', 'k3s'));
  assert.equal(renderedVpnHelmValues.hostNetwork, baseVpnHelmValues.hostNetwork);
  assert.deepEqual(renderedVpnHelmValues.volumes.find(({ name }) => name === 'tun'), baseVpnHelmValues.volumes.find(({ name }) => name === 'tun'));
  const baseDnsHelmValues = parse(await readFile(path.join(projectRoot, 'services', 'dns', 'helm', 'values.yaml'), 'utf8'));
  const renderedDnsHelmValues = await helmValuesForDeployment('dns', serviceDefaults('dns', 'k3s'));
  assert.equal(renderedDnsHelmValues.hostNetwork, baseDnsHelmValues.hostNetwork);
  assert.deepEqual(renderedDnsHelmValues.volumes.find(({ name }) => name === 'dnsmasq'), baseDnsHelmValues.volumes.find(({ name }) => name === 'dnsmasq'));
});

test('configuration editor returns safe defaults and rejects paths outside the service', async () => {
  const defaults = await request('/api/configurations/grafana/docker/local');
  assert.equal(defaults.status, 200);
  assert.equal(defaults.body.configuration.configFile, 'config/grafana.ini');
  assert.equal('configContents' in defaults.body.configuration, false);

  const editedContents = await request('/api/configurations/grafana/docker/local', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ configContents: '[server]\nhttp_port = 3333' }),
  });
  assert.equal(editedContents.status, 400);

  const invalid = await request('/api/configurations/grafana/docker/local', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ configFile: '../../secrets/k3s-token' }),
  });
  assert.equal(invalid.status, 400);
});

test('deploy uses the saved service/backend/target configuration and records success', async () => {
  await saveTarget({ id: 'local', name: 'Local Docker', backend: 'docker', host: '192.168.0.10', user: 'deploy', keySecret: 'id_home_lab' });
  await request('/api/configurations/postgresql/docker/local', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ port: '5434' }),
  });
  validationResult = async (job) => ({ compose: await dockerComposeFromBase(job.service, job.configuration) });

  const started = await request('/api/deployments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ service: 'postgresql', backend: 'docker', targetId: 'local' }),
  });
  assert.equal(started.status, 202);
  await new Promise((resolve) => setTimeout(resolve, 20));

  const jobs = (await request('/api/jobs')).body;
  assert.equal(jobs.find(({ id }) => id === started.body.id).status, 'succeeded');
  assert.equal(deployed.at(-1).service, 'postgresql');
  assert.equal(deployed.at(-1).backend, 'docker');
  assert.equal(deployed.at(-1).targetId, 'local');
  assert.equal(deployed.at(-1).configuration.port, '5434');
  assert.deepEqual(deployed.at(-1).rendered.compose.services.postgresql.ports, ['5434:5432']);
  assert.equal((await request(`/api/jobs/${started.body.id}`)).body.logs, 'deployment complete');
  validationResult = { code: 0, output: '' };
});

test('failed deployments are visible in job status, history, and logs', async () => {
  await saveTarget({ id: 'cluster-a', name: 'K3s cluster A', backend: 'k3s', apiServer: 'https://192.168.0.20:6443', caSecret: 'k3s-ca.crt', tokenSecret: 'k3s-token' });
  await request('/api/configurations/grafana/k3s/cluster-a', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ port: '3000' }),
  });
  const started = await request('/api/deployments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ service: 'grafana', backend: 'k3s', targetId: 'cluster-a' }),
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const job = (await request(`/api/jobs/${started.body.id}`)).body;
  assert.equal(job.status, 'failed');
  assert.match(job.logs, /deployment failed/);
  assert.equal((await request('/api/jobs')).body[0].status, 'failed');
});

test('parallel deployments retain every job and final state', async () => {
  await saveTarget({ id: 'local', name: 'Local Docker', backend: 'docker', host: '192.168.0.10', user: 'deploy', keySecret: 'id_home_lab' });
  for (const service of ['postgresql', 'sonarqube']) {
    await request(`/api/configurations/${service}/docker/local`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ port: service === 'postgresql' ? '5432' : '9000' }),
    });
  }
  const starts = await Promise.all(['postgresql', 'sonarqube'].map((service) => request('/api/deployments', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ service, backend: 'docker', targetId: 'local' }),
  })));
  assert.deepEqual(starts.map(({ status }) => status), [202, 202]);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const jobs = (await request('/api/jobs')).body;
  assert.ok(starts.every(({ body: start }) => jobs.some((job) => job.id === start.id && job.status === 'succeeded')));
});
