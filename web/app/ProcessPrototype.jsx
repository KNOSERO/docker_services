'use client';

import { useEffect, useState } from 'react';

const INITIAL_TARGETS = [
  { id: 'onyx-k3s', name: 'Onyx · K3s', backend: 'k3s', endpoint: '192.168.0.2:6443' },
  { id: 'ruby-docker', name: 'Ruby · Docker', backend: 'docker', endpoint: 'rav@ruby' },
  { id: 'local-docker', name: 'Lokalny Docker', backend: 'docker', endpoint: 'localhost' },
];

const INITIAL_PROCESSES = [
  { id: 'postgres-main', name: 'PostgreSQL · główna', service: 'PostgreSQL', backend: 'k3s', targetId: 'onyx-k3s', image: 'postgres:17', port: '5432', scheduleDays: ['Pon', 'Śr', 'Pt'], scheduleTime: '03:30', state: 'Aktywny', updated: 'Dzisiaj, 09:14' },
  { id: 'adguard-ruby', name: 'AdGuard Home · Ruby', service: 'AdGuard Home', backend: 'docker', targetId: 'ruby-docker', image: 'adguard/adguardhome:latest', port: '3000', scheduleDays: [], scheduleTime: '', state: 'Ręczny', updated: 'Wczoraj, 18:42' },
  { id: 'traefik-edge', name: 'Traefik · edge', service: 'Traefik', backend: 'docker', targetId: 'ruby-docker', image: 'traefik:v3.3', port: '80, 443', scheduleDays: ['Codziennie'], scheduleTime: '02:15', state: 'Aktywny', updated: '10 paź, 22:06' },
];

const INITIAL_RUNS = [
  { id: 'run-1048', processId: 'postgres-main', processName: 'PostgreSQL · główna', backend: 'k3s', targetId: 'onyx-k3s', kind: 'Automatyczne', status: 'Sukces', started: 'Dzisiaj, 03:30', duration: '00:01:42', logs: '03:30:00  Odczytano zapisany proces PostgreSQL · główna\n03:30:02  Sprawdzono obraz postgres:17\n03:30:18  Wdrożenie zakończone\n03:31:42  Status: sukces' },
  { id: 'run-1047', processId: 'adguard-ruby', processName: 'AdGuard Home · Ruby', backend: 'docker', targetId: 'ruby-docker', kind: 'Ręczne', status: 'Sukces', started: 'Wczoraj, 18:42', duration: '00:00:38', logs: '18:42:00  Uruchomienie ręczne\n18:42:03  Pobieranie obrazu adguard/adguardhome:latest\n18:42:26  Kontener odtworzony\n18:42:38  Status: sukces' },
  { id: 'run-1046', processId: 'traefik-edge', processName: 'Traefik · edge', backend: 'docker', targetId: 'ruby-docker', kind: 'Automatyczne', status: 'Niepowodzenie', started: '10 paź, 02:15', duration: '00:00:17', logs: '02:15:00  Odczytano zapisany proces Traefik · edge\n02:15:04  Pobieranie obrazu traefik:v3.3\n02:15:17  Błąd połączenia z rejestrem\n02:15:17  Wdrożenie przerwane przed zmianą usługi' },
];

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
const VARIANTS = [
  { key: 'A', name: 'Lista + szczegóły' },
  { key: 'B', name: 'Kokpit wdrożeń' },
  { key: 'C', name: 'Katalog procesów' },
];

