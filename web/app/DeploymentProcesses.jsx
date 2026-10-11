'use client';

import { useState } from 'react';

const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
};
const weekdays = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
const slug = (value) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63);
const targetName = (targets, id) => targets.find((target) => target.id === id)?.name || 'Profil niedostępny';
const date = (value) => value ? new Date(value).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }) : '—';
const statusClass = (status) => status === 'succeeded' ? 'scheduled' : ['failed', 'skipped'].includes(status) ? 'failed' : 'manual';
const statusLabel = (status) => ({ succeeded: 'Sukces', failed: 'Niepowodzenie', skipped: 'Pominięte', running: 'W trakcie', queued: 'W kolejce' })[status] || status;

export default function DeploymentProcesses({ data, onRefresh, onToast }) {
  const [view, setView] = useState('processes');
  const [selectedId, setSelectedId] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const processes = data.processes || [];
  const targets = data.targets || [];
  const runs = data.jobs || [];
  const selected = processes.find((item) => item.id === selectedId) || processes[0];
  const selectedRun = runs.find((item) => item.id === selectedRunId) || runs[0];

  async function saveProcess(value) {
    try {
      const editing = Boolean(draft?.id);
      const result = await request(editing ? `/api/processes/${draft.id}` : '/api/processes', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(value),
      });
      await onRefresh();
      setSelectedId(result.process.id);
      setDraft(null);
      setView('processes');
      onToast(editing ? 'Proces zapisany' : 'Proces dodany');
    } catch (error) { onToast(error.message); }
  }

  async function runProcess(process) {
    try {
      const result = await request(`/api/processes/${process.id}/runs`, { method: 'POST', body: '{}' });
      setSelectedRunId(result.id);
      setView('history');
      onRefresh();
      onToast('Uruchomienie rozpoczęte');
    } catch (error) { onToast(error.message); }
  }

  async function deleteProcess(process) {
    if (!window.confirm(`Usunąć proces „${process.name}”? Historia uruchomień pozostanie.`)) return;
    try { await request(`/api/processes/${process.id}`, { method: 'DELETE' }); await onRefresh(); onToast('Proces usunięty'); }
    catch (error) { onToast(error.message); }
  }

  const heading = view === 'processes'
    ? ['Procesy wdrożeniowe', 'Zapisane konfiguracje i ich harmonogramy.']
    : view === 'servers'
      ? ['Serwery', 'Profile połączeń przypisane do procesów.']
      : ['Historia uruchomień', 'Ręczne i automatyczne wdrożenia wraz z konsolą.'];

  return <section className="pp-root">
    <div className="pp-heading">
      <div><div className="pp-eyebrow">KONTROLA WDROŻEŃ / {view === 'processes' ? 'PROCESY' : view === 'servers' ? 'SERWERY' : 'HISTORIA'}</div><h1>{heading[0]}</h1><p>{heading[1]}</p></div>
      {view === 'processes' && <div className="pp-add-wrap">
        <button className="pp-add" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>＋ Dodaj <span>⌄</span></button>
        {menuOpen && <div className="pp-add-menu"><button type="button" onClick={() => { setMenuOpen(false); setDraft({}); }}>◈ <span><strong>Proces wdrożenia</strong><small>Utwórz konfigurację i wybierz serwer</small></span></button></div>}
      </div>}
    </div>
    <nav className="pp-tabs" aria-label="Widoki wdrożeń">
      {[['processes', 'Procesy', processes.length], ['servers', 'Serwery', targets.length], ['history', 'Historia', runs.length]].map(([key, label, count]) => <button key={key} type="button" className={view === key ? 'active' : ''} onClick={() => { setView(key); setMenuOpen(false); }}>{label}<span>{count}</span></button>)}
    </nav>
    {view === 'processes' && <div className="pp-variant pp-variant-a">
      <div className="pp-variant-intro"><div><h2>Wszystkie procesy</h2><p>Każdy proces przechowuje własne ustawienia.</p></div><span className="pp-count">{processes.length} zapisane</span></div>
      <div className="pp-split-table"><div className="pp-list-panel">{processes.map((process) => <button key={process.id} type="button" className={'pp-process-row' + (selected?.id === process.id ? ' selected' : '')} onClick={() => setSelectedId(process.id)}>
        <span className="pp-service-mark">{process.service.slice(0, 2).toUpperCase()}</span><span className="pp-process-name"><strong>{process.name}</strong><small>{process.backend.toUpperCase()} · {targetName(targets, process.targetId)}</small></span><span className={'pp-status ' + (process.schedule ? 'scheduled' : 'manual')}>{process.schedule ? 'Harmonogram' : 'Ręczny'}</span>
      </button>)}{!processes.length && <div className="pp-empty">Nie ma jeszcze zapisanych procesów. Wybierz „＋ Dodaj”, aby utworzyć pierwszy.</div>}</div>
      <div className="pp-detail-panel">{selected ? <article className="pp-inspector">
        <div className="pp-inspector-head"><div><div className="pp-eyebrow">ZAPISANY PROCES</div><h2>{selected.name}</h2><p>{data.services.find((item) => item.id === selected.service)?.name || selected.service} · {selected.backend.toUpperCase()}</p></div><span className={'pp-status ' + (selected.schedule ? 'scheduled' : 'manual')}>{selected.schedule ? 'Aktywny' : 'Ręczny'}</span></div>
        <div className="pp-summary-grid"><div><small>Serwer</small><strong>{targetName(targets, selected.targetId)}</strong></div><div><small>Obraz</small><strong className="pp-mono">{selected.configuration.image || '—'}</strong></div><div><small>Port</small><strong className="pp-mono">{Object.entries(selected.configuration).filter(([key]) => /port$/i.test(key)).map(([, value]) => value).join(', ') || '—'}</strong></div><div><small>Harmonogram</small><strong>{selected.schedule ? `${selected.schedule.days.map((day) => weekdays[day - 1]).join(', ')} · ${selected.schedule.time}` : 'Tylko ręcznie'}</strong></div></div>
        <div className="pp-schedule-note">{selected.schedule ? 'Europe/Warsaw · zaległe terminy są pomijane' : 'Ten proces nie ma harmonogramu.'}</div>
        <div className="pp-inspector-actions"><button type="button" className="pp-button" onClick={() => runProcess(selected)}>▶ Uruchom teraz</button><button type="button" className="pp-button ghost" onClick={() => setDraft(selected)}>Edytuj</button><button type="button" className="pp-button ghost" onClick={() => deleteProcess(selected)}>Usuń</button><span>Aktualizacja: {date(selected.updatedAt)}</span></div>
      </article> : <div className="pp-empty">Wybierz proces, aby zobaczyć szczegóły.</div>}</div></div>
    </div>}
    {view === 'servers' && <div className="pp-server-table"><div className="pp-table-head"><span>PROFIL</span><span>BACKEND / ADRES</span><span>PROCESY</span></div>{targets.map((target) => <div className="pp-server-row" key={target.id}><strong>{target.name}</strong><span>{target.backend.toUpperCase()} · {target.backend === 'k3s' ? target.apiServer : `${target.user}@${target.host}`}</span><b>{processes.filter((process) => process.targetId === target.id).length}</b></div>)}{!targets.length && <div className="pp-empty">Dodaj serwer podczas tworzenia procesu wdrożenia.</div>}<p>Usunięcie serwera używanego przez proces jest zablokowane.</p></div>}
    {view === 'history' && <div className="pp-history-table"><div className="pp-table-head"><span>PROCES / USŁUGA</span><span>CEL</span><span>RODZAJ</span><span>STATUS</span><span>START</span></div>{runs.map((run) => <button key={run.id} type="button" className={'pp-history-row' + (selectedRun?.id === run.id ? ' selected' : '')} onClick={() => setSelectedRunId(run.id)}><strong>{run.processName || run.serviceName || run.service}</strong><span>{targetName(targets, run.targetId)}</span><span>{run.trigger === 'scheduled' ? 'Automatyczne' : run.trigger === 'manual' ? 'Ręczne' : 'Wdrożenie'}</span><span className={'pp-status ' + statusClass(run.status)}>{statusLabel(run.status)}</span><time>{date(run.createdAt)}</time></button>)}{!runs.length && <div className="pp-empty">Brak uruchomień do wyświetlenia.</div>}{selectedRun && <div className="pp-console"><div className="pp-console-head"><div><span>KONSOLA / {selectedRun.id.slice(0, 8).toUpperCase()}</span><strong>{selectedRun.processName || selectedRun.serviceName || selectedRun.service}</strong></div><span className={'pp-status ' + statusClass(selectedRun.status)}>{statusLabel(selectedRun.status)}</span></div><pre>{selectedRun.logs || selectedRun.stage || 'Oczekiwanie na wynik…'}</pre></div>}</div>}
    {draft && <ProcessDialog key={draft.id || 'new'} draft={draft} data={data} onClose={() => setDraft(null)} onSave={saveProcess} onError={onToast}/>}
  </section>;
}

