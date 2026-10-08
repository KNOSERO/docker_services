const $ = (selector, parent = document) => parent.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const state = { services: [], backends: [], targets: [], jobs: [], page: 'services', service: 'postgresql', backend: 'docker', targetId: 'local', configuration: {}, selectedJob: null };

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2400);
}

function targetsForBackend() { return state.targets.filter((target) => target.backend === state.backend); }
function service() { return state.services.find((item) => item.id === state.service); }
function idSymbol(name) { return name.slice(0, 2).toUpperCase(); }

function updateNavigation() {
  document.querySelectorAll('[data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === state.page));
  $('#breadcrumb-current').textContent = ({ services: 'Services', targets: 'Target profiles', jobs: 'Deployment jobs', job: 'Job details' })[state.page];
  $('#service-count').textContent = state.services.length;
  $('#job-count').textContent = state.jobs.length;
}

function renderServices() {
  const selected = service();
  const availableTargets = targetsForBackend();
  const selectedTarget = availableTargets.find((item) => item.id === state.targetId) || availableTargets[0];
  state.targetId = selectedTarget?.id || '';
  const editableFields = selected.fields.filter(([key]) => state.backend === 'k3s' || !['ingressHost', 'ingressEnabled'].includes(key));
  const fields = editableFields.map(([key, label, fallback]) => {
    const value = state.configuration[key] ?? fallback;
    const control = key === 'configContents' ? `<textarea id="field-${escapeHtml(key)}" name="${escapeHtml(key)}" rows="10" spellcheck="false">${escapeHtml(value)}</textarea>` : key === 'ingressEnabled' ? `<select id="field-${key}" name="${key}"><option value="false" ${value !== 'true' ? 'selected' : ''}>Disabled</option><option value="true" ${value === 'true' ? 'selected' : ''}>Enabled</option></select>` : key === 'protocol' ? `<select id="field-${key}" name="${key}"><option value="udp" ${value === 'udp' ? 'selected' : ''}>UDP</option><option value="tcp" ${value === 'tcp' ? 'selected' : ''}>TCP</option></select>` : `<input id="field-${escapeHtml(key)}" name="${escapeHtml(key)}" value="${escapeHtml(value)}" autocomplete="off">`;
    return `<div class="field"><label for="field-${escapeHtml(key)}">${escapeHtml(label)}</label>${control}</div>`;
  }).join('');
  const serviceRows = state.services.map((item) => `<button class="service-row ${item.id === state.service ? 'selected' : ''}" data-service="${escapeHtml(item.id)}"><span class="service-symbol">${escapeHtml(idSymbol(item.name))}</span><span class="service-info"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small></span><span class="service-meta"><span class="tag available">Docker</span><span class="tag available">K3s</span></span></button>`).join('');
  const options = availableTargets.map((target) => `<option value="${escapeHtml(target.id)}" ${target.id === state.targetId ? 'selected' : ''}>${escapeHtml(target.name)}</option>`).join('');
  $('#content').innerHTML = `
    <div class="page-heading"><div><div class="eyebrow">CONTROL PLANE / SERVICES</div><h1>Service deployments</h1><p>Configure and deploy services to Docker hosts and K3s clusters.</p></div><button class="button" data-action="new-target">＋ Add target</button></div>
    <section class="stats"><div class="stat-card"><span>Managed services</span><strong>${state.services.length}<small>available</small></strong></div><div class="stat-card"><span>Target profiles</span><strong>${state.targets.length}<small>configured</small></strong></div><div class="stat-card"><span>Deployment jobs</span><strong>${state.jobs.length}<small>total</small></strong></div><div class="stat-card"><span>Controller</span><strong style="color:var(--green)">Ready<small>local</small></strong></div></section>
    <div class="section-title"><h2>Services</h2><span class="hint">Choose a service to edit its deployment configuration</span></div>
    <div class="service-layout"><section class="service-list" aria-label="Services">${serviceRows}</section>
      <section class="panel-card service-form"><div class="form-heading"><span class="service-symbol">${escapeHtml(idSymbol(selected.name))}</span><div><h2>${escapeHtml(selected.name)}</h2><p>${escapeHtml(selected.description)}</p></div><div class="form-controls"><select class="field-input" id="target-select" aria-label="Target profile">${options || '<option value="">Add a target profile</option>'}</select><div class="backend-choice"><button data-backend="docker" class="${state.backend === 'docker' ? 'active' : ''}">Docker</button><button data-backend="k3s" class="${state.backend === 'k3s' ? 'active' : ''}">K3s</button></div></div></div>
        ${availableTargets.length ? `<form id="configuration-form"><div class="field-grid">${fields}</div><div class="form-actions"><span class="left">Saved per service · backend · target</span><div class="right"><button class="button secondary" type="submit">Save configuration</button><button class="button primary" type="button" data-action="deploy">↗ Deploy service</button></div></div></form>` : '<div class="notice">Create a target profile for this backend before editing or deploying a service.</div>'}
        ${state.backend === 'k3s' ? '<div class="notice">Cluster credentials are loaded from mounted secrets. Secret values are never shown or stored in this form.</div>' : ''}
      </section></div>`;
  $('#target-select')?.addEventListener('change', async (event) => { state.targetId = event.target.value; await loadConfiguration(); });
  $('#configuration-form')?.addEventListener('submit', saveConfiguration);
  $('#content').querySelectorAll('[data-service]').forEach((button) => button.addEventListener('click', async () => { state.service = button.dataset.service; await loadConfiguration(); render(); }));
  $('#content').querySelectorAll('[data-backend]').forEach((button) => button.addEventListener('click', async () => { state.backend = button.dataset.backend; state.targetId = targetsForBackend()[0]?.id || ''; await loadConfiguration(); render(); }));
  $('[data-action="deploy"]')?.addEventListener('click', deploy);
  $('[data-action="new-target"]')?.addEventListener('click', () => targetDialog());
}

async function saveConfiguration(event) {
  event.preventDefault();
  if (!state.targetId) return toast('Select a target profile first');
  const configuration = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await api(`/api/configurations/${state.service}/${state.backend}/${state.targetId}`, { method: 'PUT', body: JSON.stringify(configuration) });
    state.configuration = configuration;
    toast('Configuration saved');
  } catch (error) { toast(error.message); }
}