const targetName = (targets, id) => targets.find((target) => target.id === id)?.name || 'Profil niedostępny';
const slug = (value) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function ProcessPrototype() {
  const [variant, setVariant] = useState('A');
  const [view, setView] = useState('processes');
  const [processes, setProcesses] = useState(INITIAL_PROCESSES);
  const [targets, setTargets] = useState(INITIAL_TARGETS);
  const [runs, setRuns] = useState(INITIAL_RUNS);
  const [selectedId, setSelectedId] = useState(INITIAL_PROCESSES[0].id);
  const [selectedRunId, setSelectedRunId] = useState(INITIAL_RUNS[0].id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('variant');
    if (VARIANTS.some((item) => item.key === requested)) setVariant(requested);
  }, []);

  const selected = processes.find((item) => item.id === selectedId) || processes[0];
  const selectedRun = runs.find((item) => item.id === selectedRunId) || runs[0];
  const changeVariant = (next) => {
    const params = new URLSearchParams(window.location.search);
    params.set('prototype', 'processes');
    params.set('variant', next);
    window.history.replaceState({}, '', window.location.pathname + '?' + params.toString());
    setVariant(next);
  };

  function addProcess(draft) {
    let nextTargets = targets;
    let targetId = draft.targetId;
    if (draft.addTarget) {
      targetId = slug(draft.targetName) || 'nowy-serwer';
      const target = { id: targetId, name: draft.targetName, backend: draft.backend, endpoint: draft.endpoint || 'Do skonfigurowania' };
      nextTargets = [...targets.filter((item) => item.id !== targetId), target];
      setTargets(nextTargets);
    }
    const process = {
      ...draft,
      id: slug(draft.name) + '-' + Date.now().toString().slice(-4),
      targetId,
      state: draft.scheduleDays.length ? 'Aktywny' : 'Ręczny',
      updated: 'Przed chwilą',
    };
    setProcesses((current) => [process, ...current]);
    setSelectedId(process.id);
    setView('processes');
    setDialogOpen(false);
  }

  function simulateRun(process) {
    const stamp = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    const run = {
      id: 'demo-' + Date.now(),
      processId: process.id,
      processName: process.name,
      backend: process.backend,
      targetId: process.targetId,
      kind: 'Ręczne · symulacja',
      status: 'Sukces',
      started: stamp,
      duration: '00:00:12',
      logs: 'PROTOTYP — nie wykonano wdrożenia rzeczywistego.\n' +
        'Odczytano proces: ' + process.name + '\n' +
        'Obraz: ' + process.image + '\n' +
        'Cel: ' + targetName(targets, process.targetId) + '\n' +
        'Symulacja: pobierz obraz i wdrażaj usługę\n' +
        'Status demonstracyjny: sukces',
    };
    setRuns((current) => [run, ...current]);
    setSelectedRunId(run.id);
    setView('history');
  }

  const title = view === 'processes' ? 'Procesy wdrożeniowe' : view === 'servers' ? 'Serwery' : 'Historia uruchomień';
  const description = view === 'processes'
    ? 'Zapisane konfiguracje i ich harmonogramy.'
    : view === 'servers'
      ? 'Profile połączeń używane przez procesy.'
      : 'Uruchomienia ręczne i automatyczne wraz z logami.';

  return <section className="pp-root">
    <div className="pp-warning"><span>PROTOTYP</span><span>Dane przykładowe · akcje są symulowane i nie wdrażają usług.</span><button type="button" onClick={() => { const params = new URLSearchParams(window.location.search); params.delete('prototype'); params.delete('variant'); window.history.replaceState({}, '', window.location.pathname + (params.size ? '?' + params.toString() : '')); window.location.reload(); }}>Wróć do panelu</button></div>
    <div className="pp-heading">
      <div><div className="pp-eyebrow">KONTROLA WDROŻEŃ / {view === 'processes' ? 'PROCESY' : view === 'servers' ? 'SERWERY' : 'HISTORIA'}</div><h1>{title}</h1><p>{description}</p></div>
      <div className="pp-add-wrap">
        <button className="pp-add" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>＋ Dodaj <span>⌄</span></button>
        {menuOpen && <div className="pp-add-menu"><button type="button" onClick={() => { setMenuOpen(false); setDialogOpen(true); }}>◈ <span><strong>Proces wdrożenia</strong><small>Utwórz konfigurację i wybierz serwer</small></span></button></div>}
      </div>
    </div>
    <nav className="pp-tabs" aria-label="Widoki procesów">
      {[['processes', 'Procesy', processes.length], ['servers', 'Serwery', targets.length], ['history', 'Historia', runs.length]].map(([key, label, count]) => <button key={key} type="button" className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}<span>{count}</span></button>)}
    </nav>
    {view === 'processes' && <>
      {variant === 'A' && <VariantA processes={processes} targets={targets} selected={selected} selectedId={selectedId} onSelect={setSelectedId} onRun={simulateRun}/>}
      {variant === 'B' && <VariantB processes={processes} targets={targets} selected={selected} selectedId={selectedId} onSelect={setSelectedId} onRun={simulateRun}/>}
      {variant === 'C' && <VariantC processes={processes} targets={targets} selected={selected} selectedId={selectedId} onSelect={setSelectedId} onRun={simulateRun}/>}
    </>}
    {view === 'servers' && <ServersView variant={variant} targets={targets} processes={processes}/>}
    {view === 'history' && <HistoryView variant={variant} runs={runs} targets={targets} selectedRun={selectedRun} selectedRunId={selectedRunId} onSelect={setSelectedRunId}/>}
    {dialogOpen && <ProcessDialog targets={targets} onClose={() => setDialogOpen(false)} onSave={addProcess}/>}
    <PrototypeSwitcher variant={variant} onChange={changeVariant}/>
  </section>;
}

