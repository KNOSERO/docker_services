'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const api = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
};

const nav = { services: 'Services', targets: 'Target profiles', jobs: 'Deployment jobs', job: 'Job details' };
const initials = (name) => name.slice(0, 2).toUpperCase();

export default function Home() {
  const [data, setData] = useState({ services: [], targets: [], jobs: [] });
  const [page, setPage] = useState('services');
  const [serviceId, setServiceId] = useState('postgresql');
  const [backend, setBackend] = useState('docker');
  const [targetId, setTargetId] = useState('local');
  const [configuration, setConfiguration] = useState({});
  const [selectedJob, setSelectedJob] = useState('');
  const [targetDraft, setTargetDraft] = useState(null);
  const [notice, setNotice] = useState('');
  const service = data.services.find((item) => item.id === serviceId);
  const targets = useMemo(() => data.targets.filter((target) => target.backend === backend), [backend, data.targets]);
  const selectedTarget = targets.find((target) => target.id === targetId) || targets[0];

  const refresh = useCallback(async () => setData(await api('/api/state')), []);
  const toast = (message) => { setNotice(message); setTimeout(() => setNotice(''), 2400); };

  useEffect(() => { refresh().catch((error) => toast(`Unable to load the panel: ${error.message}`)); }, [refresh]);
  useEffect(() => {
    if (!targets.some((target) => target.id === targetId)) setTargetId(targets[0]?.id || '');
  }, [backend, data.targets, targetId, targets]);
  useEffect(() => {
    if (page !== 'services' || !service || !targetId) { setConfiguration({}); return; }
    let current = true;
    setConfiguration({});
    api(`/api/configurations/${serviceId}/${backend}/${targetId}`).then(({ configuration: value }) => { if (current) setConfiguration(value); }).catch((error) => { if (current) toast(error.message); });
    return () => { current = false; };
  }, [page, serviceId, backend, targetId, service]);
  useEffect(() => {
    if (page !== 'jobs' && page !== 'job') return;
    const timer = setInterval(() => api('/api/jobs').then((jobs) => setData((current) => ({ ...current, jobs }))).catch(() => {}), 4000);
    return () => clearInterval(timer);
  }, [page]);

  async function submitConfiguration(event) {
    event.preventDefault();
    const value = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await api(`/api/configurations/${serviceId}/${backend}/${targetId}`, { method: 'PUT', body: JSON.stringify(value) });
      setConfiguration(value); toast('Configuration saved');
    } catch (error) { toast(error.message); }
  }

  async function deploy() {
    try {
      const result = await api('/api/deployments', { method: 'POST', body: JSON.stringify({ service: serviceId, backend, targetId }) });
      setSelectedJob(result.id); setPage('job'); await refresh();
      const poll = async () => {
        const job = await api(`/api/jobs/${result.id}`);
        await refresh();
        if (['running', 'queued'].includes(job.status)) setTimeout(() => poll().catch((error) => toast(error.message)), 1200);
        else toast(job.status === 'succeeded' ? 'Deployment completed' : 'Deployment failed');
      };
      setTimeout(() => poll().catch((error) => toast(error.message)), 1200);
      toast('Deployment started');
    } catch (error) { toast(error.message); }
  }

  async function saveTarget(event) {
    event.preventDefault();
    try {
      await api('/api/targets', { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
      setTargetDraft(null); await refresh(); toast('Target profile saved');
    } catch (error) { toast(error.message); }
  }

  const heading = {
    services: ['CONTROL PLANE / SERVICES', 'Service deployments', 'Configure and deploy services to Docker hosts and K3s clusters.'],
    targets: ['CONTROL PLANE / CONNECTIONS', 'Target profiles', 'Manage the Docker hosts and K3s clusters available to service deployments.'],
    jobs: ['CONTROL PLANE / ACTIVITY', 'Deployment jobs', 'Review current deployment progress, results, and logs.'],
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#services" aria-label="Services Control Panel home"><span className="brand-mark">S</span><span><strong>services</strong><small>CONTROL PANEL</small></span></a>
      <div className="nav-label">WORKSPACE</div>
      <nav className="navigation" aria-label="Main navigation">
        {Object.entries(nav).filter(([key]) => key !== 'job').map(([key, label]) => <button key={key} className={`nav-item ${page === key || (key === 'jobs' && page === 'job') ? 'active' : ''}`} onClick={() => setPage(key)}><span className="nav-icon">{key === 'services' ? '◈' : key === 'targets' ? '⌘' : '↗'}</span>{label}{key === 'services' && <span className="nav-count">{data.services.length}</span>}{key === 'jobs' && <span className="nav-count">{data.jobs.length}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="connection"><span className="pulse"/><span>Controller online</span><code>127.0.0.1:6868</code></div><div className="profile"><div className="avatar">OP</div><div><strong>Operator</strong><small>Local instance</small></div><span className="profile-menu">···</span></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{nav[page]}</strong></div><div className="top-actions"><span className="environment"><i/>LOCAL</span></div></header>
      <div className="page-content" aria-live="polite">
        {page === 'services' && service && <>
          <div className="page-heading"><div><div className="eyebrow">{heading.services[0]}</div><h1>{heading.services[1]}</h1><p>{heading.services[2]}</p></div><button className="button" onClick={() => setTargetDraft({ backend })}>＋ Add target</button></div>
          <section className="stats"><div className="stat-card"><span>Managed services</span><strong>{data.services.length}<small>available</small></strong></div><div className="stat-card"><span>Target profiles</span><strong>{data.targets.length}<small>configured</small></strong></div><div className="stat-card"><span>Deployment jobs</span><strong>{data.jobs.length}<small>total</small></strong></div><div className="stat-card"><span>Controller</span><strong style={{ color: 'var(--green)' }}>Ready<small>local</small></strong></div></section>
          <div className="section-title"><h2>Services</h2><span className="hint">Choose a service to edit its deployment configuration</span></div>
          <div className="service-layout"><section className="service-list" aria-label="Services">{data.services.map((item) => <button key={item.id} className={`service-row ${item.id === serviceId ? 'selected' : ''}`} onClick={() => setServiceId(item.id)}><span className="service-symbol">{initials(item.name)}</span><span className="service-info"><strong>{item.name}</strong><small>{item.description}</small></span><span className="service-meta"><span className="tag available">Docker</span><span className="tag available">K3s</span></span></button>)}</section>
            <section className="panel-card service-form"><div className="form-heading"><span className="service-symbol">{initials(service.name)}</span><div><h2>{service.name}</h2><p>{service.description}</p></div><div className="form-controls"><select aria-label="Target profile" value={selectedTarget?.id || ''} onChange={(event) => setTargetId(event.target.value)}>{targets.length ? targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>) : <option value="">Add a target profile</option>}</select><div className="backend-choice">{['docker', 'k3s'].map((item) => <button key={item} className={backend === item ? 'active' : ''} onClick={() => setBackend(item)}>{item.toUpperCase()}</button>)}</div></div></div>
              {selectedTarget ? <form key={`${serviceId}-${backend}-${targetId}`} onSubmit={submitConfiguration}><div className="field-grid">{service.fields.filter(([, , , fieldBackend]) => !fieldBackend || fieldBackend === backend).map(([key, label, fallback]) => <div className="field" key={key}><label htmlFor={`field-${key}`}>{label}</label>{key === 'ingressEnabled' || key === 'protocol' ? <select id={`field-${key}`} name={key} value={configuration[key] ?? fallback} onChange={(event) => setConfiguration((current) => ({ ...current, [key]: event.target.value }))}><option value={key === 'protocol' ? 'udp' : 'false'}>{key === 'protocol' ? 'UDP' : 'Disabled'}</option><option value={key === 'protocol' ? 'tcp' : 'true'}>{key === 'protocol' ? 'TCP' : 'Enabled'}</option></select> : <input id={`field-${key}`} name={key} autoComplete="off" value={configuration[key] ?? fallback} onChange={(event) => setConfiguration((current) => ({ ...current, [key]: event.target.value }))}/>}</div>)}</div><div className="form-actions"><span className="left">Saved per service · backend · target</span><div className="right"><button className="button secondary" type="submit">Save configuration</button><button className="button primary" type="button" onClick={deploy}>↗ Deploy service</button></div></div></form> : <div className="notice">Create a target profile for this backend before editing or deploying a service.</div>}
              {backend === 'k3s' && <div className="notice">Cluster credentials are loaded from mounted secrets. Secret values are never shown or stored in this form.</div>}
            </section></div>
        </>}
        {page === 'targets' && <><div className="page-heading"><div><div className="eyebrow">{heading.targets[0]}</div><h1>{heading.targets[1]}</h1><p>{heading.targets[2]}</p></div><button className="button primary" onClick={() => setTargetDraft({ backend })}>＋ Add target</button></div><div className="section-title"><h2>Saved targets</h2><span className="hint">Credentials are references to mounted secret files</span></div><div className="target-grid">{data.targets.length ? data.targets.map((target) => <article className="target-card" key={target.id}><span className="service-symbol">{target.backend === 'k3s' ? 'K3' : 'DK'}</span><div className="target-details"><strong>{target.name}</strong><small>{target.backend.toUpperCase()} · {target.backend === 'k3s' ? target.apiServer : `${target.user}@${target.host}`}</small></div><span className="tag">{target.id}</span><div className="actions"><button className="button" onClick={() => setTargetDraft(target)}>Edit</button><button className="button danger" onClick={async () => { try { await api(`/api/targets/${target.id}`, { method: 'DELETE' }); await refresh(); toast('Target profile removed'); } catch (error) { toast(error.message); } }}>Remove</button></div></article>) : <div className="empty-state">No target profiles yet. Add a Docker host or K3s cluster to get started.</div>}</div></>}
        {(page === 'jobs' || page === 'job') && (page === 'jobs' ? <><div className="page-heading"><div><div className="eyebrow">{heading.jobs[0]}</div><h1>{heading.jobs[1]}</h1><p>{heading.jobs[2]}</p></div></div><div className="job-list">{data.jobs.length ? data.jobs.map((job) => <button key={job.id} className="job-row" onClick={() => { setSelectedJob(job.id); setPage('job'); }}><span className="service-symbol">{initials(job.serviceName || job.service)}</span><span className="job-details"><strong>{job.serviceName || job.service} · {job.backend.toUpperCase()}</strong><small>{job.targetId} · {job.stage} · {new Date(job.createdAt).toLocaleString()}</small></span><span className={`job-status ${job.status}`}>{job.status}</span></button>) : <div className="empty-state">No deployment jobs yet. Saved configurations will appear here after you deploy a service.</div>}</div></> : (() => { const job = data.jobs.find((item) => item.id === selectedJob); return job ? <><div className="page-heading"><div><div className="eyebrow">CONTROL PLANE / JOB {job.id.slice(0, 8).toUpperCase()}</div><h1>{job.serviceName || job.service} deployment</h1><p>{job.backend.toUpperCase()} · {job.targetId} · started {new Date(job.createdAt).toLocaleString()}</p></div><span className={`job-status ${job.status}`}>{job.status}</span></div><div className="panel-card job-summary"><div className="section-title"><h2>{job.stage}</h2><span className="hint">{job.finishedAt ? `Finished ${new Date(job.finishedAt).toLocaleString()}` : 'Deployment in progress'}</span></div></div><div className="section-title"><h2>Job logs</h2><button className="button" onClick={() => setPage('jobs')}>Back to history</button></div><pre className="logs">{job.logs || 'Waiting for output…'}</pre></> : <div className="empty-state">Job not found.</div>; })())}
      </div>
    </main>
    {targetDraft && <TargetDialog key={targetDraft.id || 'new'} target={targetDraft} onClose={() => setTargetDraft(null)} onSubmit={saveTarget}/>}
    {notice && <div className="toast show" role="status">{notice}</div>}
  </div>;
}

function TargetDialog({ target, onClose, onSubmit }) {
  const [backend, setBackend] = useState(target.backend || 'docker');
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="target-title"><h2 id="target-title">{target.id ? 'Edit target profile' : 'Add target profile'}</h2><form onSubmit={onSubmit}><div className="field-grid"><div className="field"><label htmlFor="target-name">Name</label><input id="target-name" name="name" required defaultValue={target.name || ''} placeholder="Production K3s"/></div><div className="field"><label htmlFor="target-id">Identifier</label><input id="target-id" name="id" required pattern="[a-z0-9][a-z0-9-]{0,62}" readOnly={Boolean(target.id)} defaultValue={target.id || ''} placeholder="production-k3s"/></div><div className="field full"><label htmlFor="target-backend">Backend</label><select id="target-backend" name="backend" value={backend} onChange={(event) => setBackend(event.target.value)}><option value="docker">Docker over SSH</option><option value="k3s">K3s cluster</option></select></div>
    {backend === 'k3s' ? <><div className="field full"><label htmlFor="target-api">K3s API endpoint</label><input id="target-api" name="apiServer" required defaultValue={target.apiServer || ''} placeholder="https://192.168.0.20:6443"/></div><div className="field"><label htmlFor="target-ca">CA secret file</label><input id="target-ca" name="caSecret" defaultValue={target.caSecret || 'k3s-ca.crt'}/></div><div className="field"><label htmlFor="target-token">Token secret file</label><input id="target-token" name="tokenSecret" defaultValue={target.tokenSecret || 'k3s-token'}/></div></> : <><div className="field"><label htmlFor="target-host">SSH host</label><input id="target-host" name="host" required defaultValue={target.host || ''} placeholder="192.168.0.10"/></div><div className="field"><label htmlFor="target-user">SSH user</label><input id="target-user" name="user" required defaultValue={target.user || 'root'}/></div><div className="field"><label htmlFor="target-key">SSH key secret file</label><input id="target-key" name="keySecret" defaultValue={target.keySecret || 'id_home_lab'}/></div><div className="field"><label htmlFor="target-known-hosts">SSH known hosts secret file</label><input id="target-known-hosts" name="knownHostsSecret" defaultValue={target.knownHostsSecret || 'known_hosts'}/><span className="field-hint">Pinned SSH host keys; unknown keys are rejected.</span></div></>}
    </div><div className="modal-actions"><span className="subtle">No secret values are entered in the panel.</span><div><button className="button ghost" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="submit">Save target</button></div></div></form></section></div>;
}
