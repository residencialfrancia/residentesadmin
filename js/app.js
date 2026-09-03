// [Descripción: Lógica principal del Dashboard actualizada. Contiene el diccionario masivo de columnas agrupadas por pestaña. Al elegir Género, se renderizan 2 tablas en Flexbox. Los clics en las filas llevan al perfil. Al imprimir, se inyecta la fecha y se auto-escala la fuente según la cantidad de columnas elegidas para evitar desbordes en A4.]

const API_URL = 'https://script.google.com/macros/s/AKfycbwS1IP_hh93Alc9YzCxNQr-k0YUh-FDjh8SqEyB4hBz5oUz4sJlHFFYR7nPSyw-89ZM/exec';
const FALLBACK_IMAGE = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

let globalActivos = [];
let globalArchivados = [];

let currentView = 'grid'; 
let currentSortField = 'nombre';
let currentSortDir = 'asc';
let currentReportId = 'default';
let customSelectionArray = []; // Para trackear el orden de clic

// ================= DICCIONARIO DE COLUMNAS =================
const COLUMNS_DICT = {
    // Datos Personales
    'nombre': { tab: 'Datos Personales', label: 'Nombre', extract: r => r.nombre },
    'numeroSocio': { tab: 'Datos Personales', label: 'N° Socio', extract: r => r.numeroSocio || '-' },
    'apodo': { tab: 'Datos Personales', label: 'Apodo', extract: r => r.apodo || '-' },
    'fechaNacimiento': { tab: 'Datos Personales', label: 'Nacimiento', extract: r => formatFecha(r.fechaNacimiento) },
    'edad': { tab: 'Datos Personales', label: 'Edad', extract: r => r.edad || '-' },
    'edadCumple': { tab: 'Datos Personales', label: 'Cumple', extract: r => calculateAgeToTurn(r.fechaNacimiento) },
    'dni': { tab: 'Datos Personales', label: 'DNI', extract: r => r.dni || '-' },
    'cuil': { tab: 'Datos Personales', label: 'CUIL', extract: r => r.cuil || '-' },
    'numeroTramite': { tab: 'Datos Personales', label: 'N° Trámite', extract: r => r.numeroTramite || '-' },
    'domicilio': { tab: 'Datos Personales', label: 'Domicilio', extract: r => r.domicilio || '-' },
    'nacionalidad': { tab: 'Datos Personales', label: 'Nacionalidad', extract: r => r.nacionalidad || '-' },
    'fechaIngreso': { tab: 'Datos Personales', label: 'Ingreso', extract: r => formatFecha(r.fechaIngreso) },
    'genero': { tab: 'Datos Personales', label: 'Género', extract: r => formatGenero(r.genero) },

    // Datos Médicos
    'lugarInternacion': { tab: 'Datos Médicos', label: 'Lugar Internación', extract: r => r.lugarInternacion || '-' },
    'alergias': { tab: 'Datos Médicos', label: 'Alergias', extract: r => r.alergias || '-' },
    'med1': { tab: 'Datos Médicos', label: 'Médico 1', extract: r => getArray(r.medicosList, 0) },
    'esp1': { tab: 'Datos Médicos', label: 'Especialidad 1', extract: r => getArray(r.especialidadList, 0) },
    'med2': { tab: 'Datos Médicos', label: 'Médico 2', extract: r => getArray(r.medicosList, 1) },
    'esp2': { tab: 'Datos Médicos', label: 'Especialidad 2', extract: r => getArray(r.especialidadList, 1) },
    'med3': { tab: 'Datos Médicos', label: 'Médico 3', extract: r => getArray(r.medicosList, 2) },
    'esp3': { tab: 'Datos Médicos', label: 'Especialidad 3', extract: r => getArray(r.especialidadList, 2) },

    // Obra Social
    'os1': { tab: 'Obra Social', label: 'Obra Social 1', extract: r => getArray(r.obrasSociales, 0) },
    'nroOs1': { tab: 'Obra Social', label: 'Nro Afiliado 1', extract: r => getArray(r.numerosOs, 0) },
    'os2': { tab: 'Obra Social', label: 'Obra Social 2', extract: r => getArray(r.obrasSociales, 1) },
    'nroOs2': { tab: 'Obra Social', label: 'Nro Afiliado 2', extract: r => getArray(r.numerosOs, 1) },
    'os3': { tab: 'Obra Social', label: 'Obra Social 3', extract: r => getArray(r.obrasSociales, 2) },
    'nroOs3': { tab: 'Obra Social', label: 'Nro Afiliado 3', extract: r => getArray(r.numerosOs, 2) },

    // Familiares Responsables
    'resp1': { tab: 'Familiares y Responsables', label: 'Responsable 1', extract: r => getArray(r.responsablesList, 0) },
    'par1': { tab: 'Familiares y Responsables', label: 'Parentesco 1', extract: r => getArray(r.parentescoList, 0) },
    'tel1': { tab: 'Familiares y Responsables', label: 'Teléfono 1', extract: r => getArray(r.telefonosList, 0) },
    'dniR1': { tab: 'Familiares y Responsables', label: 'DNI Resp 1', extract: r => getArray(r.dniResponsablesList, 0) },
    'resp2': { tab: 'Familiares y Responsables', label: 'Responsable 2', extract: r => getArray(r.responsablesList, 1) },
    'tel2': { tab: 'Familiares y Responsables', label: 'Teléfono 2', extract: r => getArray(r.telefonosList, 1) },
    'resp3': { tab: 'Familiares y Responsables', label: 'Responsable 3', extract: r => getArray(r.responsablesList, 2) },
    'tel3': { tab: 'Familiares y Responsables', label: 'Teléfono 3', extract: r => getArray(r.telefonosList, 2) },
    'resp4': { tab: 'Familiares y Responsables', label: 'Responsable 4', extract: r => getArray(r.responsablesList, 3) },
    'tel4': { tab: 'Familiares y Responsables', label: 'Teléfono 4', extract: r => getArray(r.telefonosList, 3) },
    'resp5': { tab: 'Familiares y Responsables', label: 'Responsable 5', extract: r => getArray(r.responsablesList, 4) },
    'tel5': { tab: 'Familiares y Responsables', label: 'Teléfono 5', extract: r => getArray(r.telefonosList, 4) }
};