function ProcessListButton({ process, target, selected, onClick }) {
  return <button type="button" className={'pp-process-row' + (selected ? ' selected' : '')} onClick={onClick}>
    <span className="pp-service-mark">{process.service.slice(0, 2).toUpperCase()}</span>
    <span className="pp-process-name"><strong>{process.name}</strong><small>{process.backend.toUpperCase()} · {target}</small></span>
    <span className={'pp-status ' + (process.scheduleDays.length ? 'scheduled' : 'manual')}>{process.scheduleDays.length ? 'Harmonogram' : 'Ręczny'}</span>
  </button>;
}

function ProcessInspector({ process, targets, onRun }) {
  if (!process) return <div className="pp-empty">Wybierz proces, aby zobaczyć szczegóły.</div>;
  return <article className="pp-inspector">
    <div className="pp-inspector-head"><div><div className="pp-eyebrow">ZAPISANY PROCES</div><h2>{process.name}</h2><p>{process.service} · {process.backend.toUpperCase()}</p></div><span className="pp-status scheduled">{process.state}</span></div>
    <div className="pp-summary-grid"><div><small>Serwer</small><strong>{targetName(targets, process.targetId)}</strong></div><div><small>Obraz</small><strong className="pp-mono">{process.image}</strong></div><div><small>Porty</small><strong className="pp-mono">{process.port || '—'}</strong></div><div><small>Harmonogram</small><strong>{process.scheduleDays.length ? process.scheduleDays.join(', ') + ' · ' + process.scheduleTime : 'Tylko ręcznie'}</strong></div></div>
    <div className="pp-schedule-note">{process.scheduleDays.length ? 'Strefa Europe/Warsaw · zaległe terminy są pomijane' : 'Ten proces nie ma harmonogramu.'}</div>
    <div className="pp-inspector-actions"><button type="button" className="pp-button" onClick={() => onRun(process)}>▶ Uruchom teraz</button><button type="button" className="pp-button ghost">Edytuj proces</button><span>Ostatnia zmiana: {process.updated}</span></div>
  </article>;
}

function VariantA({ processes, targets, selected, selectedId, onSelect, onRun }) {
  return <div className="pp-variant pp-variant-a">
    <div className="pp-variant-intro"><div><h2>Wszystkie procesy</h2><p>Lista do szybkiego przeglądu, szczegóły obok.</p></div><span className="pp-count">{processes.length} zapisane</span></div>
    <div className="pp-split-table"><div className="pp-list-panel">{processes.map((item) => <ProcessListButton key={item.id} process={item} target={targetName(targets, item.targetId)} selected={selectedId === item.id} onClick={() => onSelect(item.id)}/>)}</div><div className="pp-detail-panel"><ProcessInspector process={selected} targets={targets} onRun={onRun}/></div></div>
  </div>;
}