async function loadConfiguration() {
  if (!state.targetId) { state.configuration = {}; return; }
  try { state.configuration = (await api(`/api/configurations/${state.service}/${state.backend}/${state.targetId}`)).configuration; }
  catch (error) { toast(error.message); }
}

async function deploy() {
  if (!state.targetId) return toast('Select a target profile first');
  try {
    const result = await api('/api/deployments', { method: 'POST', body: JSON.stringify({ service: state.service, backend: state.backend, targetId: state.targetId }) });
    toast('Deployment started');
    state.page = 'job'; state.selectedJob = result.id;
    await refresh();
    pollJob(result.id);
  } catch (error) { toast(error.message); }
}

async function pollJob(id) {
  const result = await api(`/api/jobs/${id}`);
  state.jobs = await api('/api/jobs');
  if (['running', 'queued'].includes(result.status)) {
    render();
    setTimeout(() => pollJob(id).catch((error) => toast(error.message)), 1200);
  } else { render(); toast(result.status === 'succeeded' ? 'Deployment completed' : 'Deployment failed'); }
}

function renderTargets() {
  const cards = state.targets.map((target) => `<article class="target-card"><span class="service-symbol">${target.backend === 'k3s' ? 'K3' : 'DK'}</span><div class="target-details"><strong>${escapeHtml(target.name)}</strong><small>${escapeHtml(target.backend.toUpperCase())} · ${escapeHtml(target.backend === 'k3s' ? target.apiServer : `${target.user}@${target.host}`)}</small></div><span class="tag">${escapeHtml(target.id)}</span><div class="actions"><button class="button" data-edit-target="${escapeHtml(target.id)}">Edit</button><button class="button danger" data-delete-target="${escapeHtml(target.id)}">Remove</button></div></article>`).join('');
  $('#content').innerHTML = `<div class="page-heading"><div><div class="eyebrow">CONTROL PLANE / CONNECTIONS</div><h1>Target profiles</h1><p>Manage the Docker hosts and K3s clusters available to service deployments.</p></div><button class="button primary" data-action="new-target">＋ Add target</button></div><div class="section-title"><h2>Saved targets</h2><span class="hint">Credentials are references to mounted secret files</span></div><div class="target-grid">${cards || '<div class="empty-state">No target profiles yet. Add a Docker host or K3s cluster to get started.</div>'}</div>`;
  $('[data-action="new-target"]')?.addEventListener('click', () => targetDialog());
  $('#content').querySelectorAll('[data-edit-target]').forEach((button) => button.addEventListener('click', () => targetDialog(state.targets.find((item) => item.id === button.dataset.editTarget))));
  $('#content').querySelectorAll('[data-delete-target]').forEach((button) => button.addEventListener('click', async () => {
    try { await api(`/api/targets/${button.dataset.deleteTarget}`, { method: 'DELETE' }); await refresh(); toast('Target profile removed'); }
    catch (error) { toast(error.message); }
  }));
}