function ProcessDialog({ draft, data, onClose, onSave, onError }) {
  const services = data.services || [];
  const [name, setName] = useState(draft.name || '');
  const [service, setService] = useState(draft.service || services[0]?.id || '');
  const [backend, setBackend] = useState(draft.backend || 'docker');
  const [targetId, setTargetId] = useState(draft.targetId || data.targets.find((target) => target.backend === (draft.backend || 'docker'))?.id || '');
  const [configuration, setConfiguration] = useState(draft.configuration || {});
  const [scheduleEnabled, setScheduleEnabled] = useState(Boolean(draft.schedule));
  const [days, setDays] = useState(draft.schedule?.days || [1, 3, 5]);
  const [time, setTime] = useState(draft.schedule?.time || '03:30');
  const [addTarget, setAddTarget] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverHost, setServerHost] = useState('');
  const matchingTargets = data.targets.filter((target) => target.backend === backend);
  const definition = services.find((item) => item.id === service);
  const fields = definition?.fieldsByBackend?.[backend] || [];

  function changeService(value) { setService(value); request(`/api/defaults/${value}/${backend}`).then((result) => setConfiguration(result.configuration)).catch((error) => onError(error.message)); }
  function changeBackend(value) { setBackend(value); setTargetId(data.targets.find((target) => target.backend === value)?.id || ''); request(`/api/defaults/${service}/${value}`).then((result) => setConfiguration(result.configuration)).catch((error) => onError(error.message)); }
  function submit(event) {
    event.preventDefault();
    const target = addTarget ? backend === 'k3s'
      ? { id: slug(serverName), name: serverName.trim(), backend, apiServer: serverHost.trim(), caSecret: 'k3s-ca.crt', tokenSecret: 'k3s-token' }
      : { id: slug(serverName), name: serverName.trim(), backend, host: serverHost.trim(), user: 'root', keySecret: 'id_home_lab', knownHostsSecret: 'known_hosts' }
      : undefined;
    const editableConfiguration = Object.fromEntries(fields.map(([key, , fallback]) => [key, configuration[key] ?? fallback]));
    onSave({ name: name.trim(), service, backend, targetId, ...(target ? { target } : {}), configuration: editableConfiguration, schedule: scheduleEnabled ? { days, time, timezone: 'Europe/Warsaw' } : null });
  }

  return <div className="pp-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-modal-title">
    <div className="pp-modal-head"><div><div className="pp-eyebrow">{draft.id ? 'EDYCJA PROCESU' : 'NOWY ZAPISANY PROCES'}</div><h2 id="pp-modal-title">Proces wdrożenia</h2><p>Nowe ustawienia zaczynają się od wspólnych wartości domyślnych.</p></div><button type="button" aria-label="Zamknij" onClick={onClose}>×</button></div>
    <form onSubmit={submit}><div className="pp-form-grid">
      <label className="pp-field pp-full">Nazwa procesu<input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Np. PostgreSQL · produkcja"/></label>
      <label className="pp-field">Usługa<select value={service} onChange={(event) => changeService(event.target.value)}>{services.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label className="pp-field">Backend<select value={backend} onChange={(event) => changeBackend(event.target.value)}><option value="docker">Docker</option><option value="k3s">K3s</option></select></label>
      <label className="pp-field pp-full">Profil serwera<select value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={addTarget}><option value="">Wybierz profil</option>{matchingTargets.map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}</select></label>
      <div className="pp-target-add pp-full"><label><input type="checkbox" checked={addTarget} onChange={(event) => setAddTarget(event.target.checked)}/> Dodaj nowy serwer w tym formularzu</label>{addTarget && <div className="pp-form-grid pp-nested"><label className="pp-field">Nazwa serwera<input required value={serverName} onChange={(event) => setServerName(event.target.value)} placeholder="np. produkcja"/></label><label className="pp-field">{backend === 'k3s' ? 'Adres API klastra' : 'Host SSH'}<input required value={serverHost} onChange={(event) => setServerHost(event.target.value)} placeholder={backend === 'k3s' ? 'https://192.168.0.20:6443' : '192.168.0.10'}/></label><p className="pp-full">Dane dostępowe są pobierane z plików sekretów skonfigurowanych na hoście.</p></div>}</div>
      <div className="pp-default-note pp-full"><span>✳</span><div><strong>Własna konfiguracja procesu</strong><small>Proces przechowuje własne wartości. Zmiany ustawień usługi i nadpisań serwera go nie zmienią.</small></div></div>
      {fields.map(([key, label, fallback, , type = 'text']) => <label className="pp-field" key={key}>{label}<input type={type} min={type === 'number' ? 1 : undefined} max={type === 'number' ? 65535 : undefined} value={configuration[key] ?? fallback} onChange={(event) => setConfiguration((current) => ({ ...current, [key]: event.target.value }))}/></label>)}
      <div className="pp-schedule-box pp-full"><label className="pp-schedule-toggle"><input type="checkbox" checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)}/><span><strong>Uruchamiaj według harmonogramu</strong><small>Harmonogram jest opcjonalny; proces można też uruchomić ręcznie.</small></span></label>
        {scheduleEnabled && <div className="pp-schedule-fields"><div className="pp-day-picker">{weekdays.map((day, index) => <label key={day} className={days.includes(index + 1) ? 'selected' : ''}><input type="checkbox" checked={days.includes(index + 1)} onChange={() => setDays((current) => current.includes(index + 1) ? current.filter((item) => item !== index + 1) : [...current, index + 1])}/>{day}</label>)}</div><label className="pp-time-field">Godzina<input required type="time" value={time} onChange={(event) => setTime(event.target.value)}/><small>Europe/Warsaw · zaległe terminy są pomijane</small></label></div>}
      </div>
    </div><div className="pp-modal-actions"><span>ODŚWIEŻ OBRAZ I WDRAŻAJ</span><div><button type="button" className="pp-button ghost" onClick={onClose}>Anuluj</button><button type="submit" className="pp-button" disabled={scheduleEnabled && !days.length}>Zapisz proces</button></div></div></form>
  </section></div>;
}