function VariantB({ processes, targets, selected, selectedId, onSelect, onRun }) {
  const nextRun = selected?.scheduleDays.length ? selected.scheduleDays.join(', ') + ' · ' + selected.scheduleTime : 'Brak — uruchamiany ręcznie';
  return <div className="pp-variant pp-variant-b">
    <aside className="pp-cockpit-rail"><div className="pp-rail-heading"><span>AKTYWNE PROCESY</span><b>{processes.length}</b></div>{processes.map((item) => <button key={item.id} type="button" className={'pp-rail-item' + (selectedId === item.id ? ' selected' : '')} onClick={() => onSelect(item.id)}><span className="pp-rail-dot"/><span><strong>{item.name}</strong><small>{targetName(targets, item.targetId)}</small></span><span className="pp-rail-chevron">›</span></button>)}<div className="pp-rail-foot">Ręczne uruchomienie i harmonogram korzystają z tej samej konfiguracji.</div></aside>
    <div className="pp-cockpit-main"><div className="pp-cockpit-top"><div><div className="pp-eyebrow">KOKPIT / WYBRANY PROCES</div><h2>{selected?.name || 'Brak procesów'}</h2><p>{selected?.service} · {selected?.backend.toUpperCase()} · {targetName(targets, selected?.targetId)}</p></div><button className="pp-button" type="button" disabled={!selected} onClick={() => selected && onRun(selected)}>▶ Uruchom teraz</button></div>
      {selected && <><div className="pp-next-run"><div className="pp-next-icon">◷</div><div><small>NASTĘPNE URUCHOMIENIE</small><strong>{nextRun}</strong><span>{selected.scheduleDays.length ? 'Strefa Europe/Warsaw · pominięte terminy nie są nadrabiane' : 'Brak harmonogramu'}</span></div><span className={'pp-status ' + (selected.scheduleDays.length ? 'scheduled' : 'manual')}>{selected.state}</span></div>
      <div className="pp-cockpit-columns"><section><div className="pp-mini-title">Konfiguracja</div><dl className="pp-definition"><dt>Obraz</dt><dd>{selected.image}</dd><dt>Porty</dt><dd>{selected.port || '—'}</dd><dt>Backend</dt><dd>{selected.backend.toUpperCase()}</dd><dt>Profil serwera</dt><dd>{targetName(targets, selected.targetId)}</dd></dl></section><section><div className="pp-mini-title">Ostatnie wykonania</div>{INITIAL_RUNS.filter((run) => run.processId === selected.id).map((run) => <div className="pp-recent-run" key={run.id}><span className="pp-run-check">{run.status === 'Sukces' ? '✓' : '!'}</span><span><strong>{run.kind}</strong><small>{run.started} · {run.duration}</small></span><span className={'pp-status ' + (run.status === 'Sukces' ? 'scheduled' : 'failed')}>{run.status}</span></div>)}</section></div></>}
    </div>
  </div>;
}

