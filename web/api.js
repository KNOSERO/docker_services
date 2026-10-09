import { createServer as httpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { constants, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parse } from 'yaml';

const root = path.dirname(fileURLToPath(import.meta.url));
const services = [
  { id: 'postgresql', name: 'PostgreSQL', group: 'Database', description: 'Relational database', fields: [['image', 'Image'], ['port', 'Port'], ['database', 'Database'], ['username', 'Username'], ['passwordSecret', 'Password secret filename'], ['configFile', 'PostgreSQL config file'], ['configMountPath', 'Configuration mount path'], ['dataPath', 'Data path']] },
  { id: 'sonarqube', name: 'SonarQube', group: 'Development', description: 'Code quality and security analysis', fields: [['image', 'Image'], ['port', 'Web port'], ['dataPath', 'Data path']] },
  { id: 'grafana', name: 'Grafana', group: 'Monitoring', description: 'Metrics dashboards', fields: [['image', 'Image'], ['port', 'Web port'], ['passwordSecret', 'Admin password secret filename'], ['configFile', 'Grafana config file'], ['configMountPath', 'Configuration mount path'], ['dataPath', 'Data path']] },
  { id: 'prometheus', name: 'Prometheus', group: 'Monitoring', description: 'Metrics collection and alerting', fields: [['image', 'Image'], ['port', 'Web port'], ['configFile', 'Prometheus config file'], ['configMountPath', 'Configuration mount path'], ['dataPath', 'Data path']] },
  { id: 'proxy', name: 'Proxy', group: 'Infrastructure', description: 'Reverse proxy and certificate management', fields: [['image', 'Image'], ['httpPort', 'HTTP port'], ['httpsPort', 'HTTPS port'], ['adminPort', 'Admin port'], ['dataPath', 'Data path'], ['network', 'Docker network', 'docker'], ['dnsServers', 'DNS servers']] },
  { id: 'portainer', name: 'Portainer', group: 'Infrastructure', description: 'Container management interface', fields: [['image', 'Image'], ['port', 'Web port'], ['dataPath', 'Data path'], ['dockerSocket', 'Mount Docker socket', 'docker']] },
  { id: 'dns', name: 'DNS', group: 'Infrastructure', description: 'Pi-hole DNS and DHCP', fields: [['image', 'Image'], ['webPort', 'Web port'], ['dnsPort', 'DNS port'], ['timezone', 'Timezone'], ['dataPath', 'Data path'], ['network', 'Docker network', 'docker']] },
  { id: 'nexus', name: 'Nexus', group: 'Development', description: 'Artifact and container registry', fields: [['image', 'Image'], ['port', 'Web port'], ['registryPort', 'Registry port'], ['dataPath', 'Data path']] },
  { id: 'jenkins', name: 'Jenkins', group: 'Development', description: 'Build automation server', fields: [['image', 'Image'], ['port', 'Web port'], ['agentPort', 'Agent port'], ['timezone', 'Timezone'], ['dataPath', 'Data path']] },
  { id: 'vpn', name: 'VPN', group: 'Infrastructure', description: 'WireGuard VPN endpoint', fields: [['image', 'Image'], ['host', 'Public VPN hostname'], ['vpnPort', 'WireGuard port'], ['webPort', 'Web UI port'], ['passwordHashSecret', 'Password hash secret filename'], ['dnsServers', 'Default DNS servers'], ['allowedIPs', 'Allowed IPs'], ['dataPath', 'WireGuard data path']] },
];
for (const definition of services) definition.fields.push(['ingressHost', 'Ingress hostname', 'k3s'], ['ingressEnabled', 'Enable ingress (true/false)', 'k3s']);

const backends = ['docker', 'k3s'];
const editableFields = new Set(['image', 'port', 'httpPort', 'httpsPort', 'adminPort', 'webPort', 'dnsPort', 'registryPort', 'agentPort', 'vpnPort', 'database', 'username', 'timezone', 'host', 'dnsServers', 'allowedIPs', 'dataPath', 'configFile', 'configMountPath']);
const portFields = new Set(['port', 'httpPort', 'httpsPort', 'adminPort', 'webPort', 'dnsPort', 'registryPort', 'agentPort', 'vpnPort']);
const configPath = (dataDir, service, backend, targetId) => path.join(dataDir, 'services', service, backend, `${targetId}.yml`);
const yaml = (value) => `${JSON.stringify(value, null, 2)}\n`;
const mergeValues = (base, overlay) => Object.fromEntries([...new Set([...Object.keys(base || {}), ...Object.keys(overlay || {})])].map((key) => {
  const left = base?.[key];
  const right = overlay?.[key];
  return [key, left && right && !Array.isArray(left) && !Array.isArray(right) && typeof left === 'object' && typeof right === 'object' ? mergeValues(left, right) : right === undefined ? left : right];
}));
const mergeNamedValues = (base = [], overlay = [], keyOf = ({ name }) => name) => {
  const values = new Map((base || []).map((item) => [keyOf(item), item]));
  for (const item of overlay || []) values.set(keyOf(item), { ...(values.get(keyOf(item)) || {}), ...item });
  return [...values.values()];
};
const commonEnvironmentNames = {
  postgresql: ['POSTGRES_DB', 'POSTGRES_USER'], jenkins: ['TZ'], dns: ['TZ'],
  vpn: ['WG_HOST', 'WG_PORT', 'WG_DEFAULT_DNS', 'WG_ALLOWED_IPS'],
};
const commonEnvironment = (service, generated) => generated.filter(({ name }) => (commonEnvironmentNames[service] || []).includes(name));
let jobsWrite = Promise.resolve();

async function readDocument(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Invalid panel state in ${path.basename(file)}: ${error.message}`);
  }
}

async function saveDocument(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, yaml(value), { mode: 0o600 });
  await rename(temporary, file);
}

async function readTargetOverrides(dataDir, service, backend, targetId) {
  const file = configPath(dataDir, service, backend, targetId);
  let saved;
  try { saved = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`Invalid panel state in ${path.basename(file)}: ${error.message}`);
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error(`Invalid panel state in ${path.basename(file)}: expected an object`);
  const definition = services.find((item) => item.id === service);
  const allowed = new Set(fieldsForBackend(definition, backend).map(([key]) => key));
  const overrides = saved.schemaVersion === 2 ? saved.overrides : saved;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw new Error(`Invalid panel state in ${path.basename(file)}: expected configuration values`);
  const values = Object.fromEntries(Object.entries(overrides).filter(([key]) => allowed.has(key)));
  if (saved.schemaVersion === 2) return values;

  const backup = `${file}.legacy`;
  try { await copyFile(file, backup, constants.COPYFILE_EXCL); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  await saveDocument(file, { schemaVersion: 2, overrides: values });
  const migrated = await readDocument(file, null);
  if (migrated?.schemaVersion !== 2 || JSON.stringify(migrated.overrides) !== JSON.stringify(values)) {
    throw new Error(`Could not verify migrated configuration in ${path.basename(file)}`);
  }
  return migrated.overrides;
}

async function updateJobs(dataDir, update) {
  const operation = jobsWrite.then(async () => {
    const file = path.join(dataDir, 'jobs.json');
    const jobs = await readDocument(file, []);
    const result = await update(jobs);
    await saveDocument(file, jobs);
    return result;
  });
  jobsWrite = operation.catch(() => {});
  return operation;
}

function json(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 64_000) throw Object.assign(new Error('Request body is too large'), { status: 413 });
  }
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('Expected a JSON request body'), { status: 400 }); }
}

function slug(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,62}$/.test(value);
}

async function command(program, args, options = {}) {
  return new Promise((resolve) => {
    const { input, ...spawnOptions } = options;
    const child = spawn(program, args, { ...spawnOptions, shell: false, windowsHide: true });
    let output = '';
    child.stdout?.on('data', (chunk) => { output += chunk; });
    child.stderr?.on('data', (chunk) => { output += chunk; });
    if (input) child.stdin.end(input);
    child.on('error', (error) => resolve({ code: 127, output: `${program}: ${error.message}` }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

export function serviceDefaults(service, backend) {
  const definition = services.find((item) => item.id === service);
  if (!definition) throw new Error(`Unknown service: ${service}`);
  let defaults;
  try { defaults = parse(readFileSync(path.join(root, '..', 'services', service, 'service-defaults.yml'), 'utf8')); }
  catch (error) { throw new Error(`Invalid service defaults for ${service}: ${error.message}`); }
  return { ...defaults.common, ...(backend ? defaults[backend] : defaults.docker), ...(!backend ? defaults.k3s : {}) };
}

function serviceFormFields(definition) {
  const defaults = serviceDefaults(definition.id);
  return definition.fields.filter(([key]) => editableFields.has(key)).map(([key, label, backend]) => [key, label, defaults[key] ?? '', backend || '', portFields.has(key) ? 'number' : 'text']);
}

function fieldsForBackend(definition, backend) {
  return definition.fields.filter(([, , fieldBackend]) => !fieldBackend || fieldBackend === backend);
}

function visibleConfiguration(definition, backend, configuration) {
  const visible = new Set(fieldsForBackend(definition, backend).filter(([key]) => editableFields.has(key)).map(([key]) => key));
  return Object.fromEntries(Object.entries(configuration).filter(([key]) => visible.has(key)));
}

async function serviceConfigSource(service, configuration) {
  const relative = ({ postgresql: 'config/postgresql.conf', grafana: 'config/grafana.ini', prometheus: 'config/prometheus.yml' })[service];
  if (!relative) return undefined;
  const serviceRoot = path.resolve(root, '..', 'services', service);
  const source = path.resolve(serviceRoot, configuration.configFile || relative);
  if (!source.startsWith(`${serviceRoot}${path.sep}`) || path.relative(serviceRoot, source).split(path.sep).includes('.git')) throw new Error('Config file must be inside the service directory');
  const [realRoot, realSource] = await Promise.all([realpath(serviceRoot), realpath(source)]);
  if (!realSource.startsWith(`${realRoot}${path.sep}`)) throw new Error('Config file must resolve inside the service directory');
  return realSource;
}

export function deploymentValues(service, configuration, backend = 'k3s') {
  const definition = services.find((item) => item.id === service);
  const defaults = serviceDefaults(service, backend);
  const values = Object.fromEntries(definition.fields.map(([key]) => [key, configuration[key] ?? defaults[key]]));
  const image = String(values.image);
  const tagSeparator = image.lastIndexOf(':');
  const [repository, tag] = tagSeparator > image.lastIndexOf('/') ? [image.slice(0, tagSeparator), image.slice(tagSeparator + 1)] : [image, 'latest'];
  const servicePorts = {
    postgresql: [{ name: 'postgres', port: Number(values.port), targetPort: 5432 }],
    sonarqube: [{ name: 'web', port: Number(values.port), targetPort: 9000 }],
    grafana: [{ name: 'web', port: Number(values.port), targetPort: 3000 }],
    prometheus: [{ name: 'web', port: Number(values.port), targetPort: 9090 }],
    proxy: [{ name: 'http', port: Number(values.httpPort), targetPort: 80 }, { name: 'https', port: Number(values.httpsPort), targetPort: 443 }, { name: 'admin', port: Number(values.adminPort), targetPort: 81 }],
    portainer: [{ name: 'web', port: Number(values.port), targetPort: 9000 }],
    dns: [{ name: 'dns-tcp', port: Number(values.dnsPort), targetPort: 53, protocol: 'TCP' }, { name: 'dns-udp', port: Number(values.dnsPort), targetPort: 53, protocol: 'UDP' }, { name: 'dhcp', port: 67, targetPort: 67, protocol: 'UDP' }, { name: 'web', port: Number(values.webPort), targetPort: 80 }],
    nexus: [{ name: 'web', port: Number(values.port), targetPort: 8081 }, { name: 'registry', port: Number(values.registryPort), targetPort: 5000 }],
    jenkins: [{ name: 'web', port: Number(values.port), targetPort: 8080 }, { name: 'agent', port: Number(values.agentPort), targetPort: 50000 }],
    vpn: [{ name: 'wireguard', port: Number(values.vpnPort), targetPort: Number(values.vpnPort), protocol: 'UDP' }, { name: 'web', port: Number(values.webPort), targetPort: 51821 }],
  }[service];
  const ports = [...new Set(servicePorts.map((port) => port.targetPort))];
  const volumeMount = {
    postgresql: '/var/lib/postgresql/data', sonarqube: '/opt/sonarqube/data', grafana: '/var/lib/grafana',
    prometheus: '/prometheus', proxy: '/data', portainer: '/data', dns: '/etc/pihole', nexus: '/nexus-data',
    jenkins: '/var/jenkins_home', vpn: '/etc/wireguard',
  }[service];
  const env = {
    postgresql: [{ name: 'POSTGRES_DB', value: values.database }, { name: 'POSTGRES_USER', value: values.username }, { name: 'POSTGRES_PASSWORD_FILE', value: `/run/secrets/${path.basename(values.passwordSecret || 'postgres_password')}` }],
    grafana: [{ name: 'GF_SECURITY_ADMIN_PASSWORD__FILE', value: `/run/secrets/${path.basename(values.passwordSecret || 'grafana_password')}` }],
    proxy: [{ name: 'DB_SQLITE_FILE', value: '/data/database.sqlite' }],
    jenkins: [{ name: 'TZ', value: values.timezone }], dns: [{ name: 'TZ', value: values.timezone }],
  }[service] || [];
  if (service === 'vpn') env.push(
    { name: 'LANG', value: 'pl' }, { name: 'WG_HOST', value: values.host }, { name: 'PORT', value: '51821' },
    { name: 'WG_PORT', value: String(values.vpnPort) }, { name: 'WG_DEFAULT_DNS', value: values.dnsServers }, { name: 'WG_ALLOWED_IPS', value: values.allowedIPs },
  );
  if (service === 'vpn') env.push({ name: 'PASSWORD_HASH', valueFrom: { secretKeyRef: { name: 'vpn-secrets', key: path.basename(values.passwordHashSecret || 'vpn_password_hash') } } });
  const volumes = volumeMount ? [{ name: 'data', hostPath: values.dataPath, mountPath: volumeMount }] : [];
  if (service === 'dns') volumes.push({ name: 'dnsmasq', hostPath: `${values.dataPath}/dnsmasq.d`, mountPath: '/etc/dnsmasq.d' });
  if (service === 'proxy') volumes.push({ name: 'letsencrypt', hostPath: `${values.dataPath}/letsencrypt`, mountPath: '/etc/letsencrypt' });
  if (service === 'sonarqube') volumes.splice(0, 1,
    ...['data', 'extensions', 'logs'].map((directory) => ({ name: directory, hostPath: `${values.dataPath}/${directory}`, mountPath: `/opt/sonarqube/${directory}` })),
  );
  if (service === 'portainer' && values.dockerSocket !== 'false') volumes.push({ name: 'docker-socket', hostPath: '/var/run/docker.sock', mountPath: '/var/run/docker.sock', type: 'Socket' });
  if (service === 'vpn') volumes.push({ name: 'tun', hostPath: '/dev/net/tun', mountPath: '/dev/net/tun', type: 'CharDevice' });
  const containerSecurityContext = service === 'vpn' ? { capabilities: { add: ['NET_ADMIN'] } } : undefined;
  return {
    name: service, namespace: service, replicas: 1, configMountPath: values.configMountPath,
    image: { repository, tag, pullPolicy: 'IfNotPresent', ...(service === 'postgresql' ? { args: ['-c', 'config_file=/etc/postgresql/postgresql.conf'] } : {}) }, service: { type: 'ClusterIP' }, ports, servicePorts,
    containerPorts: [...new Map(servicePorts.map((port) => [`${port.targetPort}/${port.protocol || 'TCP'}`, { containerPort: port.targetPort, protocol: port.protocol || 'TCP' }])).values()],
    env, runAsUser: service === 'grafana' ? 472 : service === 'sonarqube' ? 1000 : 0,
    volumes, containerSecurityContext,
    podSecurityContext: service === 'vpn' ? { sysctls: [{ name: 'net.ipv4.conf.all.src_valid_mark', value: '1' }, { name: 'net.ipv4.ip_forward', value: '1' }] } : undefined,
    hostNetwork: ['dns', 'vpn'].includes(service),
    podDnsConfig: service === 'proxy' ? { nameservers: String(values.dnsServers).split(',').map((server) => server.trim()).filter(Boolean) } : undefined,
    configMounts: ({
      postgresql: [{ name: 'postgresql-config', configMap: 'postgresql-config', mountPath: values.configMountPath, subPath: 'postgresql.conf', readOnly: true }],
      grafana: [{ name: 'grafana-config', configMap: 'grafana-config', mountPath: values.configMountPath, subPath: 'grafana.ini', readOnly: true }],
      prometheus: [{ name: 'prometheus-config', configMap: 'prometheus-config', mountPath: values.configMountPath, subPath: 'prometheus.yml', readOnly: true }],
    })[service] || [],
    configMaps: ({ postgresql: [{ name: 'postgresql', path: 'config/postgresql.conf' }], grafana: [{ name: 'grafana', path: 'config/grafana.ini' }], prometheus: [{ name: 'prometheus', path: 'config/prometheus.yml' }] })[service] || [],
    ingress: { hosts: values.ingressEnabled === 'true' && values.ingressHost ? [{ domain: values.ingressHost, port: servicePorts[0].port }] : [] },
    secrets: { enabled: ['postgresql', 'grafana', 'vpn'].includes(service), name: `${service}-secrets` },
  };
}

export function dockerCompose(service, configuration) {
  const values = deploymentValues(service, configuration, 'docker');
  const definition = services.find((item) => item.id === service);
  const defaults = serviceDefaults(service, 'docker');
  const config = Object.fromEntries(definition.fields.map(([key]) => [key, configuration[key] ?? defaults[key]]));
  const app = {
    container_name: service,
    image: config.image,
    restart: 'unless-stopped',
    ports: values.ports.map((port) => `${port}:${port}`),
    volumes: values.volumes.map((volume) => `${volume.hostPath}:${volume.mountPath}`),
    environment: Object.fromEntries(values.env.map(({ name, value }) => [name, String(value)])),
  };
  const secretName = ({ postgresql: config.passwordSecret || 'postgres_password', grafana: config.passwordSecret || 'grafana_password' })[service];
  if (secretName) {
    const secretPath = `/opt/docker-secrets/${service}/${path.basename(secretName)}`;
    app.environment[service === 'postgresql' ? 'POSTGRES_PASSWORD_FILE' : 'GF_SECURITY_ADMIN_PASSWORD__FILE'] = `/run/secrets/${path.basename(secretName)}`;
    app.volumes.push(`${secretPath}:/run/secrets/${path.basename(secretName)}:ro`);
  }
  if (service === 'postgresql') {
    app.ports = [`${config.port}:5432`];
    app.command = ['-c', 'config_file=/etc/postgresql/postgresql.conf'];
    app.volumes.push(`/opt/docker/${service}/${path.basename(config.configFile || 'postgresql.conf')}:${config.configMountPath}:ro`);
  }
  if (service === 'sonarqube') app.ports = [`${config.port}:9000`];
  if (service === 'grafana') app.ports = [`${config.port}:3000`];
  if (service === 'prometheus') app.ports = [`${config.port}:9090`];
  if (service === 'nexus') app.ports = [`${config.port}:8081`, `${config.registryPort}:5000`];
  if (service === 'jenkins') app.ports = [`${config.port}:8080`, `${config.agentPort}:50000`];
  if (service === 'portainer') {
    app.ports = [`${config.port}:9000`];
    if (config.dockerSocket !== 'false') app.volumes.push('/var/run/docker.sock:/var/run/docker.sock');
  }
  if (service === 'dns') app.ports = [`${config.dnsPort}:53/tcp`, `${config.dnsPort}:53/udp`, '67:67/udp', `${config.webPort}:80/tcp`];
  if (service === 'proxy') app.ports = [`${config.httpPort}:80`, `${config.httpsPort}:443`, `${config.adminPort}:81`];
  if (service === 'vpn') {
    app.ports = [`${config.vpnPort}:${config.vpnPort}/udp`, `${config.webPort}:51821/tcp`];
    app.cap_add = ['NET_ADMIN'];
    app.sysctls = { 'net.ipv4.conf.all.src_valid_mark': '1', 'net.ipv4.ip_forward': '1' };
    app.environment = Object.fromEntries(values.env.filter(({ name }) => name !== 'PASSWORD_HASH').map(({ name, value }) => [name, String(value)]));
    app.env_file = ['/opt/docker-secrets/vpn/password_hash.env'];
  }
  if (service === 'prometheus') {
    const filename = path.basename(config.configFile || 'prometheus.yml');
    app.command = ['--config.file=/etc/prometheus/prometheus.yml', '--storage.tsdb.path=/prometheus'];
    app.volumes.push(`/opt/docker/${service}/${filename}:${config.configMountPath}:ro`);
  }
  if (service === 'grafana') app.volumes.push(`/opt/docker/${service}/${path.basename(config.configFile || 'grafana.ini')}:${config.configMountPath}:ro`);
  if (['proxy', 'dns'].includes(service) && config.network) app.networks = [config.network];
  if (service === 'proxy') app.dns = String(config.dnsServers).split(',').map((server) => server.trim()).filter(Boolean);
  const networks = app.networks?.length ? Object.fromEntries(app.networks.map((name) => [name, { external: true }])) : undefined;
  return { services: { [service]: app }, ...(networks ? { networks } : {}) };
}

export async function dockerComposeFromBase(service, configuration) {
  const baseFile = path.join(root, '..', 'services', service, 'docker-compose.yml');
  let base;
  try { base = parse(await readFile(baseFile, 'utf8')); }
  catch (error) { throw new Error(`Invalid Compose base for ${service}: ${error.message}`); }
  const rendered = dockerCompose(service, configuration);
  const original = base.services?.[service] || {};
  const generated = rendered.services[service];
  const volumeTarget = (mount) => mount.split(':')[1];
  const volumes = new Map((original.volumes || []).map((mount) => [volumeTarget(mount), mount]));
  if (['postgresql', 'grafana', 'prometheus'].includes(service)) {
    for (const [target, mount] of volumes) if (mount.startsWith(`/opt/docker/${service}/`)) volumes.delete(target);
  }
  for (const mount of generated.volumes || []) {
    if (/\/(run\/secrets|var\/run\/docker\.sock|dev\/net\/tun)(:|$)/.test(volumeTarget(mount))) continue;
    volumes.set(volumeTarget(mount), mount);
  }
  const { networks: baseNetworks, ...baseSettings } = original;
  const settings = {
    ...baseSettings,
    image: generated.image,
    ports: generated.ports,
    environment: { ...(baseSettings.environment || {}), ...Object.fromEntries(Object.entries(generated.environment || {}).filter(([name]) => (commonEnvironmentNames[service] || []).includes(name))) },
    volumes: [...volumes.values()],
  };
  if (generated.dns) settings.dns = generated.dns;
  return {
    ...base,
    services: { ...base.services, [service]: { ...settings, ...(baseNetworks ? { networks: baseNetworks } : {}) } },
  };
}

async function stageServiceSecret(service, configuration, temporary, secretsDir) {
  const filename = ({ postgresql: configuration.passwordSecret || 'postgres_password', grafana: configuration.passwordSecret || 'grafana_password', vpn: configuration.passwordHashSecret || 'vpn_password_hash' })[service];
  if (!filename) return undefined;
  const secretFile = path.join(secretsDir, path.basename(filename));
  try { await readFile(secretFile); } catch { throw new Error(`Required secret file is unavailable: ${path.basename(filename)}`); }
  const staged = path.join(temporary, path.basename(filename));
  await writeFile(staged, await readFile(secretFile), { mode: 0o600 });
  if (service === 'vpn') {
    const env = path.join(temporary, 'password_hash.env');
    const value = (await readFile(staged, 'utf8')).trim();
    if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value)) throw new Error('VPN password hash secret must be a single bcrypt hash');
    await writeFile(env, `PASSWORD_HASH='${value}'\n`, { mode: 0o600 });
    return { source: staged, name: path.basename(filename), dockerSource: env, dockerName: 'password_hash.env' };
  }
  return { source: staged, name: path.basename(filename) };
}

async function stageConfigFile(service, configuration, temporary) {
  const source = await serviceConfigSource(service, configuration);
  if (!source) return undefined;
  let fileContents;
  try { fileContents = await readFile(source, 'utf8'); } catch { throw new Error(`Config file is unavailable: ${path.basename(source)}`); }
  const staged = path.join(temporary, path.basename(source));
  const contents = configuration.configContents ?? fileContents;
  await writeFile(staged, contents, { mode: 0o600 });
  return { source: staged, name: path.basename(source), contents };
}

export async function helmValuesForDeployment(service, configuration) {
  const chart = path.join(root, '..', 'services', service, 'helm');
  let nativeValues;
  try { nativeValues = parse(await readFile(path.join(chart, 'values.yaml'), 'utf8')); }
  catch (error) { throw new Error(`Invalid Helm base values for ${service}: ${error.message}`); }
  try { nativeValues = mergeValues(nativeValues, parse(await readFile(path.join(root, '..', 'services', service, 'config.yml'), 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error(`Invalid Helm service override for ${service}: ${error.message}`); }
  const generated = deploymentValues(service, configuration, 'k3s');
  const values = { ...nativeValues };
  values.image = mergeValues(nativeValues.image, generated.image);
  values.ports = generated.ports;
  values.servicePorts = mergeNamedValues(nativeValues.servicePorts, generated.servicePorts);
  values.containerPorts = mergeNamedValues(nativeValues.containerPorts, generated.containerPorts, ({ containerPort, protocol }) => `${containerPort}/${protocol}`);
  values.env = mergeNamedValues(nativeValues.env, commonEnvironment(service, generated.env));
  values.volumes = mergeNamedValues(nativeValues.volumes, generated.volumes.filter(({ name }) => !['docker-socket', 'tun'].includes(name)));
  if (generated.podDnsConfig) values.podDnsConfig = mergeValues(nativeValues.podDnsConfig, generated.podDnsConfig);
  const source = await serviceConfigSource(service, configuration);
  if (source) {
    const filename = path.basename(source);
    values.configFiles = { [filename]: configuration.configContents ?? await readFile(source, 'utf8') };
    const pathInContainer = generated.configMountPath;
    values.configMounts = mergeNamedValues(nativeValues.configMounts, [{ name: `${service}-config`, configMap: `${service}-config`, mountPath: pathInContainer, subPath: filename, readOnly: true }]);
    values.configMaps = [];
  }
  return values;
}

export async function validateRenderedDeployment(job, runCommand = command) {
  const temporary = await import('node:fs/promises').then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), 'panel-validation-')));
  try {
    if (job.backend === 'docker') {
      const composeFile = path.join(temporary, 'docker-compose.yml');
      const compose = await dockerComposeFromBase(job.service, job.configuration);
      await writeFile(composeFile, yaml(compose), { mode: 0o600 });
      const result = await runCommand('docker', ['compose', '-f', composeFile, 'config', '--no-env-resolution', '-q']);
      if (result.code !== 0) throw Object.assign(new Error(`Compose validation failed: ${result.output.trim() || 'Docker Compose could not validate the rendered configuration'}`), { status: 422 });
      return { compose };
    }

    const chart = path.join(root, '..', 'services', job.service, 'helm');
    const valuesFile = path.join(temporary, 'values.yml');
    const helmValues = await helmValuesForDeployment(job.service, job.configuration);
    await writeFile(valuesFile, yaml(helmValues), { mode: 0o600 });
    const valuesArgs = ['--values', valuesFile];
    for (const [label, args] of [
      ['lint', ['lint', chart, ...valuesArgs]],
      ['render', ['template', job.service, chart, '--namespace', job.service, ...valuesArgs]],
    ]) {
      const result = await runCommand('helm', args);
      if (result.code !== 0) throw Object.assign(new Error(`Helm ${label} validation failed: ${result.output.trim() || 'Helm could not validate the rendered configuration'}`), { status: 422 });
    }
    return { helmValues };
  } catch (error) {
    if (!error.status) error.status = 422;
    throw error;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function deployJob(job, dataDir, setStage) {
  if (job.backend === 'docker') {
    const target = job.target;
    const targetSecretRoot = process.env.PANEL_TARGET_SECRETS_DIR || process.env.PANEL_SECRETS_DIR || path.join(root, '..', 'secrets');
    const temporary = await import('node:fs/promises').then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), 'panel-compose-')));
    try {
      await setStage('Preparing Docker Compose configuration');
      await writeFile(path.join(temporary, 'docker-compose.yml'), yaml(job.rendered.compose), { mode: 0o600 });
      const secret = await stageServiceSecret(job.service, job.configuration, temporary, process.env.PANEL_SECRETS_DIR || path.join(root, '..', 'secrets'));
      const configFile = await stageConfigFile(job.service, job.configuration, temporary);
      const template = path.join(root, '..', 'templates', 'docker');
      const networkNames = Object.entries(job.rendered.compose.networks || {})
        .filter(([, network]) => network.external)
        .map(([name, network]) => network.name || network.external.name || name);
      await setStage('Deploying Docker Compose to the selected host');
      return await command('ansible-playbook', [
        path.join(template, 'deploy.yml'), '-i', `${target.host},`, '-u', target.user,
        '--private-key', path.join(targetSecretRoot, path.basename(target.keySecret || 'id_home_lab')),
        '--ssh-common-args', `-o UserKnownHostsFile=${path.join(targetSecretRoot, path.basename(target.knownHostsSecret || 'known_hosts'))} -o StrictHostKeyChecking=yes`,
        '-e', `service=${job.service}`, '-e', `compose_source=${path.join(temporary, 'docker-compose.yml')}`,
        ...(secret ? ['-e', `secret_source=${secret.dockerSource || secret.source}`, '-e', `secret_name=${secret.dockerName || secret.name}`] : []),
        ...(configFile ? ['-e', `config_source=${configFile.source}`, '-e', `config_name=${configFile.name}`] : []),
        ...(networkNames.length ? ['-e', JSON.stringify({ network_names: networkNames })] : []),
      ], { cwd: template });
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }

  const target = job.target;
  const secretRoot = process.env.PANEL_SECRETS_DIR || path.join(root, '..', 'secrets');
  const targetSecretRoot = process.env.PANEL_TARGET_SECRETS_DIR || secretRoot;
  await setStage('Loading K3s credentials');
    const ca = await readFile(path.join(targetSecretRoot, path.basename(target.caSecret || 'k3s-ca.crt')));
  const token = (await readFile(path.join(targetSecretRoot, path.basename(target.tokenSecret || 'k3s-token')), 'utf8')).trim();
  const temporary = await import('node:fs/promises').then(({ mkdtemp }) => mkdtemp(path.join(os.tmpdir(), 'panel-kubeconfig-')));
  const kubeconfig = path.join(temporary, 'config');
  try {
    const credentials = Buffer.from(`apiVersion: v1\nkind: Config\nclusters:\n- name: selected\n  cluster:\n    server: ${JSON.stringify(target.apiServer)}\n    certificate-authority-data: ${ca.toString('base64')}\ncontexts:\n- name: panel\n  context:\n    cluster: selected\n    user: panel\ncurrent-context: panel\nusers:\n- name: panel\n  user:\n    token: ${JSON.stringify(token)}\n`);
    await writeFile(kubeconfig, credentials, { mode: 0o600 });
    const chart = path.join(root, '..', 'services', job.service, 'helm');
    const valuesFile = path.join(temporary, 'values.yml');
    const values = job.rendered.helmValues;
    await writeFile(valuesFile, yaml(values), { mode: 0o600 });
    const secret = await stageServiceSecret(job.service, job.configuration, temporary, secretRoot);
    if (secret) {
      await setStage('Applying application secret to K3s');
      const namespace = job.service;
      const namespaceYaml = await command('kubectl', ['--kubeconfig', kubeconfig, 'create', 'namespace', namespace, '--dry-run=client', '-o', 'yaml']);
      if (namespaceYaml.code !== 0) return namespaceYaml;
      const namespaceApplied = await command('kubectl', ['--kubeconfig', kubeconfig, 'apply', '-f', '-'], { input: namespaceYaml.output });
      if (namespaceApplied.code !== 0) return namespaceApplied;
      const generated = await command('kubectl', ['--kubeconfig', kubeconfig, 'create', 'secret', 'generic', `${job.service}-secrets`, '--namespace', namespace, `--from-file=${secret.name}=${secret.source}`, '--dry-run=client', '-o', 'yaml']);
      if (generated.code !== 0) return generated;
      const applied = await command('kubectl', ['--kubeconfig', kubeconfig, 'apply', '-f', '-'], { input: generated.output });
      if (applied.code !== 0) return applied;
    }
    await setStage('Installing service with Helm');
    return await command('helm', ['upgrade', '--install', job.service, chart, '--namespace', job.service, '--create-namespace', '--kubeconfig', kubeconfig, '--values', valuesFile]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export function createPanel({ dataDir = process.env.PANEL_CONFIG_DIR || path.resolve(root, '..', '.config'), adapter = deployJob, validator = validateRenderedDeployment } = {}) {
  const server = httpServer(async (request, response) => {
    try {
      const allowedHosts = new Set((process.env.PANEL_ALLOWED_HOSTS || '').split(',').map((host) => host.trim()).filter(Boolean));
      const localHost = /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(request.headers.host || '');
      if (!localHost && !allowedHosts.has(request.headers.host)) return json(response, 403, { error: 'This panel is available only through an approved local or cluster address' });
      const origin = request.headers.origin;
      if (origin && new URL(origin).host !== request.headers.host) return json(response, 403, { error: 'Cross-origin requests are not allowed' });
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/api/state') {
        const targets = await readDocument(path.join(dataDir, 'targets.yml'), []);
        const jobs = await readDocument(path.join(dataDir, 'jobs.json'), []);
        json(response, 200, { services: services.map((service) => ({ ...service, fields: serviceFormFields(service) })), backends, targets, jobs });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/jobs') {
        json(response, 200, await readDocument(path.join(dataDir, 'jobs.json'), []));
        return;
      }
      const jobMatch = url.pathname.match(/^\/api\/jobs\/([a-f0-9-]+)$/);
      if (request.method === 'GET' && jobMatch) {
        const jobs = await readDocument(path.join(dataDir, 'jobs.json'), []);
        const job = jobs.find((item) => item.id === jobMatch[1]);
        json(response, job ? 200 : 404, job || { error: 'Job not found' });
        return;
      }
      if (request.method === 'PUT' && url.pathname === '/api/targets') {
        const target = await body(request);
        if (!slug(target.id) || !target.name || !backends.includes(target.backend)) throw Object.assign(new Error('Target requires a valid id, name, and backend'), { status: 400 });
        const fields = target.backend === 'docker' ? ['id', 'name', 'backend', 'host', 'user', 'keySecret', 'knownHostsSecret'] : ['id', 'name', 'backend', 'apiServer', 'caSecret', 'tokenSecret'];
        const cleanTarget = Object.fromEntries(fields.filter((key) => typeof target[key] === 'string').map((key) => [key, target[key].trim()]));
        if (target.backend === 'docker' && (!/^[a-zA-Z0-9.-]+$/.test(cleanTarget.host || '') || !/^[a-z_][a-z0-9_-]*$/i.test(cleanTarget.user || '') || !/^[a-zA-Z0-9._-]+$/.test(cleanTarget.keySecret || ''))) throw Object.assign(new Error('Docker targets require a valid SSH hostname, user, and secret filename'), { status: 400 });
        if (target.backend === 'docker' && cleanTarget.knownHostsSecret && !/^[a-zA-Z0-9._-]+$/.test(cleanTarget.knownHostsSecret)) throw Object.assign(new Error('knownHostsSecret must be a secret filename'), { status: 400 });
        if (target.backend === 'k3s') {
          try { const endpoint = new URL(cleanTarget.apiServer); if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error(); }
          catch { throw Object.assign(new Error('K3s API endpoint must be a valid HTTPS URL'), { status: 400 }); }
          if (!/^[a-zA-Z0-9._-]+$/.test(cleanTarget.caSecret || '') || !/^[a-zA-Z0-9._-]+$/.test(cleanTarget.tokenSecret || '')) throw Object.assign(new Error('K3s targets require CA and token secret filenames'), { status: 400 });
        }
        const file = path.join(dataDir, 'targets.yml');
        const targets = await readDocument(file, []);
        await saveDocument(file, [...targets.filter((item) => item.id !== target.id), cleanTarget]);
        json(response, 200, { target: cleanTarget });
        return;
      }
      const targetMatch = url.pathname.match(/^\/api\/targets\/([a-z0-9-]+)$/);
      if (request.method === 'DELETE' && targetMatch) {
        const file = path.join(dataDir, 'targets.yml');
        const targets = await readDocument(file, []);
        await saveDocument(file, targets.filter((item) => item.id !== targetMatch[1]));
        json(response, 200, { ok: true });
        return;
      }
      const configMatch = url.pathname.match(/^\/api\/configurations\/([a-z0-9-]+)\/(docker|k3s)\/([a-z0-9-]+)$/);
      if (configMatch && request.method === 'GET') {
        const [, service, backend, targetId] = configMatch;
        const definition = services.find((item) => item.id === service);
        if (!definition) throw Object.assign(new Error('Unknown service'), { status: 404 });
        const saved = await readTargetOverrides(dataDir, service, backend, targetId) || {};
        const configuration = { ...serviceDefaults(service, backend), ...saved };
        json(response, 200, { configuration: visibleConfiguration(definition, backend, configuration) });
        return;
      }
      if (configMatch && request.method === 'PUT') {
        const [, service, backend, targetId] = configMatch;
        const definition = services.find((item) => item.id === service);
        if (!definition) throw Object.assign(new Error('Unknown service'), { status: 404 });
        const input = await body(request);
        const allowed = new Set(fieldsForBackend(definition, backend).map(([key]) => key).filter((key) => editableFields.has(key)));
        if (Object.keys(input).some((key) => !allowed.has(key))) throw Object.assign(new Error('Configuration contains unknown fields'), { status: 400 });
        if (Object.entries(input).some(([key, value]) => typeof value !== 'string' || value.length > 512 || value.includes('\0'))) throw Object.assign(new Error('Configuration fields must be text up to 512 characters'), { status: 400 });
        const changes = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value.trim()]));
        const overrides = { ...(await readTargetOverrides(dataDir, service, backend, targetId) || {}), ...changes };
        const configuration = { ...serviceDefaults(service, backend), ...overrides };
        if (configuration.configFile) {
          try { await readFile(await serviceConfigSource(service, configuration)); }
          catch { throw Object.assign(new Error('Config file must exist inside the service directory'), { status: 400 }); }
        }
        const portKeys = ['port', 'webPort', 'vpnPort', 'httpPort', 'httpsPort', 'adminPort', 'agentPort', 'registryPort', 'dnsPort'];
        for (const key of portKeys) if (configuration[key] && (!/^\d{1,5}$/.test(configuration[key]) || Number(configuration[key]) < 1 || Number(configuration[key]) > 65535)) throw Object.assign(new Error(`${key} must be a port from 1 to 65535`), { status: 400 });
        if (configuration.image && !/^[a-zA-Z0-9._/:@-]+$/.test(configuration.image)) throw Object.assign(new Error('Image reference contains unsupported characters'), { status: 400 });
        if (configuration.dataPath && (!configuration.dataPath.startsWith('/') || configuration.dataPath.includes(':') || configuration.dataPath.split('/').includes('..'))) throw Object.assign(new Error('Data path must be an absolute Linux path'), { status: 400 });
        if (definition.fields.some(([key]) => key === 'configMountPath') && (!/^\/[A-Za-z0-9._/-]+$/.test(configuration.configMountPath || '') || configuration.configMountPath === '/' || configuration.configMountPath.split('/').some((part) => part === '.' || part === '..'))) throw Object.assign(new Error('Configuration mount path must be a safe absolute container path'), { status: 400 });
        await saveDocument(configPath(dataDir, service, backend, targetId), { schemaVersion: 2, overrides });
        json(response, 200, { configuration: visibleConfiguration(definition, backend, configuration) });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/deployments') {
        const input = await body(request);
        const definition = services.find((item) => item.id === input.service);
        if (!definition || !backends.includes(input.backend) || !slug(input.targetId)) throw Object.assign(new Error('Select a valid service, backend, and target'), { status: 400 });
        const savedConfiguration = await readTargetOverrides(dataDir, input.service, input.backend, input.targetId);
        if (!savedConfiguration) throw Object.assign(new Error('Save the deployment configuration before deploying'), { status: 409 });
        const configuration = visibleConfiguration(definition, input.backend, savedConfiguration);
        const targets = await readDocument(path.join(dataDir, 'targets.yml'), []);
        const target = targets.find((item) => item.id === input.targetId);
        if (!target) throw Object.assign(new Error('Target profile not found'), { status: 404 });
        if (target.backend !== input.backend) throw Object.assign(new Error('Target profile backend does not match the deployment'), { status: 400 });
        const validation = await validator({ service: input.service, backend: input.backend, targetId: input.targetId, configuration, target });
        if (validation?.code !== undefined && validation.code !== 0) throw Object.assign(new Error(`${input.backend === 'docker' ? 'Compose' : 'Deployment'} validation failed: ${validation.output || 'invalid configuration'}`), { status: 422 });
        const rendered = validation?.compose || validation?.helmValues ? validation : undefined;
        const job = { id: randomUUID(), service: input.service, serviceName: definition.name, backend: input.backend, targetId: input.targetId, status: 'running', stage: 'Starting deployment', createdAt: new Date().toISOString(), logs: '' };
        await updateJobs(dataDir, (jobs) => jobs.unshift(job));
        json(response, 202, { id: job.id, status: job.status });
        const setStage = async (stage) => {
          await updateJobs(dataDir, (jobs) => { const current = jobs.find((item) => item.id === job.id); if (current) current.stage = stage; });
        };
        Promise.resolve(adapter({ ...job, configuration, target, rendered }, dataDir, setStage)).then(async (result) => {
          await updateJobs(dataDir, (jobs) => {
            const current = jobs.find((item) => item.id === job.id);
            if (!current) return;
            current.status = result.code === 0 ? 'succeeded' : 'failed';
            current.stage = current.status === 'succeeded' ? 'Deployment complete' : 'Deployment failed';
            current.finishedAt = new Date().toISOString();
            current.logs = String(result.output || '').slice(-100_000);
          });
        }).catch(async (error) => {
          await updateJobs(dataDir, (jobs) => {
            const current = jobs.find((item) => item.id === job.id);
            if (!current) return;
            current.status = 'failed';
            current.stage = 'Deployment failed';
            current.finishedAt = new Date().toISOString();
            current.logs = error.message;
          });
        });
        return;
      }
      json(response, 404, { error: 'Not found' });
    } catch (error) {
      json(response, error.status || 500, { error: error.message });
    }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 6868);
  const host = process.env.PANEL_BIND_HOST || '127.0.0.1';
  createPanel().listen(port, host, () => console.log(`Services Control Panel listening on ${host}:${port}`));
}
