// [Descripción: Lógica del Dashboard. Se integró el sistema de Reportes (Presets y Personalizados guardados en localStorage), el motor de Ordenamiento Dinámico que reordena las columnas según el criterio, el sistema de Vistas Mosaico/Lista y el disparador de Impresión A4.]

const API_URL = 'https://script.google.com/macros/s/AKfycbwS1IP_hh93Alc9YzCxNQr-k0YUh-FDjh8SqEyB4hBz5oUz4sJlHFFYR7nPSyw-89ZM/exec';
const FALLBACK_IMAGE = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

let globalActivos = [];
let globalArchivados = [];

// ESTADO DE LA VISTA
let currentView = 'grid'; // 'grid' | 'list'
let currentSortField = 'nombre';
let currentSortDir = 'asc';
let currentReportId = 'default';

// DICCIONARIO DE COLUMNAS DISPONIBLES Y SU EXTRACCIÓN
const COLUMNS_DICT = {
    'nombre': { label: 'Nombre', extract: r => r.nombre },
    'dni': { label: 'DNI', extract: r => r.dni },
    'edad': { label: 'Edad', extract: r => r.edad },
    'numeroSocio': { label: 'N° Socio', extract: r => r.numeroSocio },
    'fechaNacimiento': { label: 'Nacimiento', extract: r => r.fechaNacimiento },
    'edadCumple': { label: 'Cumple', extract: r => calculateAgeToTurn(r.fechaNacimiento) },
    'genero': { label: 'Género', extract: r => r.genero || '-' }, 
    'fechaIngreso': { label: 'Ingreso', extract: r => r.fechaIngreso },
    'nacionalidad': { label: 'Nacionalidad', extract: r => r.nacionalidad },
    'domicilio': { label: 'Domicilio', extract: r => r.domicilio },
    'medicoCabecera': { label: 'Médico', extract: r => (r.medicosList && r.medicosList[0]) ? r.medicosList[0] : '-' },
    'obraSocial': { label: 'Obra Social 1', extract: r => (r.obrasSociales && r.obrasSociales[0]) ? r.obrasSociales[0] : '-' },
    'nroOs1': { label: 'Nro Afiliado 1', extract: r => (r.numerosOs && r.numerosOs[0]) ? r.numerosOs[0] : '-' },
    'os2': { label: 'Obra Social 2', extract: r => (r.obrasSociales && r.obrasSociales[1]) ? r.obrasSociales[1] : '-' },
    'nroOs2': { label: 'Nro Afiliado 2', extract: r => (r.numerosOs && r.numerosOs[1]) ? r.numerosOs[1] : '-' },
    'resp1': { label: 'Responsable 1', extract: r => (r.responsablesList && r.responsablesList[0]) ? r.responsablesList[0] : '-' },
    'tel1': { label: 'Teléfono 1', extract: r => (r.telefonosList && r.telefonosList[0]) ? r.telefonosList[0] : '-' },
    'resp2': { label: 'Responsable 2', extract: r => (r.responsablesList && r.responsablesList[1]) ? r.responsablesList[1] : '-' },
    'tel2': { label: 'Teléfono 2', extract: r => (r.telefonosList && r.telefonosList[1]) ? r.telefonosList[1] : '-' },
    'resp3': { label: 'Responsable 3', extract: r => (r.responsablesList && r.responsablesList[2]) ? r.responsablesList[2] : '-' },
    'tel3': { label: 'Teléfono 3', extract: r => (r.telefonosList && r.telefonosList[2]) ? r.telefonosList[2] : '-' }
};

// REPORTES PREDEFINIDOS
const PRESET_REPORTS = {
    'default': { title: 'Residentes', cols: ['nombre', 'dni', 'edad', 'numeroSocio', 'obraSocial'] },
    'cumple': { title: 'Cumpleaños', cols: ['numeroSocio', 'nombre', 'fechaNacimiento', 'edadCumple'] },
    'os': { title: 'Obra Social', cols: ['numeroSocio', 'nombre', 'dni', 'obraSocial', 'nroOs1', 'os2', 'nroOs2'] },
    'fam': { title: 'Familiares y Responsables', cols: ['nombre', 'resp1', 'tel1', 'resp2', 'tel2', 'resp3', 'tel3'] }
};

// ALMACENAMIENTO DE REPORTES PERSONALIZADOS
let customReports = JSON.parse(localStorage.getItem('customReports')) || {};

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupEventListeners();
    loadCustomReportsToDropdown();
    fetchActivos();
    fetchArchivados();
});