const PRESET_REPORTS = {
    'default': { title: 'Residentes', cols: ['nombre', 'dni', 'edad', 'numeroSocio', 'os1'] },
    'cumple': { title: 'Cumpleaños', cols: ['numeroSocio', 'nombre', 'fechaNacimiento', 'edadCumple'] },
    'os': { title: 'Obra Social', cols: ['numeroSocio', 'nombre', 'dni', 'os1', 'nroOs1', 'os2', 'nroOs2'] },
    'fam': { title: 'Familiares y Responsables', cols: ['nombre', 'resp1', 'tel1', 'resp2', 'tel2', 'resp3', 'tel3'] }
};

let customReports = JSON.parse(localStorage.getItem('customReports')) || {};

// ================= UTILIDADES =================
function getArray(arr, idx) { return (arr && arr[idx] && arr[idx].trim() !== '') ? arr[idx] : '-'; }
function formatFecha(f) { if(!f) return '-'; try { return f.includes('T') ? f.split('T')[0] : f; } catch{return f;} }
function formatGenero(g) {
    if(!g) return '-';
    let lg = g.toLowerCase().trim();
    if(lg.startsWith('m')) return 'Masculino';
    if(lg.startsWith('f')) return 'Femenino';
    return g;
}
function calculateAgeToTurn(f) {
    if(!f) return '-';
    let year = 0;
    if(f.includes('/')) year = parseInt(f.split('/')[2]);
    else if(f.includes('-')) year = parseInt(f.split('-')[0]);
    else year = new Date(f).getFullYear();
    return (new Date().getFullYear() - year) + ' años';
}
function goToProfile(nombre) { window.location.href = `resident.html?id=${encodeURIComponent(nombre)}`; }

// ================= INICIALIZACIÓN =================
document.addEventListener('DOMContentLoaded', () => {
    setupTabs(); setupEventListeners(); loadCustomReportsToDropdown(); fetchActivos(); fetchArchivados();
});

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden')); 
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-tab')).classList.remove('hidden');
        });
    });
}

function setupEventListeners() {
    document.getElementById('searchActivos').addEventListener('input', applyFiltersAndRender);
    document.getElementById('btnViewGrid').addEventListener('click', () => { currentView = 'grid'; updateViewButtons(); applyFiltersAndRender(); });
    document.getElementById('btnViewList').addEventListener('click', () => { currentView = 'list'; updateViewButtons(); applyFiltersAndRender(); });
    document.getElementById('sortField').addEventListener('change', (e) => { currentSortField = e.target.value; applyFiltersAndRender(); });
    document.getElementById('sortDirection').addEventListener('change', (e) => { currentSortDir = e.target.value; applyFiltersAndRender(); });
    document.getElementById('reportPreset').addEventListener('change', (e) => { currentReportId = e.target.value; currentView = 'list'; updateViewButtons(); applyFiltersAndRender(); });
    document.getElementById('closeModal').onclick = closeArchiveModal;
    document.getElementById('cancelArchive').onclick = closeArchiveModal;
    document.getElementById('confirmArchive').onclick = executeArchive;
}