function targetDialog(target = {}) {
  const backend = target.backend || state.backend;
  const dockerFields = `<div class="field"><label for="target-host">SSH host</label><input id="target-host" name="host" required value="${escapeHtml(target.host || '')}" placeholder="192.168.0.10"></div><div class="field"><label for="target-user">SSH user</label><input id="target-user" name="user" required value="${escapeHtml(target.user || 'root')}"></div><div class="field"><label for="target-key">SSH key secret file</label><input id="target-key" name="keySecret" value="${escapeHtml(target.keySecret || 'id_home_lab')}"></div><div class="field"><label for="target-known-hosts">SSH known hosts secret file</label><input id="target-known-hosts" name="knownHostsSecret" value="${escapeHtml(target.knownHostsSecret || 'known_hosts')}"><span class="field-hint">Pinned SSH host keys; unknown keys are rejected.</span></div>`;
  const k3sFields = `<div class="field full"><label for="target-api">K3s API endpoint</label><input id="target-api" name="apiServer" required value="${escapeHtml(target.apiServer || '')}" placeholder="https://192.168.0.20:6443"></div><div class="field"><label for="target-ca">CA secret file</label><input id="target-ca" name="caSecret" value="${escapeHtml(target.caSecret || 'k3s-ca.crt')}"></div><div class="field"><label for="target-token">Token secret file</label><input id="target-token" name="tokenSecret" value="${escapeHtml(target.tokenSecret || 'k3s-token')}"></div>`;
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="target-title"><h2 id="target-title">${target.id ? 'Edit target profile' : 'Add target profile'}</h2><form id="target-form"><div class="field-grid"><div class="field"><label for="target-name">Name</label><input id="target-name" name="name" required value="${escapeHtml(target.name || '')}" placeholder="Production K3s"></div><div class="field"><label for="target-id">Identifier</label><input id="target-id" name="id" required pattern="[a-z0-9][a-z0-9-]{0,62}" ${target.id ? 'readonly' : ''} value="${escapeHtml(target.id || '')}" placeholder="production-k3s"></div><div class="field full"><label for="target-backend">Backend</label><select id="target-backend" name="backend"><option value="docker" ${backend === 'docker' ? 'selected' : ''}>Docker over SSH</option><option value="k3s" ${backend === 'k3s' ? 'selected' : ''}>K3s cluster</option></select></div><div id="backend-fields" class="field-grid full">${backend === 'k3s' ? k3sFields : dockerFields}</div></div><div class="modal-actions"><span class="subtle">No secret values are entered in the panel.</span><div><button class="button ghost" type="button" data-action="cancel">Cancel</button><button class="button primary" type="submit">Save target</button></div></div></form></section>`;
  document.body.append(overlay);
  const form = $('#target-form', overlay);
  $('#target-backend', form).addEventListener('change', (event) => { $('#backend-fields', form).innerHTML = event.target.value === 'k3s' ? k3sFields : dockerFields; });
  $('[data-action="cancel"]', overlay).addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const profile = Object.fromEntries(new FormData(form).entries());
      await api('/api/targets', { method: 'PUT', body: JSON.stringify(profile) });
      overlay.remove(); await refresh(); toast('Target profile saved');
    } catch (error) { toast(error.message); }
  });
}

function renderJobs() {
  const rows = state.jobs.map((job) => `<button class="job-row" data-job="${escapeHtml(job.id)}"><span class="service-symbol">${escapeHtml(idSymbol(job.serviceName || job.service))}</span><span class="job-details"><strong>${escapeHtml(job.serviceName || job.service)} · ${escapeHtml(job.backend.toUpperCase())}</strong><small>${escapeHtml(job.targetId)} · ${escapeHtml(job.stage)} · ${new Date(job.createdAt).toLocaleString()}</small></span><span class="job-status ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span></button>`).join('');
  $('#content').innerHTML = `<div class="page-heading"><div><div class="eyebrow">CONTROL PLANE / ACTIVITY</div><h1>Deployment jobs</h1><p>Review current deployment progress, results, and logs.</p></div></div><div class="job-list">${rows || '<div class="empty-state">No deployment jobs yet. Saved configurations will appear here after you deploy a service.</div>'}</div>`;
  $('#content').querySelectorAll('[data-job]').forEach((button) => button.addEventListener('click', () => { state.selectedJob = button.dataset.job; state.page = 'job'; render(); }));
}