function VariantC({ processes, targets, selected, selectedId, onSelect, onRun }) {
  return <div className="pp-variant pp-variant-c">
    <div className="pp-catalog-summary"><div><span className="pp-eyebrow">KATALOG KONFIGURACJI</span><h2>Twoje wdrożenia, gotowe do uruchomienia</h2><p>Każda pozycja to niezależny proces przypisany do jednego profilu serwera.</p></div><div className="pp-catalog-total"><strong>{processes.length.toString().padStart(2, '0')}</strong><small>PROCESY</small></div></div>
    <div className="pp-process-grid">{processes.map((item) => <article key={item.id} className={'pp-process-card' + (selectedId === item.id ? ' selected' : '')} onClick={() => onSelect(item.id)}>
      <div className="pp-card-top"><span className="pp-service-mark">{item.service.slice(0, 2).toUpperCase()}</span><span className={'pp-status ' + (item.scheduleDays.length ? 'scheduled' : 'manual')}>{item.state}</span></div>
      <div className="pp-card-copy"><small>{item.service.toUpperCase()} / {item.backend.toUpperCase()}</small><h3>{item.name}</h3><p>{targetName(targets, item.targetId)}</p></div>
      <div className="pp-card-config"><span>OBRAZ <strong>{item.image}</strong></span><span>PORT <strong>{item.port || '—'}</strong></span></div>
      <div className="pp-card-bottom"><span>{item.scheduleDays.length ? item.scheduleDays.join(' · ') + ' / ' + item.scheduleTime : 'Bez harmonogramu'}</span><button type="button" onClick={(event) => { event.stopPropagation(); onRun(item); }}>▶ Uruchom</button></div>
    </article>)}</div>
    {selected && <div className="pp-selected-strip"><span>WYBRANY PROCES</span><strong>{selected.name}</strong><button type="button" onClick={() => onRun(selected)}>Uruchom teraz →</button></div>}
  </div>;
}

function ServersView({ variant, targets, processes }) {
  const [selectedId, setSelectedId] = useState(targets[0]?.id || '');
  const selected = targets.find((item) => item.id === selectedId) || targets[0];
  const usedBy = (target) => processes.filter((item) => item.targetId === target.id).length;
  if (variant === 'C') return <div className="pp-server-cards">{targets.map((target) => <article className="pp-server-card" key={target.id}><div className="pp-server-card-head"><span className="pp-service-mark">{target.backend === 'k3s' ? 'K3' : 'DK'}</span><span className="pp-status scheduled">{usedBy(target)} procesy</span></div><h2>{target.name}</h2><p className="pp-mono">{target.endpoint}</p><small>{target.backend.toUpperCase()} · profil połączenia</small></article>)}</div>;
  if (variant === 'B') return <div className="pp-server-browser"><aside>{targets.map((target) => <button key={target.id} className={selected?.id === target.id ? 'selected' : ''} onClick={() => setSelectedId(target.id)}><strong>{target.name}</strong><small>{target.backend.toUpperCase()} · {usedBy(target)} procesy</small></button>)}</aside><article><div className="pp-eyebrow">PROFIL SERWERA</div><h2>{selected?.name}</h2><p>{selected?.backend.toUpperCase()} · {selected?.endpoint}</p><div className="pp-schedule-note">Dane połączenia są wspólne dla procesów, które wskazują ten profil.</div><h3>Używane przez</h3>{processes.filter((item) => item.targetId === selected?.id).map((item) => <div className="pp-recent-run" key={item.id}><span className="pp-service-mark">{item.service.slice(0, 2).toUpperCase()}</span><strong>{item.name}</strong></div>)}</article></div>;
  return <div className="pp-server-table"><div className="pp-table-head"><span>PROFIL</span><span>BACKEND / ADRES</span><span>PROCESY</span></div>{targets.map((target) => <div className="pp-server-row" key={target.id}><strong>{target.name}</strong><span>{target.backend.toUpperCase()} · {target.endpoint}</span><b>{usedBy(target)}</b></div>)}<p>Nowy serwer dodasz w formularzu „Proces wdrożenia”. Usunięcie profilu używanego przez proces jest zablokowane.</p></div>;
}