function updateViewButtons() {
    document.getElementById('btnViewGrid').classList.toggle('active', currentView === 'grid');
    document.getElementById('btnViewList').classList.toggle('active', currentView === 'list');
}

// ================= FETCH =================
async function fetchActivos() {
    const loader = document.getElementById('loaderActivos'); loader.classList.remove('hidden');
    try {
        const res = await fetch(`${API_URL}?action=getResidents`);
        const json = await res.json();
        if (json.status === 'success') { globalActivos = json.data; applyFiltersAndRender(); } 
    } catch (e) {} finally { loader.classList.add('hidden'); }
}

async function fetchArchivados() {
    const loader = document.getElementById('loaderArchivados'); loader.classList.remove('hidden');
    try {
        const res = await fetch(`${API_URL}?action=getArchived`);
        const json = await res.json();
        if (json.status === 'success') { globalArchivados = json.data; renderGrid(globalArchivados, 'gridArchivados', true); }
    } catch (e) {} finally { loader.classList.add('hidden'); }
}

// ================= ORDEN Y RENDERIZADO =================
function applyFiltersAndRender() {
    const term = document.getElementById('searchActivos').value.toLowerCase();
    let filtered = globalActivos.filter(r => r.nombre.toLowerCase().includes(term) || (r.dni && r.dni.includes(term)));

    filtered.sort((a, b) => {
        let valA = COLUMNS_DICT[currentSortField] ? COLUMNS_DICT[currentSortField].extract(a) : a[currentSortField];
        let valB = COLUMNS_DICT[currentSortField] ? COLUMNS_DICT[currentSortField].extract(b) : b[currentSortField];
        valA = valA ? valA.toString().toLowerCase() : ''; valB = valB ? valB.toString().toLowerCase() : '';
        if(!isNaN(valA) && !isNaN(valB)) { valA = parseFloat(valA); valB = parseFloat(valB); }
        if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
        return 0;
    });

    if (currentView === 'grid') {
        document.getElementById('gridActivos').classList.remove('hidden');
        document.getElementById('listActivos').classList.add('hidden');
        renderGrid(filtered, 'gridActivos', false);
    } else {
        document.getElementById('gridActivos').classList.add('hidden');
        document.getElementById('listActivos').classList.remove('hidden');
        renderList(filtered);
    }
}

// ================= VISTA LISTA / GÉNERO / AUTO-SIZE IMPRESIÓN =================
function renderList(data) {
    const listContainer = document.getElementById('listActivos');
    listContainer.innerHTML = '';

    let reportDef = PRESET_REPORTS[currentReportId] || customReports[currentReportId] || PRESET_REPORTS['default'];
    let activeCols = [...reportDef.cols];
    document.getElementById('printTitle').textContent = reportDef.title;
    
    // Auto-ajuste de la fuente baseada en la cantidad de columnas (Ideal para impresión A4)
    let fontSize = '13px';
    if(activeCols.length > 5) fontSize = '11px';
    if(activeCols.length > 7) fontSize = '9px';
    if(activeCols.length > 10) fontSize = '8px';

    // Orden Dinámico: Mover columna de orden a la izquierda si no es Nombre ni Género
    if (currentReportId === 'default' && currentSortField !== 'nombre' && currentSortField !== 'genero') {
        activeCols = ['nombre', currentSortField];
        if(currentSortField === 'edad') activeCols.push('fechaNacimiento');
        if(currentSortField === 'numeroSocio') activeCols.push('fechaIngreso');
        PRESET_REPORTS['default'].cols.forEach(c => { if(!activeCols.includes(c)) activeCols.push(c); });
    }

    // SI EL ORDEN ES GÉNERO: División en 2 tablas
    if (currentSortField === 'genero') {
        let males = data.filter(r => formatGenero(r.genero) === 'Masculino');
        let females = data.filter(r => formatGenero(r.genero) === 'Femenino');
        
        let splitHtml = `<div class="gender-split">`;
        splitHtml += buildTableHtml(males, activeCols, 'Hombres (Masculinos)', fontSize);
        splitHtml += buildTableHtml(females, activeCols, 'Mujeres (Femeninas)', fontSize);
        splitHtml += `</div>`;
        
        listContainer.innerHTML = splitHtml;
    } else {
        listContainer.innerHTML = buildTableHtml(data, activeCols, null, fontSize);
    }
}