function calculateAgeToTurn(fechaNac) {
    if(!fechaNac) return '-';
    let year = 0;
    if(fechaNac.includes('/')) year = parseInt(fechaNac.split('/')[2]);
    else if(fechaNac.includes('-')) year = parseInt(fechaNac.split('-')[0]);
    else year = new Date(fechaNac).getFullYear();
    return (new Date().getFullYear() - year) + ' años';
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden', 'active')); 
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.remove('hidden');
        });
    });
}

function setupEventListeners() {
    document.getElementById('searchActivos').addEventListener('input', applyFiltersAndRender);
    
    // Controles de Vista
    document.getElementById('btnViewGrid').addEventListener('click', () => { currentView = 'grid'; updateViewButtons(); applyFiltersAndRender(); });
    document.getElementById('btnViewList').addEventListener('click', () => { currentView = 'list'; updateViewButtons(); applyFiltersAndRender(); });
    
    // Controles de Orden y Reporte
    document.getElementById('sortField').addEventListener('change', (e) => { currentSortField = e.target.value; applyFiltersAndRender(); });
    document.getElementById('sortDirection').addEventListener('change', (e) => { currentSortDir = e.target.value; applyFiltersAndRender(); });
    document.getElementById('reportPreset').addEventListener('change', (e) => { currentReportId = e.target.value; currentView = 'list'; updateViewButtons(); applyFiltersAndRender(); });

    // Modales de Archivo
    document.getElementById('closeModal').onclick = closeArchiveModal;
    document.getElementById('cancelArchive').onclick = closeArchiveModal;
    document.getElementById('confirmArchive').onclick = executeArchive;
}

function updateViewButtons() {
    document.getElementById('btnViewGrid').classList.toggle('active', currentView === 'grid');
    document.getElementById('btnViewList').classList.toggle('active', currentView === 'list');
}

async function fetchActivos() {
    const loader = document.getElementById('loaderActivos'); loader.classList.remove('hidden');
    try {
        const res = await fetch(`${API_URL}?action=getResidents`);
        const json = await res.json();
        if (json.status === 'success') {
            globalActivos = json.data;
            applyFiltersAndRender();
        } else { alert("Error al cargar ACTIVOS:\n" + json.message); }
    } catch (e) { alert('Error de conexión.'); } 
    finally { loader.classList.add('hidden'); }
}

async function fetchArchivados() {
    const loader = document.getElementById('loaderArchivados'); loader.classList.remove('hidden');
    try {
        const res = await fetch(`${API_URL}?action=getArchived`);
        const json = await res.json();
        if (json.status === 'success') {
            globalArchivados = json.data;
            renderGrid(globalArchivados, 'gridArchivados', true); // Archivados siempre en grid por ahora
        }
    } catch (e) {} finally { loader.classList.add('hidden'); }
}

// ================= MOTOR DE ORDENAMIENTO Y RENDERIZADO =================
function applyFiltersAndRender() {
    const term = document.getElementById('searchActivos').value.toLowerCase();
    
    // 1. Filtrar
    let filtered = globalActivos.filter(r => 
        r.nombre.toLowerCase().includes(term) || (r.dni && r.dni.includes(term))
    );

    // 2. Ordenar
    filtered.sort((a, b) => {
        let valA = COLUMNS_DICT[currentSortField] ? COLUMNS_DICT[currentSortField].extract(a) : a[currentSortField];
        let valB = COLUMNS_DICT[currentSortField] ? COLUMNS_DICT[currentSortField].extract(b) : b[currentSortField];
        
        valA = valA ? valA.toString().toLowerCase() : '';
        valB = valB ? valB.toString().toLowerCase() : '';

        // Si es número (Edad, Socio) parsear
        if(!isNaN(valA) && !isNaN(valB)) { valA = parseFloat(valA); valB = parseFloat(valB); }

        if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
        return 0;
    });

    // Separación Hombres/Mujeres si se pide por Género (Solo estético si tuvieras el campo)
    if (currentSortField === 'genero' && currentView === 'grid') {
        // En un futuro, flexbox u ordenamiento enviará 'M' a un lado y 'F' al otro.
    }

    // 3. Renderizar según vista
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

// ================= VISTA LISTA (DINÁMICA) =================
function renderList(data) {
    const thead = document.getElementById('listActivosHead');
    const tbody = document.getElementById('listActivosBody');
    thead.innerHTML = ''; tbody.innerHTML = '';

    // Determinar qué columnas mostrar
    let reportDef = PRESET_REPORTS[currentReportId] || customReports[currentReportId];
    if (!reportDef) reportDef = PRESET_REPORTS['default'];

    let activeCols = [...reportDef.cols];
    
    // LÓGICA DE ORDEN DINÁMICO: Si estamos en el reporte Default, el campo ordenado se mueve al principio (después del nombre)
    if (currentReportId === 'default' && currentSortField !== 'nombre') {
        activeCols = ['nombre', currentSortField];
        
        // Reglas solicitadas: Si es edad, sumar nacimiento. Si es socio, sumar ingreso.
        if(currentSortField === 'edad') activeCols.push('fechaNacimiento');
        if(currentSortField === 'numeroSocio') activeCols.push('fechaIngreso');
        
        // Agregar el resto de las default sin repetir
        PRESET_REPORTS['default'].cols.forEach(c => { if(!activeCols.includes(c)) activeCols.push(c); });
    }

    // Dibujar Cabeceras
    let trHead = document.createElement('tr');
    trHead.innerHTML = `<th>#</th>`; // Columna Contador
    activeCols.forEach(colKey => {
        if(COLUMNS_DICT[colKey]) trHead.innerHTML += `<th>${COLUMNS_DICT[colKey].label}</th>`;
    });
    thead.appendChild(trHead);

    // Dibujar Filas
    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${activeCols.length + 1}" style="text-align:center;">No hay resultados</td></tr>`;
        return;
    }

    data.forEach((res, index) => {
        let tr = document.createElement('tr');
        tr.innerHTML = `<td>${index + 1}</td>`;
        
        activeCols.forEach(colKey => {
            if(COLUMNS_DICT[colKey]) {
                tr.innerHTML += `<td>${COLUMNS_DICT[colKey].extract(res)}</td>`;
            }
        });
        tbody.appendChild(tr);
    });

    // Actualizar el título de impresión para que coincida con el Filtro actual
    document.getElementById('printTitle').textContent = reportDef.title;
}