function renderJob() {
  const job = state.jobs.find((item) => item.id === state.selectedJob);
  if (!job) { state.page = 'jobs'; return renderJobs(); }
  $('#content').innerHTML = `<div class="page-heading"><div><div class="eyebrow">CONTROL PLANE / JOB ${escapeHtml(job.id.slice(0, 8).toUpperCase())}</div><h1>${escapeHtml(job.serviceName || job.service)} deployment</h1><p>${escapeHtml(job.backend.toUpperCase())} · ${escapeHtml(job.targetId)} · started ${new Date(job.createdAt).toLocaleString()}</p></div><span class="job-status ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span></div><div class="panel-card" style="padding:16px;margin-bottom:14px"><div class="section-title"><h2>${escapeHtml(job.stage)}</h2><span class="hint">${job.finishedAt ? `Finished ${new Date(job.finishedAt).toLocaleString()}` : 'Deployment in progress'}</span></div></div><div class="section-title"><h2>Job logs</h2><button class="button" data-action="back-jobs">Back to history</button></div><pre class="logs">${escapeHtml(job.logs || 'Waiting for output…')}</pre>`;
  $('[data-action="back-jobs"]')?.addEventListener('click', () => { state.page = 'jobs'; render(); });
}

function render() {
  updateNavigation();
  if (state.page === 'services') renderServices();
  else if (state.page === 'targets') renderTargets();
  else if (state.page === 'jobs') renderJobs();
  else renderJob();
}

async function refresh() {
  const next = await api('/api/state');
  state.services = next.services; state.backends = next.backends; state.targets = next.targets; state.jobs = next.jobs;
  if (!state.services.some((item) => item.id === state.service)) state.service = state.services[0]?.id;
  if (!targetsForBackend().some((target) => target.id === state.targetId)) state.targetId = targetsForBackend()[0]?.id || '';
  if (state.page === 'services') await loadConfiguration();
  render();
}

document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = button.dataset.page; render(); }));
refresh().catch((error) => { $('#content').innerHTML = `<div class="notice">Unable to load the panel: ${escapeHtml(error.message)}</div>`; });
setInterval(async () => {
  if (state.page === 'job' || state.page === 'jobs') {
    try { state.jobs = await api('/api/jobs'); render(); } catch { /* The current view remains usable during a brief polling error. */ }
  }
}, 4000);