function buildTableHtml(data, cols, title, fontSize) {
    let html = title ? `<div class="gender-column"><h3 class="gender-title">${title}</h3>` : '';
    html += `<table class="data-table" style="font-size: ${fontSize};"><thead><tr><th>#</th>`;
    
    cols.forEach(c => { if(COLUMNS_DICT[c]) html += `<th>${COLUMNS_DICT[c].label}</th>`; });
    html += `</tr></thead><tbody>`;
    
    if(data.length === 0) {
        html += `<tr><td colspan="${cols.length + 1}" style="text-align:center;">No hay residentes</td></tr>`;
    } else {
        data.forEach((res, idx) => {
            html += `<tr onclick="goToProfile('${res.nombre.replace(/'/g, "\\'")}')"><td>${idx + 1}</td>`;
            cols.forEach(c => { if(COLUMNS_DICT[c]) html += `<td>${COLUMNS_DICT[c].extract(res)}</td>`; });
            html += `</tr>`;
        });
    }
    html += `</tbody></table>`;
    if(title) html += `</div>`;
    return html;
}

// ================= MODAL REPORTES PERSONALIZADOS =================
window.openCustomReportModal = function() {
    const container = document.getElementById('columnsPickerContainer');
    container.innerHTML = ''; customSelectionArray = [];
    
    const tabs = [...new Set(Object.values(COLUMNS_DICT).map(item => item.tab))];
    tabs.forEach(tabName => {
        let groupHtml = `<div class="report-tab-group"><div class="report-tab-title">${tabName}</div><div class="columns-picker">`;
        Object.keys(COLUMNS_DICT).forEach(key => {
            if(COLUMNS_DICT[key].tab === tabName) {
                groupHtml += `<label><input type="checkbox" value="${key}" onchange="handleCustomColSelect(this, '${COLUMNS_DICT[key].label}')"> ${COLUMNS_DICT[key].label}</label>`;
            }
        });
        groupHtml += `</div></div>`;
        container.innerHTML += groupHtml;
    });
    
    document.getElementById('customReportTitle').value = '';
    updateSelectedOrderUI();
    document.getElementById('reportModal').classList.add('show');
}

window.closeCustomReportModal = function() { document.getElementById('reportModal').classList.remove('show'); }

window.handleCustomColSelect = function(chk, label) {
    if(chk.checked) customSelectionArray.push({ key: chk.value, label: label });
    else customSelectionArray = customSelectionArray.filter(i => i.key !== chk.value);
    updateSelectedOrderUI();
}

function updateSelectedOrderUI() {
    const container = document.getElementById('selectedTagsContainer');
    if(customSelectionArray.length === 0) {
        container.innerHTML = '<span style="color:#999; font-style:italic;">Seleccione las opciones debajo...</span>';
    } else {
        container.innerHTML = customSelectionArray.map((item, i) => `<span class="tag-item"><span class="tag-number">${i+1}</span> ${item.label}</span>`).join('');
    }
}

window.saveCustomReport = function() {
    const title = document.getElementById('customReportTitle').value.trim() || 'Filtro Personalizado';
    if(customSelectionArray.length === 0) return alert("Debe seleccionar al menos una columna.");

    const reportId = 'custom_' + new Date().getTime();
    customReports[reportId] = { title: title, cols: customSelectionArray.map(i => i.key) };
    localStorage.setItem('customReports', JSON.stringify(customReports));
    
    loadCustomReportsToDropdown();
    document.getElementById('reportPreset').value = reportId;
    closeCustomReportModal();
    
    currentReportId = reportId; currentView = 'list';
    updateViewButtons(); applyFiltersAndRender();
}

function loadCustomReportsToDropdown() {
    const select = document.getElementById('reportPreset');
    Array.from(select.options).forEach(opt => { if(opt.value.startsWith('custom_')) opt.remove(); });
    Object.keys(customReports).forEach(key => select.insertAdjacentHTML('beforeend', `<option value="${key}">⭐ ${customReports[key].title}</option>`));
}