// ================= VISTA MOSAICO (ORIGINAL) =================
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
            window.location.href = `resident.html?id=${encodeURIComponent(res.nombre)}`;
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

// ================= MODAL REPORTES PERSONALIZADOS =================
window.openCustomReportModal = function() {
    const container = document.getElementById('columnsPickerContainer');
    container.innerHTML = '';
    
    // Inyectar checkboxes por cada columna disponible
    Object.keys(COLUMNS_DICT).forEach(key => {
        container.innerHTML += `
            <label><input type="checkbox" value="${key}" class="report-col-chk"> ${COLUMNS_DICT[key].label}</label>
        `;
    });
    
    document.getElementById('customReportTitle').value = '';
    document.getElementById('reportModal').classList.add('show');
}

window.closeCustomReportModal = function() { document.getElementById('reportModal').classList.remove('show'); }

window.saveCustomReport = function() {
    const title = document.getElementById('customReportTitle').value.trim() || 'Filtro Personalizado';
    const checked = Array.from(document.querySelectorAll('.report-col-chk:checked')).map(cb => cb.value);
    
    if(checked.length === 0) return alert("Debe seleccionar al menos una columna");

    const reportId = 'custom_' + new Date().getTime();
    customReports[reportId] = { title: title, cols: checked };
    
    localStorage.setItem('customReports', JSON.stringify(customReports));
    
    loadCustomReportsToDropdown();
    document.getElementById('reportPreset').value = reportId;
    closeCustomReportModal();
    
    currentReportId = reportId;
    currentView = 'list';
    updateViewButtons();
    applyFiltersAndRender();
}

function loadCustomReportsToDropdown() {
    const select = document.getElementById('reportPreset');
    // Limpiar opciones personalizadas existentes
    Array.from(select.options).forEach(opt => { if(opt.value.startsWith('custom_')) opt.remove(); });
    
    // Cargar desde el storage
    Object.keys(customReports).forEach(key => {
        select.insertAdjacentHTML('beforeend', `<option value="${key}">⭐ ${customReports[key].title}</option>`);
    });
}

// ================= IMPRESIÓN =================
// [Descripción: Función de impresión actualizada. Antes de invocar window.print(), calcula la fecha actual en formato local (Ej: 31/08/2026) y la inyecta en el encabezado de la hoja para compensar la eliminación de los márgenes nativos del navegador.]
window.executePrint = function() {
    // 1. Forzar vista de Lista
    const wasGrid = currentView === 'grid';
    if(wasGrid) {
        currentView = 'list';
        applyFiltersAndRender();
    }
    
    // 2. Inyectar Fecha Actual en el Encabezado
    const today = new Date();
    const dateString = today.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    document.getElementById('printDate').textContent = "Fecha de impresión: " + dateString;
    
    // 3. Imprimir
    window.print();
    
    // 4. Restaurar vista original
    if(wasGrid) {
        currentView = 'grid';
        applyFiltersAndRender();
    }
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
