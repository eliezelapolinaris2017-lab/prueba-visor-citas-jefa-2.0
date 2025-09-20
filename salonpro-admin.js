// salonpro-admin.js
// Panel administrativo “Visor de Citas” integrado a Salón Pro sin tocar el diseño base.
// Lee datos desde adapter.getRegistros() -> [{ id, fecha, hora, tecnica, total, tipo }]

export function mountSalonProAdmin({ adapter }) {
  if (document.getElementById('sp-admin-host')) return;

  const host = document.createElement('div');
  host.id = 'sp-admin-host';
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.zIndex = '999998';
  document.body.appendChild(host);

  const $ = host.attachShadow({ mode: 'open' });

  $.innerHTML = `
    <style>
      :host { all: initial; }
      .backdrop{position:fixed; inset:0; background:rgba(0,0,0,.42);}
      .panel{
        position:fixed; right:0; top:0; height:100vh; width:min(440px,100vw);
        background:#0f1117; color:#e8ecf3; box-shadow:-10px 0 32px rgba(0,0,0,.45);
        display:flex; flex-direction:column; font:14px/1.4 system-ui,-apple-system,Segoe UI,Inter,Roboto,Arial;
      }
      .top{
        display:flex; align-items:center; justify-content:space-between; gap:8px;
        padding:14px 14px; background:#0b0d13; border-bottom:1px solid #23263a; position:sticky; top:0;
      }
      .title{font-weight:800; letter-spacing:.3px}
      .x{background:#ef4444; color:#fff; border:none; border-radius:10px; padding:8px 12px; cursor:pointer; font-weight:700}
      .wrap{padding:12px 14px; display:grid; gap:10px; overflow:auto}
      .grid{display:grid; grid-template-columns:1fr 1fr; gap:10px}
      .row{display:grid; gap:8px}
      label{font-size:12px; color:#a7b0c0}
      select,input,button{
        background:#141823; color:#e8ecf3; border:1px solid #2a2f45; border-radius:10px; padding:10px 12px; outline:none;
      }
      button.primary{background:#22c55e; border-color:#22c55e; color:#fff; font-weight:800; cursor:pointer}
      button.ghost{background:#0f121b; border-color:#2a2f45; cursor:pointer}
      .chips{display:flex; flex-wrap:wrap; gap:8px}
      .chip{padding:8px 10px; border:1px solid #2a2f45; border-radius:999px; cursor:pointer; user-select:none}
      .chip.active{background:#1b2133; border-color:#3a4362}
      table{width:100%; border-collapse:collapse; font-size:12px; margin-top:6px}
      th,td{border-bottom:1px solid #23263a; padding:8px 6px; text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
      th{font-weight:700; color:#b7c0d3}
      .totals{display:grid; grid-template-columns:1fr 1fr; gap:8px; background:#0b0f19; border:1px solid #22263a; border-radius:12px; padding:10px}
      .muted{color:#98a2b3; font-size:12px}
      .right{justify-self:end; font-weight:800}
      .foot{padding:8px 14px; border-top:1px solid #23263a; display:flex; gap:8px; position:sticky; bottom:0; background:#0b0d13}
      .hint{color:#8fa0b6; font-size:11px}
    </style>

    <div class="backdrop" id="close"></div>
    <aside class="panel" role="dialog" aria-label="Panel administrativo Salón Pro">
      <header class="top">
        <div class="title">Panel Administrativo — Visor de Citas</div>
        <button class="x" id="close2">Cerrar</button>
      </header>

      <section class="wrap">
        <div class="row">
          <label>Rango rápido</label>
          <div class="chips" id="chips">
            <div class="chip active" data-k="hoy">Hoy</div>
            <div class="chip" data-k="semana">Semana</div>
            <div class="chip" data-k="mes">Mes</div>
            <div class="chip" data-k="anio">Año</div>
            <div class="chip" data-k="rango">Rango</div>
          </div>
        </div>

        <div class="grid" id="picker" style="display:none">
          <div class="row"><label>Desde</label><input type="date" id="desde"></div>
          <div class="row"><label>Hasta</label><input type="date" id="hasta"></div>
        </div>

        <div class="grid">
          <div class="row">
            <label>Técnica / Empleado</label>
            <select id="tecnica"><option value="__ALL__">Todas</option></select>
          </div>
          <div class="row">
            <label>Tipo</label>
            <select id="tipo">
              <option value="__ALL__">Citas + Facturas</option>
              <option value="cita">Solo citas</option>
              <option value="factura">Solo facturas</option>
            </select>
          </div>
        </div>

        <div class="totals">
          <div><div class="muted">Registros</div><div id="t-count" class="right">0</div></div>
          <div><div class="muted">Total $</div><div id="t-sum" class="right">0.00</div></div>
        </div>

        <div class="row">
          <div class="grid">
            <button class="ghost" id="btn-refresh">Aplicar filtros</button>
            <button class="primary" id="btn-clear">Limpiar</button>
          </div>
          <div class="grid">
            <button class="ghost" id="btn-csv">Exportar Excel (CSV)</button>
            <button class="ghost" id="btn-pdf">Exportar PDF</button>
          </div>
          <div class="hint">* Semana comienza en lunes. Ajusta fechas en “Rango” si lo prefieres distinto.</div>
        </div>

        <div class="row">
          <table id="tabla">
            <thead><tr>
              <th>Fecha</th><th>Hora</th><th>Técnica</th><th>Tipo</th><th>Total $</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

      <footer class="foot">
        <button class="ghost" id="btn-close-foot">Cerrar</button>
        <div style="flex:1"></div>
        <div class="hint">Salón Pro • Panel no intrusivo (Shadow DOM)</div>
      </footer>
    </aside>
  `;

  // --- Helpers de fechas ---
  const toDate = (s) => {
    // Acepta "YYYY-MM-DD" o Date; si trae "fecha" + "hora", se combinan
    if (s instanceof Date) return s;
    if (!s) return new Date();
    // Normalizar: si trae "YYYY-MM-DDTHH:mm" déjalo pasar
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00');
    return new Date(s);
  };
  const ymd = (d) => {
    const p = (n)=> String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  };
  const startOfDay = (d)=> new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d)=> new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);
  const startOfWeekMon = (d)=> {
    const c = new Date(d); const day = (c.getDay()||7); // lunes=1..domingo=7
    if (day>1) c.setDate(c.getDate() - (day-1));
    return startOfDay(c);
  };
  const endOfWeekMon = (d)=> {
    const s = startOfWeekMon(d); s.setDate(s.getDate()+6); return endOfDay(s);
  };
  const startOfMonth = (d)=> new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d)=> endOfDay(new Date(d.getFullYear(), d.getMonth()+1, 0));
  const startOfYear = (d)=> new Date(d.getFullYear(), 0, 1);
  const endOfYear = (d)=> endOfDay(new Date(d.getFullYear(), 11, 31));

  // --- Estado / refs ---
  const qs = (sel)=> $.querySelector(sel);
  const qsa = (sel)=> Array.from($.querySelectorAll(sel));
  const state = {
    rango: 'hoy',
    desde: null,
    hasta: null,
    tecnica: '__ALL__',
    tipo: '__ALL__',
    registros: [],
    filtrados: []
  };

  // --- Cerrar panel ---
  ['close','close2','btn-close-foot'].forEach(id=>{
    qs('#'+id).addEventListener('click', ()=> host.remove());
  });

  // --- Chips de rango ---
  qs('#chips').addEventListener('click', (e)=>{
    const chip = e.target.closest('.chip'); if (!chip) return;
    qsa('.chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    state.rango = chip.dataset.k;
    qs('#picker').style.display = (state.rango==='rango') ? '' : 'none';
    if (state.rango!=='rango') applyPreset();
  });

  // --- Selects / botones ---
  qs('#tecnica').addEventListener('change', e=> { state.tecnica = e.target.value; render(); });
  qs('#tipo').addEventListener('change', e=> { state.tipo = e.target.value; render(); });
  qs('#btn-refresh').addEventListener('click', ()=>{
    const d = qs('#desde').value ? toDate(qs('#desde').value) : null;
    const h = qs('#hasta').value ? toDate(qs('#hasta').value) : null;
    state.desde = d; state.hasta = h; render();
  });
  qs('#btn-clear').addEventListener('click', ()=>{
    state.tecnica='__ALL__'; state.tipo='__ALL__';
    qs('#tecnica').value='__ALL__'; qs('#tipo').value='__ALL__';
    applyPreset(); render();
  });

  // --- Exportar CSV ---
  qs('#btn-csv').addEventListener('click', ()=>{
    const rows = [
      ['Fecha','Hora','Técnica','Tipo','Total'],
      ...state.filtrados.map(r=>[
        r.fecha||'', r.hora||'', r.tecnica||'', r.tipo||'', (Number(r.total)||0).toFixed(2)
      ])
    ];
    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cuadre_${Date.now()}.csv`;
    a.click();
  });

  // --- Exportar PDF (printable) ---
  qs('#btn-pdf').addEventListener('click', ()=>{
    const w = window.open('', '_blank');
    const total = state.filtrados.reduce((s,r)=> s + (Number(r.total)||0), 0);
    const html = `
      <html><head><meta charset="utf-8"><title>Cuadre</title>
      <style>
        body{font:12px/1.4 -apple-system,Segoe UI,Inter,Roboto,Arial; color:#111}
        h1{font-size:16px; margin:0 0 8px}
        .muted{color:#666}
        table{width:100%; border-collapse:collapse; margin-top:8px}
        th,td{border:1px solid #ccc; padding:6px 8px; text-align:left; font-size:12px}
        th{background:#f2f2f2}
        .right{text-align:right; font-weight:700}
      </style></head><body>
        <h1>Cuadre — Visor de Citas</h1>
        <div class="muted">Generado: ${new Date().toLocaleString()}</div>
        <table>
          <thead><tr><th>Fecha</th><th>Hora</th><th>Técnica</th><th>Tipo</th><th>Total $</th></tr></thead>
          <tbody>
            ${state.filtrados.map(r=>`
              <tr>
                <td>${r.fecha||''}</td>
                <td>${r.hora||''}</td>
                <td>${r.tecnica||''}</td>
                <td>${r.tipo||''}</td>
                <td class="right">${(Number(r.total)||0).toFixed(2)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><th colspan="4" class="right">TOTAL</th><th class="right">${total.toFixed(2)}</th></tr>
          </tfoot>
        </table>
        <script>window.addEventListener('load',()=>{window.print();});</script>
      </body></html>`;
    w.document.write(html); w.document.close();
  });

  // --- Cargar datos y poblar UI ---
  (async function init(){
    const registros = await safeGetRegistros(adapter);
    state.registros = normalize(registros);

    // Poblar técnicas
    const set = new Set(state.registros.map(r=> r.tecnica || ''));
    const sel = qs('#tecnica');
    [...set].filter(Boolean).sort((a,b)=>a.localeCompare(b)).forEach(t=>{
      const opt = document.createElement('option'); opt.value=t; opt.textContent=t; sel.appendChild(opt);
    });

    applyPreset(); render();
  })();

  function normalize(arr){
    // Normaliza a {fecha:'YYYY-MM-DD', hora:'HH:mm', tecnica, total:Number, tipo}
    return (arr||[]).map(r=>{
      const fecha = r.fecha ? String(r.fecha) : (r.fechaISO || r.date || r.dia || '');
      const hora  = r.hora ? String(r.hora) : (r.time || '');
      const tecnica = r.tecnica || r.tecnico || r.empleado || r.estilista || '';
      const total = Number(r.total ?? r.monto ?? r.cobro ?? 0);
      const tipo = r.tipo || (r.esFactura ? 'factura':'cita');
      // Si viene fecha completa con T, recorta a YYYY-MM-DD
      const f = fecha?.length>10 ? fecha.slice(0,10) : fecha;
      // Hora tipo "HH:mm:ss" -> "HH:mm"
      const h = (hora && hora.length>=5) ? hora.slice(0,5) : hora || '';
      return { fecha:f, hora:h, tecnica, total, tipo };
    });
  }

  async function safeGetRegistros(adapter){
    try { return await adapter.getRegistros(); }
    catch(e){ console.error(e); return []; }
  }

  function applyPreset(){
    const now = new Date();
    let d=null,h=null;
    if (state.rango==='hoy'){ d = startOfDay(now); h = endOfDay(now); }
    else if (state.rango==='semana'){ d = startOfWeekMon(now); h = endOfWeekMon(now); }
    else if (state.rango==='mes'){ d = startOfMonth(now); h = endOfMonth(now); }
    else if (state.rango==='anio'){ d = startOfYear(now); h = endOfYear(now); }
    state.desde = d; state.hasta = h;
    if (qs('#desde')) qs('#desde').value = d ? ymd(d) : '';
    if (qs('#hasta')) qs('#hasta').value = h ? ymd(h) : '';
  }

  function inRange(fstr){
    if (!fstr) return false;
    const f = toDate(fstr);
    if (state.desde && f < startOfDay(state.desde)) return false;
    if (state.hasta && f > endOfDay(state.hasta)) return false;
    return true;
  }

  function render(){
    // Filtrar
    let arr = state.registros.filter(r=> r.fecha && inRange(r.fecha));
    if (state.tecnica!=='__ALL__') arr = arr.filter(r=> (r.tecnica||'')===state.tecnica);
    if (state.tipo!=='__ALL__') arr = arr.filter(r=> (r.tipo||'')===state.tipo);
    // Orden: fecha desc, hora asc
    arr.sort((a,b)=>{
      const d = (a.fecha>b.fecha)?-1:(a.fecha<b.fecha)?1:0;
      if (d!==0) return d;
      return (a.hora||'').localeCompare(b.hora||'');
    });
    state.filtrados = arr;

    // Totales
    const n = arr.length;
    const sum = arr.reduce((s,r)=> s + (Number(r.total)||0), 0);
    qs('#t-count').textContent = String(n);
    qs('#t-sum').textContent = sum.toFixed(2);

    // Tabla
    const tbody = qs('#tabla tbody'); tbody.innerHTML='';
    const frag = document.createDocumentFragment();
    arr.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.fecha||''}</td>
        <td>${r.hora||''}</td>
        <td>${r.tecnica||''}</td>
        <td>${r.tipo||''}</td>
        <td>${(Number(r.total)||0).toFixed(2)}</td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }
}