// ================= IMPRESIÓN =================
window.executePrint = function() {
    const wasGrid = currentView === 'grid';
    if(wasGrid) { currentView = 'list'; applyFiltersAndRender(); }
    
    const today = new Date();
    document.getElementById('printDate').textContent = "Fecha de informe: " + today.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    setTimeout(() => { 
        window.print(); 
        if(wasGrid) { currentView = 'grid'; applyFiltersAndRender(); }
    }, 500); // Timeout breve para asegurar renderizado de la lista antes del spool de impresión
}

// ================= VISTA MOSAICO =================
function renderGrid(data, containerId, isArchived) {
    const grid = document.getElementById(containerId); grid.innerHTML = '';
    if (data.length === 0) { grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">No hay registros.</p>'; return; }

    data.forEach(res => {
        const card = document.createElement('div');
        card.className = `card ${isArchived ? 'archived-card' : ''}`;
        card.style.cursor = 'pointer'; 
        card.onclick = function(e) {
            e.preventDefault(); e.stopPropagation(); 
            const actionBtn = e.target.closest('.btn-archive-card');
            if(actionBtn) {
                if (actionBtn.dataset.action === 'archive') openArchiveModal(res.nombre);
                else if (actionBtn.dataset.action === 'restore') executeRestore(res.nombre);
                return;
            }
            goToProfile(res.nombre);
        };

        const imgSrc = res.fotoUrl && res.fotoUrl !== '' ? res.fotoUrl : FALLBACK_IMAGE;
        const actionBtnHtml = !isArchived 
            ? `<button type="button" class="btn-archive-card" data-action="archive"><i class="fa-solid fa-box-archive"></i></button>` 
            : `<button type="button" class="btn-archive-card" data-action="restore"><i class="fa-solid fa-box-open"></i></button>`;

        card.innerHTML = `
            ${actionBtnHtml}
            <div class="card-header"><img src="${imgSrc}" class="card-img" onerror="this.src='${FALLBACK_IMAGE}'"><div class="card-title"><h3>${res.nombre}</h3></div></div>
            <div class="card-body">
                <div class="info-row"><span><i class="fa-solid fa-id-card"></i> DNI:</span><strong>${res.dni || 'N/A'}</strong></div>
                <div class="info-row"><span><i class="fa-solid fa-calendar-days"></i> Edad:</span><strong>${res.edad ? res.edad + ' años' : 'N/A'}</strong></div>
                <div class="info-row"><span><i class="fa-solid fa-hashtag"></i> N° Socio:</span><strong>${res.numeroSocio || 'N/A'}</strong></div>
                <div class="info-row" style="flex-direction: column; gap: 8px; margin-top: 10px; border-top: 1px dashed var(--border-color); padding-top: 10px;">
                    <span style="color: var(--primary-blue); font-weight: 600;"><i class="fa-solid fa-notes-medical"></i> Obras Sociales:</span>
                    ${(res.obrasSociales && res.obrasSociales.length > 0 && res.obrasSociales[0] !== "") 
                        ? res.obrasSociales.map((os, idx) => `<div style="display:flex;justify-content:space-between;font-size:0.9rem;padding:4px 0;"><span>${os}</span><strong>${res.numerosOs[idx] || 'S/N'}</strong></div>`).join('') 
                        : '<div style="font-size: 0.9rem; color: #888;">Sin cobertura</div>'
                    }
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ================= ARCHIVAR / RESTAURAR =================
let residentToArchive = null;
window.openArchiveModal = function(nombre) { residentToArchive = nombre; document.getElementById('archiveName').textContent = nombre; document.getElementById('archiveModal').classList.add('show'); }
function closeArchiveModal() { document.getElementById('archiveModal').classList.remove('show'); residentToArchive = null; }

async function executeArchive() {
    const btn = document.getElementById('confirmArchive'); btn.disabled = true; btn.innerHTML = 'Archivando...';
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'archiveResident', payload: { nombre: residentToArchive, fechaSalida: document.getElementById('archiveDate').value } }) });
        if((await res.json()).status === 'success') { closeArchiveModal(); fetchActivos(); fetchArchivados(); }
    } catch(e){} finally { btn.disabled = false; btn.innerHTML = 'Archivar Residente'; }
}

async function executeRestore(nombre) {
    if (!confirm(`¿Restaurar a ${nombre}?`)) return;
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'restoreResident', payload: { nombre: nombre } }) });
        if((await res.json()).status === 'success') { fetchActivos(); fetchArchivados(); }
    } catch(e){}
}