function HistoryView({ variant, runs, targets, selectedRun, selectedRunId, onSelect }) {
  const consolePane = selectedRun && <div className="pp-console"><div className="pp-console-head"><div><span>KONSOLA / {selectedRun.id.toUpperCase()}</span><strong>{selectedRun.processName}</strong></div><span className={'pp-status ' + (selectedRun.status === 'Sukces' ? 'scheduled' : 'failed')}>{selectedRun.status}</span></div><pre>{selectedRun.logs}</pre></div>;
  if (variant === 'B') return <div className="pp-history-split"><aside><div className="pp-rail-heading"><span>OSTATNIE WYKONANIA</span><b>{runs.length}</b></div>{runs.map((run) => <button key={run.id} className={'pp-history-choice' + (selectedRunId === run.id ? ' selected' : '')} onClick={() => onSelect(run.id)}><strong>{run.processName}</strong><small>{run.kind} · {run.started}</small><span className={'pp-status ' + (run.status === 'Sukces' ? 'scheduled' : 'failed')}>{run.status}</span></button>)}</aside>{consolePane}</div>;
  if (variant === 'C') return <div className="pp-history-timeline"><div className="pp-timeline-list">{runs.map((run) => <button key={run.id} className={'pp-timeline-item' + (selectedRunId === run.id ? ' selected' : '')} onClick={() => onSelect(run.id)}><span className={'pp-timeline-dot ' + (run.status === 'Sukces' ? 'good' : 'bad')}/><span><small>{run.started} · {run.kind}</small><strong>{run.processName}</strong><em>{targetName(targets, run.targetId)}</em></span><span className={'pp-status ' + (run.status === 'Sukces' ? 'scheduled' : 'failed')}>{run.status}</span></button>)}</div>{consolePane}</div>;
  return <div className="pp-history-table"><div className="pp-table-head"><span>PROCES</span><span>CEL</span><span>RODZAJ</span><span>STATUS</span><span>START</span></div>{runs.map((run) => <button key={run.id} className={'pp-history-row' + (selectedRunId === run.id ? ' selected' : '')} onClick={() => onSelect(run.id)}><strong>{run.processName}</strong><span>{targetName(targets, run.targetId)}</span><span>{run.kind}</span><span className={'pp-status ' + (run.status === 'Sukces' ? 'scheduled' : 'failed')}>{run.status}</span><time>{run.started}</time></button>)}{consolePane}</div>;
}

function ProcessDialog({ targets, onClose, onSave }) {
  const [name, setName] = useState('');
  const [service, setService] = useState('PostgreSQL');
  const [backend, setBackend] = useState('k3s');
  const [targetId, setTargetId] = useState('onyx-k3s');
  const [image, setImage] = useState('postgres:17');
  const [port, setPort] = useState('5432');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [days, setDays] = useState(['Pon', 'Śr', 'Pt']);
  const [time, setTime] = useState('03:30');
  const [addTarget, setAddTarget] = useState(false);
  const [targetNameDraft, setTargetNameDraft] = useState('');
  const [endpoint, setEndpoint] = useState('');

  const matchingTargets = targets.filter((target) => target.backend === backend);
  useEffect(() => {
    if (!matchingTargets.some((target) => target.id === targetId)) setTargetId(matchingTargets[0]?.id || '');
  }, [backend, targetId, targets]);
  const toggleDay = (day) => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);

  function submit(event) {
    event.preventDefault();
    onSave({
      name: name.trim(),
      service,
      backend,
      targetId,
      image,
      port,
      scheduleDays: scheduleEnabled ? days : [],
      scheduleTime: scheduleEnabled ? time : '',
      addTarget,
      targetName: targetNameDraft.trim(),
      endpoint: endpoint.trim(),
    });
  }

  return <div className="pp-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-modal-title">
    <div className="pp-modal-head"><div><div className="pp-eyebrow">NOWY ZAPISANY PROCES</div><h2 id="pp-modal-title">Proces wdrożenia</h2><p>Konfiguracja startuje ze wspólnych wartości domyślnych.</p></div><button type="button" aria-label="Zamknij" onClick={onClose}>×</button></div>
    <form onSubmit={submit}>
      <div className="pp-form-grid">
        <label className="pp-field pp-full">Nazwa procesu<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Np. PostgreSQL · produkcja"/></label>
        <label className="pp-field">Usługa<select value={service} onChange={(event) => { setService(event.target.value); setImage(event.target.value === 'Traefik' ? 'traefik:v3.3' : event.target.value === 'AdGuard Home' ? 'adguard/adguardhome:latest' : event.target.value === 'Portainer' ? 'portainer/portainer-ce:latest' : 'postgres:17'); setPort(event.target.value === 'Traefik' ? '80, 443' : event.target.value === 'AdGuard Home' ? '3000' : '5432'); }}><option>PostgreSQL</option><option>AdGuard Home</option><option>Traefik</option><option>Portainer</option></select></label>
        <label className="pp-field">Backend<select value={backend} onChange={(event) => setBackend(event.target.value)}><option value="docker">Docker</option><option value="k3s">K3s</option></select></label>
        <label className="pp-field pp-full">Profil serwera<select value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Wybierz profil</option>{matchingTargets.map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}</select></label>
        <div className="pp-target-add pp-full"><label><input type="checkbox" checked={addTarget} onChange={(event) => setAddTarget(event.target.checked)}/> Dodaj nowy serwer w tym formularzu</label>{addTarget && <div className="pp-form-grid pp-nested"><label className="pp-field">Nazwa serwera<input required value={targetNameDraft} onChange={(event) => setTargetNameDraft(event.target.value)} placeholder="np. Ruby"/></label><label className="pp-field">{backend === 'k3s' ? 'Adres API klastra' : 'Host SSH'}<input required value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={backend === 'k3s' ? 'https://192.168.0.20:6443' : '192.168.0.10'}/></label><p className="pp-full">Sekrety pozostają wskazaniami do istniejących plików; prototyp nie pyta o ich wartości.</p></div>}</div>
        <div className="pp-default-note pp-full"><span>✳</span><div><strong>Wartości wspólne</strong><small>Proces otrzyma własną kopię wartości domyślnych. Nadpisania serwera nie są kopiowane.</small></div></div>
        <label className="pp-field">Obraz i tag<input required value={image} onChange={(event) => setImage(event.target.value)}/></label>
        <label className="pp-field">Porty<input value={port} onChange={(event) => setPort(event.target.value)} placeholder="5432"/></label>
        <div className="pp-schedule-box pp-full"><label className="pp-schedule-toggle"><input type="checkbox" checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)}/><span><strong>Uruchamiaj według harmonogramu</strong><small>Harmonogram jest opcjonalny; proces zawsze można uruchomić ręcznie.</small></span></label>
          {scheduleEnabled && <div className="pp-schedule-fields"><div className="pp-day-picker">{DAYS.map((day) => <label key={day} className={days.includes(day) ? 'selected' : ''}><input type="checkbox" checked={days.includes(day)} onChange={() => toggleDay(day)}/>{day}</label>)}</div><label className="pp-time-field">Godzina<input type="time" value={time} onChange={(event) => setTime(event.target.value)}/><small>Europe/Warsaw · zaległe terminy są pomijane</small></label></div>}
        </div>
      </div>
      <div className="pp-modal-actions"><span>PROTOTYP · nie zapisuje danych ani nie wdraża</span><div><button type="button" className="pp-button ghost" onClick={onClose}>Anuluj</button><button type="submit" className="pp-button">Zapisz proces</button></div></div>
    </form>
  </section></div>;
}

function PrototypeSwitcher({ variant, onChange }) {
  useEffect(() => {
    function handleKey(event) {
      const element = document.activeElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName) || element?.isContentEditable) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const index = VARIANTS.findIndex((item) => item.key === variant);
      const next = event.key === 'ArrowRight' ? (index + 1) % VARIANTS.length : (index + VARIANTS.length - 1) % VARIANTS.length;
      onChange(VARIANTS[next].key);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [variant, onChange]);

  if (process.env.NODE_ENV === 'production') return null;
  const index = VARIANTS.findIndex((item) => item.key === variant);
  return <div className="pp-switcher" aria-label="Wybór wariantu prototypu"><button type="button" aria-label="Poprzedni wariant" onClick={() => onChange(VARIANTS[(index + VARIANTS.length - 1) % VARIANTS.length].key)}>←</button><span><strong>{variant}</strong> · {VARIANTS[index]?.name}</span><button type="button" aria-label="Następny wariant" onClick={() => onChange(VARIANTS[(index + 1) % VARIANTS.length].key)}>→</button></div>;
}
