// [Descripción: Lógica principal del Dashboard. Se eliminó definitivamente CUALQUIER abreviatura. Ahora muestra de forma estricta e íntegra "Apellido + Nombre Pila" en mosaicos, listas e informes. Incluye el diccionario de 63 columnas (+ columnas de Archivados), el creador de filtros personalizados y la división de listas por género.]

const API_URL = 'https://script.google.com/macros/s/AKfycbwS1IP_hh93Alc9YzCxNQr-k0YUh-FDjh8SqEyB4hBz5oUz4sJlHFFYR7nPSyw-89ZM/exec';
const FALLBACK_IMAGE = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

let globalActivos = [];
let globalArchivados = [];

let currentView = 'grid'; 
let currentSortField = 'nombre';
let currentSortDir = 'asc';
let currentReportId = 'default';
let customSelectionArray = []; 

// ================= UTILIDADES Y FORMATEO =================
function getArray(arr, idx) { 
    return (arr && arr[idx] && arr[idx].trim() !== '') ? arr[idx] : '-'; 
}

function formatFecha(f) { 
    if(!f) return '-'; 
    try { 
        return f.includes('T') ? f.split('T')[0] : f; 
    } catch { 
        return f; 
    } 
}

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
    
    if(f.includes('/')) {
        year = parseInt(f.split('/')[2]);
    } else if(f.includes('-')) {
        year = parseInt(f.split('-')[0]);
    } else {
        year = new Date(f).getFullYear();
    }
    
    return (new Date().getFullYear() - year) + ' años';
}

function goToProfile(nombreCompletoAncla) { 
    window.location.href = `resident.html?id=${encodeURIComponent(nombreCompletoAncla)}`; 
}

// [Descripción: Función estricta para extraer únicamente el Apellido y el Primer Nombre enteros, sin abreviar absolutamente nada, y descartando segundos nombres o segundos apellidos.]
function getDisplayName(r) {
    let apellido = r.apellido ? r.apellido.trim() : '';
    let nombrePila = r.nombrePila ? r.nombrePila.trim() : '';
    
    // Fallback por si es un residente viejo y no tiene las columnas separadas
    if (!apellido && !nombrePila) {
        return r.nombreCorto || r.nombre;
    }
    
    // Retorna estrictamente el Apellido y el Primer Nombre completos
    return (apellido + ' ' + nombrePila).trim();
}

// ================= DICCIONARIO MAESTRO DE COLUMNAS =================
const COLUMNS_DICT = {
    // 1. Datos Personales
    'nombre': { tab: 'Datos Personales', label: 'Nombre', extract: r => currentView === 'list' ? getDisplayName(r) : r.nombre },
    'numeroSocio': { tab: 'Datos Personales', label: 'N° de Socio', extract: r => r.numeroSocio || '-' },
    'apodo': { tab: 'Datos Personales', label: 'Apodo', extract: r => r.apodo || '-' },
    'fechaNacimiento': { tab: 'Datos Personales', label: 'Fecha Nacimiento', extract: r => formatFecha(r.fechaNacimiento) },
    'edad': { tab: 'Datos Personales', label: 'Edad Actual', extract: r => r.edad || '-' },
    'edadCumple': { tab: 'Datos Personales', label: 'Edad a Cumplir', extract: r => calculateAgeToTurn(r.fechaNacimiento) },
    'dni': { tab: 'Datos Personales', label: 'DNI', extract: r => r.dni || '-' },
    'cuil': { tab: 'Datos Personales', label: 'CUIL', extract: r => r.cuil || '-' },
    'numeroTramite': { tab: 'Datos Personales', label: 'N° de Trámite', extract: r => r.numeroTramite || '-' },
    'domicilio': { tab: 'Datos Personales', label: 'Domicilio', extract: r => r.domicilio || '-' },
    'nacionalidad': { tab: 'Datos Personales', label: 'Nacionalidad', extract: r => r.nacionalidad || '-' },
    'fechaIngreso': { tab: 'Datos Personales', label: 'Fecha Ingreso', extract: r => formatFecha(r.fechaIngreso) },
    'genero': { tab: 'Datos Personales', label: 'Género', extract: r => formatGenero(r.genero) },
    'estado': { tab: 'Datos Personales', label: 'Estado', extract: r => r.estado || 'Activo' },

    // 2. Datos Médicos
    'lugarInternacion': { tab: 'Datos Médicos', label: 'Lugar Internación', extract: r => r.lugarInternacion || '-' },
    'alergias': { tab: 'Datos Médicos', label: 'Alergias', extract: r => r.alergias || '-' },
    'medicoCabecera': { tab: 'Datos Médicos', label: 'Médico Cab. 1', extract: r => getArray(r.medicosList, 0) },
    'esp1': { tab: 'Datos Médicos', label: 'Especialidad 1', extract: r => getArray(r.especialidadList, 0) },
    'med2': { tab: 'Datos Médicos', label: 'Médico Cab. 2', extract: r => getArray(r.medicosList, 1) },
    'esp2': { tab: 'Datos Médicos', label: 'Especialidad 2', extract: r => getArray(r.especialidadList, 1) },
    'med3': { tab: 'Datos Médicos', label: 'Médico Cab. 3', extract: r => getArray(r.medicosList, 2) },
    'esp3': { tab: 'Datos Médicos', label: 'Especialidad 3', extract: r => getArray(r.especialidadList, 2) },

    // 3. Obra Social
    'obraSocial': { tab: 'Obra Social', label: 'Obra Social 1', extract: r => getArray(r.obrasSociales, 0) },
    'nroOs1': { tab: 'Obra Social', label: 'N° Afiliado 1', extract: r => getArray(r.numerosOs, 0) },
    'dorsoOs1': { tab: 'Obra Social', label: 'N° Dorso 1', extract: r => getArray(r.dorsosOs, 0) },
    'os2': { tab: 'Obra Social', label: 'Obra Social 2', extract: r => getArray(r.obrasSociales, 1) },
    'nroOs2': { tab: 'Obra Social', label: 'N° Afiliado 2', extract: r => getArray(r.numerosOs, 1) },
    'dorsoOs2': { tab: 'Obra Social', label: 'N° Dorso 2', extract: r => getArray(r.dorsosOs, 1) },
    'os3': { tab: 'Obra Social', label: 'Obra Social 3', extract: r => getArray(r.obrasSociales, 2) },
    'nroOs3': { tab: 'Obra Social', label: 'N° Afiliado 3', extract: r => getArray(r.numerosOs, 2) },
    'dorsoOs3': { tab: 'Obra Social', label: 'N° Dorso 3', extract: r => getArray(r.dorsosOs, 2) },

    // 4. Familiares Responsables
    'resp1': { tab: 'Familiares y Responsables', label: 'Responsable 1', extract: r => getArray(r.responsablesList, 0) },
    'par1': { tab: 'Familiares y Responsables', label: 'Parentesco 1', extract: r => getArray(r.parentescoList, 0) },
    'tel1': { tab: 'Familiares y Responsables', label: 'Teléfono 1', extract: r => getArray(r.telefonosList, 0) },
    'dniR1': { tab: 'Familiares y Responsables', label: 'DNI Resp 1', extract: r => getArray(r.dniResponsablesList, 0) },
    'domR1': { tab: 'Familiares y Responsables', label: 'Domicilio Resp 1', extract: r => getArray(r.domicilioResponsablesList, 0) },
    
    'resp2': { tab: 'Familiares y Responsables', label: 'Responsable 2', extract: r => getArray(r.responsablesList, 1) },
    'par2': { tab: 'Familiares y Responsables', label: 'Parentesco 2', extract: r => getArray(r.parentescoList, 1) },
    'tel2': { tab: 'Familiares y Responsables', label: 'Teléfono 2', extract: r => getArray(r.telefonosList, 1) },
    'dniR2': { tab: 'Familiares y Responsables', label: 'DNI Resp 2', extract: r => getArray(r.dniResponsablesList, 1) },
    'domR2': { tab: 'Familiares y Responsables', label: 'Domicilio Resp 2', extract: r => getArray(r.domicilioResponsablesList, 1) },
    
    'resp3': { tab: 'Familiares y Responsables', label: 'Responsable 3', extract: r => getArray(r.responsablesList, 2) },
    'par3': { tab: 'Familiares y Responsables', label: 'Parentesco 3', extract: r => getArray(r.parentescoList, 2) },
    'tel3': { tab: 'Familiares y Responsables', label: 'Teléfono 3', extract: r => getArray(r.telefonosList, 2) },
    'dniR3': { tab: 'Familiares y Responsables', label: 'DNI Resp 3', extract: r => getArray(r.dniResponsablesList, 2) },
    'domR3': { tab: 'Familiares y Responsables', label: 'Domicilio Resp 3', extract: r => getArray(r.domicilioResponsablesList, 2) },
    
    'resp4': { tab: 'Familiares y Responsables', label: 'Responsable 4', extract: r => getArray(r.responsablesList, 3) },
    'par4': { tab: 'Familiares y Responsables', label: 'Parentesco 4', extract: r => getArray(r.parentescoList, 3) },
    'tel4': { tab: 'Familiares y Responsables', label: 'Teléfono 4', extract: r => getArray(r.telefonosList, 3) },
    'dniR4': { tab: 'Familiares y Responsables', label: 'DNI Resp 4', extract: r => getArray(r.dniResponsablesList, 3) },
    'domR4': { tab: 'Familiares y Responsables', label: 'Domicilio Resp 4', extract: r => getArray(r.domicilioResponsablesList, 3) },
    
    'resp5': { tab: 'Familiares y Responsables', label: 'Responsable 5', extract: r => getArray(r.responsablesList, 4) },
    'par5': { tab: 'Familiares y Responsables', label: 'Parentesco 5', extract: r => getArray(r.parentescoList, 4) },
    'tel5': { tab: 'Familiares y Responsables', label: 'Teléfono 5', extract: r => getArray(r.telefonosList, 4) },
    'dniR5': { tab: 'Familiares y Responsables', label: 'DNI Resp 5', extract: r => getArray(r.dniResponsablesList, 4) },
    'domR5': { tab: 'Familiares y Responsables', label: 'Domicilio Resp 5', extract: r => getArray(r.domicilioResponsablesList, 4) },

    // 5. Links y Drive
    'carpetaDrive': { tab: 'Links', label: 'ID Carpeta', extract: r => r.carpetaDrive || '-' },
    'fotoUrl': { tab: 'Links', label: 'Foto Perfil', extract: r => r.fotoUrl ? 'Sí' : 'No' },
    'dniArchivo1': { tab: 'Links', label: 'DNI Frente', extract: r => r.dniArchivo1 ? 'Cargado' : 'Falta' },
    'dniArchivo2': { tab: 'Links', label: 'DNI Dorso', extract: r => r.dniArchivo2 ? 'Cargado' : 'Falta' },
    'osFrente1': { tab: 'Links', label: 'OS Frente 1', extract: r => r.osFrente1 ? 'Cargado' : 'Falta' },
    'osDorso1': { tab: 'Links', label: 'OS Dorso 1', extract: r => r.osDorso1 ? 'Cargado' : 'Falta' },
    'osFrente2': { tab: 'Links', label: 'OS Frente 2', extract: r => r.osFrente2 ? 'Cargado' : 'Falta' },
    'osDorso2': { tab: 'Links', label: 'OS Dorso 2', extract: r => r.osDorso2 ? 'Cargado' : 'Falta' },
    'osFrente3': { tab: 'Links', label: 'OS Frente 3', extract: r => r.osFrente3 ? 'Cargado' : 'Falta' },
    'osDorso3': { tab: 'Links', label: 'OS Dorso 3', extract: r => r.osDorso3 ? 'Cargado' : 'Falta' },
    'respFrente1': { tab: 'Links', label: 'DNI Resp Fr 1', extract: r => r.respFrente1 ? 'Cargado' : 'Falta' },
    'respDorso1': { tab: 'Links', label: 'DNI Resp Do 1', extract: r => r.respDorso1 ? 'Cargado' : 'Falta' },
    'respFrente2': { tab: 'Links', label: 'DNI Resp Fr 2', extract: r => r.respFrente2 ? 'Cargado' : 'Falta' },
    'respDorso2': { tab: 'Links', label: 'DNI Resp Do 2', extract: r => r.respDorso2 ? 'Cargado' : 'Falta' },
    'respFrente3': { tab: 'Links', label: 'DNI Resp Fr 3', extract: r => r.respFrente3 ? 'Cargado' : 'Falta' },
    'respDorso3': { tab: 'Links', label: 'DNI Resp Do 3', extract: r => r.respDorso3 ? 'Cargado' : 'Falta' },
    'respFrente4': { tab: 'Links', label: 'DNI Resp Fr 4', extract: r => r.respFrente4 ? 'Cargado' : 'Falta' },
    'respDorso4': { tab: 'Links', label: 'DNI Resp Do 4', extract: r => r.respDorso4 ? 'Cargado' : 'Falta' },
    'respFrente5': { tab: 'Links', label: 'DNI Resp Fr 5', extract: r => r.respFrente5 ? 'Cargado' : 'Falta' },
    'respDorso5': { tab: 'Links', label: 'DNI Resp Do 5', extract: r => r.respDorso5 ? 'Cargado' : 'Falta' },

    // 6. Archivados
    'fechaSalida': { tab: 'Archivados', label: 'Fecha de Salida', extract: r => formatFecha(r.fechaSalida) },
    'motivoSalida': { tab: 'Archivados', label: 'Motivo de Salida', extract: r => r.motivoSalida || '-' },
    'detalleSalida': { tab: 'Archivados', label: 'Detalle', extract: r => r.detalleSalida || '-' },
    'lugarDerivacion': { tab: 'Archivados', label: 'Lugar Derivación', extract: r => r.lugarDerivacion || '-' },
    'responsableSalida': { tab: 'Archivados', label: 'Responsable Retiro', extract: r => r.responsableSalida || '-' },
    'dniResponsableSalida': { tab: 'Archivados', label: 'DNI Resp. Retiro', extract: r => r.dniResponsableSalida || '-' },
    'horaDeceso': { tab: 'Archivados', label: 'Hora Deceso', extract: r => r.horaDeceso || '-' },
    'linkCertificadoDefuncion': { tab: 'Archivados', label: 'Cert. Defunción', extract: r => r.linkCertificadoDefuncion || '-' }
};

// ================= REPORTES PREDEFINIDOS =================
const PRESET_REPORTS = {
    'default': { title: 'Residentes', cols: ['nombre', 'dni', 'edad', 'numeroSocio', 'obraSocial'] },
    'cumple': { title: 'Cumpleaños', cols: ['numeroSocio', 'nombre', 'fechaNacimiento', 'edadCumple'] },
    'os': { title: 'Obra Social', cols: ['numeroSocio', 'nombre', 'dni', 'obraSocial', 'nroOs1', 'os2', 'nroOs2'] },
    'fam': { title: 'Familiares y Responsables', cols: ['nombre', 'resp1', 'tel1', 'resp2', 'tel2', 'resp3', 'tel3'] }
};

let customReports = JSON.parse(localStorage.getItem('customReports')) || {};

// ================= INICIALIZACIÓN =================
document.addEventListener('DOMContentLoaded', () => {
    setupTabs(); 
    setupEventListeners(); 
    loadCustomReportsToDropdown(); 
    fetchActivos(); 
    fetchArchivados();
});

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden')); 
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.remove('hidden');
        });
    });
}

function setupEventListeners() {
    document.getElementById('searchActivos').addEventListener('input', applyFiltersAndRender);
    
    const searchArchInput = document.getElementById('searchArchivados');
    if (searchArchInput) {
        searchArchInput.addEventListener('input', applyArchivedFiltersAndRender);
    }
    
    document.getElementById('btnViewGrid').addEventListener('click', () => { 
        currentView = 'grid'; 
        updateViewButtons(); 
        applyFiltersAndRender(); 
    });
    
    document.getElementById('btnViewList').addEventListener('click', () => { 
        currentView = 'list'; 
        updateViewButtons(); 
        applyFiltersAndRender(); 
    });
    
    document.getElementById('sortField').addEventListener('change', (e) => { 
        currentSortField = e.target.value; 
        applyFiltersAndRender(); 
    });
    
    document.getElementById('sortDirection').addEventListener('change', (e) => { 
        currentSortDir = e.target.value; 
        applyFiltersAndRender(); 
    });
    
    document.getElementById('reportPreset').addEventListener('change', (e) => { 
        currentReportId = e.target.value; 
        currentView = 'list'; 
        updateViewButtons(); 
        applyFiltersAndRender(); 
    });
    
    document.getElementById('closeModal').onclick = closeArchiveModal;
    document.getElementById('cancelArchive').onclick = closeArchiveModal;
    document.getElementById('confirmArchive').onclick = executeArchive;

    const motivoSelect = document.getElementById('archiveMotivo');
    if (motivoSelect) {
        motivoSelect.addEventListener('change', handleArchiveMotivoChange);
    }
}

function updateViewButtons() {
    document.getElementById('btnViewGrid').classList.toggle('active', currentView === 'grid');
    document.getElementById('btnViewList').classList.toggle('active', currentView === 'list');
}

// ================= FETCH AL SERVIDOR =================
async function fetchActivos() {
    const loader = document.getElementById('loaderActivos'); 
    loader.classList.remove('hidden');
    
    try {
        const res = await fetch(`${API_URL}?action=getResidents`);
        const json = await res.json();
        
        if (json.status === 'success') { 
            globalActivos = json.data; 
            applyFiltersAndRender(); 
        } 
    } catch (e) {
        console.error("Error cargando activos", e);
    } finally { 
        loader.classList.add('hidden'); 
    }
}

async function fetchArchivados() {
    const loader = document.getElementById('loaderArchivados'); 
    loader.classList.remove('hidden');
    
    try {
        const res = await fetch(`${API_URL}?action=getArchived`);
        const json = await res.json();
        
        if (json.status === 'success') { 
            globalArchivados = json.data; 
            applyArchivedFiltersAndRender(); 
        }
    } catch (e) {
        console.error("Error cargando archivados", e);
    } finally { 
        loader.classList.add('hidden'); 
    }
}

// ================= ORDENAMIENTO DINÁMICO =================
function applyArchivedFiltersAndRender() {
    const searchInput = document.getElementById('searchArchivados');
    const term = searchInput ? searchInput.value.toLowerCase() : '';

    let filtered = globalArchivados.filter(r => 
        r.nombre.toLowerCase().includes(term) || 
        (r.dni && r.dni.toLowerCase().includes(term)) ||
        (r.motivoSalida && r.motivoSalida.toLowerCase().includes(term))
    );

    renderGrid(filtered, 'gridArchivados', true);
}

function applyFiltersAndRender() {
    const term = document.getElementById('searchActivos').value.toLowerCase();
    
    let filtered = globalActivos.filter(r => 
        r.nombre.toLowerCase().includes(term) || (r.dni && r.dni.includes(term))
    );

    filtered.sort((a, b) => {
        // En el sort usamos r.apellido puro original para asegurar que la "A-Z" no se rompa nunca
        let valA = currentSortField === 'nombre' ? (a.apellido || a.nombre) : (COLUMNS_DICT[currentSortField] ? COLUMNS_DICT[currentSortField].extract(a) : a[currentSortField]);
        let valB = currentSortField === 'nombre' ? (b.apellido || b.nombre) : (COLUMNS_DICT[currentSortField] ? COLUMNS_DICT[currentSortField].extract(b) : b[currentSortField]);
        
        valA = valA ? valA.toString().toLowerCase() : ''; 
        valB = valB ? valB.toString().toLowerCase() : '';
        
        if (!isNaN(valA) && !isNaN(valB)) { 
            valA = parseFloat(valA); 
            valB = parseFloat(valB); 
        }
        
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

// ================= VISTA LISTA / GÉNERO DIVIDIDO / AUTO-ESCALA =================
function renderList(data) {
    const listContainer = document.getElementById('listActivos');
    listContainer.innerHTML = '';

    let reportDef = PRESET_REPORTS[currentReportId] || customReports[currentReportId] || PRESET_REPORTS['default'];
    let activeCols = [...reportDef.cols];
    
    document.getElementById('printTitle').textContent = reportDef.title;
    
    // Auto-ajuste de la fuente baseada en la cantidad de columnas (Ideal para impresión A4)
    let fontSize = '13.5px';
    if(activeCols.length > 5) fontSize = '11.5px';
    if(activeCols.length > 7) fontSize = '10px';
    if(activeCols.length > 10) fontSize = '9px';

    // Orden Dinámico: Mover la columna ordenada a la izquierda (después del nombre)
    if (currentReportId === 'default' && currentSortField !== 'nombre' && currentSortField !== 'genero') {
        activeCols = ['nombre', currentSortField];
        
        if (currentSortField === 'edad') {
            activeCols.push('fechaNacimiento');
        }
        if (currentSortField === 'numeroSocio') {
            activeCols.push('fechaIngreso');
        }
        
        PRESET_REPORTS['default'].cols.forEach(c => { 
            if (!activeCols.includes(c)) {
                activeCols.push(c); 
            }
        });
    }

    // DIVISIÓN POR GÉNERO
    if (currentSortField === 'genero') {
        let males = data.filter(r => formatGenero(r.genero) === 'Masculino');
        let females = data.filter(r => formatGenero(r.genero) === 'Femenino');
        
        let splitHtml = `<div class="gender-split">`;
        splitHtml += buildTableHtml(males, activeCols, 'Hombres', fontSize);
        splitHtml += buildTableHtml(females, activeCols, 'Mujeres', fontSize);
        splitHtml += `</div>`;
        
        listContainer.innerHTML = splitHtml;
    } else {
        listContainer.innerHTML = buildTableHtml(data, activeCols, null, fontSize);
    }
}

// Constructor de Tablas (apto para imprimir y hacer clic)
function buildTableHtml(data, cols, title, fontSize) {
    let html = title ? `<div class="gender-column"><h3 class="gender-title">${title}</h3>` : '';
    html += `<table class="data-table" style="font-size: ${fontSize};"><thead><tr><th>#</th>`;
    
    cols.forEach(c => { 
        if (COLUMNS_DICT[c]) {
            html += `<th>${COLUMNS_DICT[c].label}</th>`; 
        }
    });
    
    html += `</tr></thead><tbody>`;
    
    if (data.length === 0) {
        html += `<tr><td colspan="${cols.length + 1}" style="text-align:center;">No hay residentes</td></tr>`;
    } else {
        data.forEach((res, idx) => {
            // El clic redirige al perfil usando el Nombre Completo original (ancla) para que funcione la URL
            html += `<tr onclick="goToProfile('${res.nombre.replace(/'/g, "\\'")}')"><td>${idx + 1}</td>`;
            cols.forEach(c => { 
                if (COLUMNS_DICT[c]) {
                    html += `<td>${COLUMNS_DICT[c].extract(res)}</td>`; 
                }
            });
            html += `</tr>`;
        });
    }
    
    html += `</tbody></table>`;
    
    if (title) {
        html += `</div>`;
    }
    
    return html;
}

// ================= MODAL REPORTES PERSONALIZADOS =================
window.openCustomReportModal = function() {
    const container = document.getElementById('columnsPickerContainer');
    container.innerHTML = ''; 
    customSelectionArray = [];
    
    // Inyecta las pestañas y todos sus checkboxes basados en el DICCIONARIO MAESTRO
    const tabs = [...new Set(Object.values(COLUMNS_DICT).map(item => item.tab))];
    
    tabs.forEach(tabName => {
        let groupHtml = `<div class="report-tab-group"><div class="report-tab-title">${tabName}</div><div class="columns-picker">`;
        
        Object.keys(COLUMNS_DICT).forEach(key => {
            if (COLUMNS_DICT[key].tab === tabName) {
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

window.closeCustomReportModal = function() { 
    document.getElementById('reportModal').classList.remove('show'); 
}

window.handleCustomColSelect = function(chk, label) {
    if (chk.checked) {
        customSelectionArray.push({ key: chk.value, label: label });
    } else {
        customSelectionArray = customSelectionArray.filter(i => i.key !== chk.value);
    }
    updateSelectedOrderUI();
}

function updateSelectedOrderUI() {
    const container = document.getElementById('selectedTagsContainer');
    if (customSelectionArray.length === 0) {
        container.innerHTML = '<span style="color:#999; font-style:italic;">Seleccione las opciones debajo...</span>';
    } else {
        container.innerHTML = customSelectionArray.map((item, i) => `<span class="tag-item"><span class="tag-number">${i+1}</span> ${item.label}</span>`).join('');
    }
}

window.saveCustomReport = function() {
    const title = document.getElementById('customReportTitle').value.trim() || 'Filtro Personalizado';
    
    if (customSelectionArray.length === 0) {
        return alert("Debe seleccionar al menos una columna.");
    }

    const reportId = 'custom_' + new Date().getTime();
    customReports[reportId] = { title: title, cols: customSelectionArray.map(i => i.key) };
    
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
    
    Array.from(select.options).forEach(opt => { 
        if (opt.value.startsWith('custom_')) {
            opt.remove(); 
        }
    });
    
    Object.keys(customReports).forEach(key => {
        select.insertAdjacentHTML('beforeend', `<option value="${key}">⭐ ${customReports[key].title}</option>`);
    });
}

// ================= IMPRESIÓN =================
window.executePrint = function() {
    const wasGrid = currentView === 'grid';
    
    if (wasGrid) { 
        currentView = 'list'; 
        applyFiltersAndRender(); 
    }
    
    const today = new Date();
    document.getElementById('printDate').textContent = "Fecha de informe: " + today.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    setTimeout(() => { 
        window.print(); 
        
        if (wasGrid) { 
            currentView = 'grid'; 
            applyFiltersAndRender(); 
        }
    }, 500); 
}

// ================= VISTA MOSAICO (TARJETAS) =================
function renderGrid(data, containerId, isArchived) {
    const grid = document.getElementById(containerId); 
    grid.innerHTML = '';
    
    if (data.length === 0) { 
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">No hay registros.</p>'; 
        return; 
    }

    data.forEach(res => {
        const card = document.createElement('div');
        card.className = `card ${isArchived ? 'archived-card' : ''}`;
        card.style.cursor = 'pointer'; 
        
        card.onclick = function(e) {
            e.preventDefault(); 
            e.stopPropagation(); 
            
            const actionBtn = e.target.closest('.btn-archive-card');
            
            if (actionBtn) {
                if (actionBtn.dataset.action === 'archive') {
                    openArchiveModal(res.nombre, res.numeroSocio);
                } else if (actionBtn.dataset.action === 'restore') {
                    executeRestore(res.nombre, res.numeroSocio, actionBtn);
                }
                return;
            }
            goToProfile(res.nombre);
        };

        const imgSrc = res.fotoUrl && res.fotoUrl !== '' ? res.fotoUrl : FALLBACK_IMAGE;
        const actionBtnHtml = !isArchived 
            ? `<button type="button" class="btn-archive-card" data-action="archive" title="Archivar"><i class="fa-solid fa-box-archive"></i></button>` 
            : `<button type="button" class="btn-archive-card" data-action="restore" title="Restaurar"><i class="fa-solid fa-box-open"></i></button>`;

        card.innerHTML = `
            ${actionBtnHtml}
            <div class="card-header">
                <img src="${imgSrc}" class="card-img" onerror="this.src='${FALLBACK_IMAGE}'">
                <div class="card-title">
                    <h3>${getDisplayName(res)}</h3>
                </div>
            </div>
            <div class="card-body">
                <div class="info-row">
                    <span><i class="fa-solid fa-id-card"></i> DNI:</span>
                    <strong>${res.dni || 'N/A'}</strong>
                </div>
                <div class="info-row">
                    <span><i class="fa-solid fa-calendar-days"></i> Edad:</span>
                    <strong>${res.edad ? res.edad + ' años' : 'N/A'}</strong>
                </div>
                <div class="info-row">
                    <span><i class="fa-solid fa-hashtag"></i> N° Socio:</span>
                    <strong>${res.numeroSocio || 'N/A'}</strong>
                </div>
                ${isArchived && res.fechaSalida ? `
                <div class="info-row">
                    <span><i class="fa-solid fa-door-open"></i> Salida:</span>
                    <strong>\${formatFecha(res.fechaSalida)}</strong>
                </div>` : ''}
                ${isArchived && res.motivoSalida ? `
                <div class="info-row">
                    <span><i class="fa-solid fa-circle-info"></i> Motivo:</span>
                    <strong style="text-transform: capitalize;">\${res.motivoSalida}</strong>
                </div>` : ''}
                <div class="info-row" style="flex-direction: column; gap: 8px; margin-top: 10px; border-top: 1px dashed var(--border-color); padding-top: 10px;">
                    <span style="color: var(--primary-blue); font-weight: 600;"><i class="fa-solid fa-notes-medical"></i> Obras Sociales:</span>
                    ${(res.obrasSociales && res.obrasSociales.length > 0 && res.obrasSociales[0] !== "") 
                        ? res.obrasSociales.map((os, idx) => `<div style="display:flex;justify-content:space-between;font-size:0.9rem;padding:4px 0;"><span style="word-break: break-word; flex: 1; padding-right: 10px;">${os}</span><strong>${res.numerosOs[idx] || 'S/N'}</strong></div>`).join('') 
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
let socioToArchive = null;

function handleArchiveMotivoChange() {
    const motivo = document.getElementById('archiveMotivo').value;
    const groupDerivacion = document.getElementById('groupDerivacion');
    const groupResponsable = document.getElementById('groupResponsableSalida');
    const groupFallecimiento = document.getElementById('groupFallecimiento');

    if (groupDerivacion) groupDerivacion.style.display = 'none';
    if (groupResponsable) groupResponsable.style.display = 'none';
    if (groupFallecimiento) groupFallecimiento.style.display = 'none';

    if (motivo === 'derivación medica de urgencia') {
        if (groupDerivacion) groupDerivacion.style.display = 'block';
    } else if (motivo === 'traslado voluntario' || motivo === 'retiro por alta') {
        if (groupResponsable) groupResponsable.style.display = 'block';
    } else if (motivo === 'retiro por fallecimiento') {
        if (groupFallecimiento) groupFallecimiento.style.display = 'block';
    }
}

window.openArchiveModal = function(nombre, numeroSocio = '') { 
    residentToArchive = nombre;
    
    if (!numeroSocio) {
        const found = globalActivos.find(r => r.nombre === nombre);
        socioToArchive = found ? (found.numeroSocio || '') : '';
    } else {
        socioToArchive = numeroSocio;
    }

    document.getElementById('archiveName').textContent = nombre; 
    const badge = document.getElementById('archiveSocioBadge');
    if (badge) {
        badge.textContent = socioToArchive ? `(Socio N° ${socioToArchive})` : '';
    }

    // Fecha local de hoy en formato YYYY-MM-DD
    const now = new Date();
    const localToday = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    document.getElementById('archiveDate').value = localToday;

    if (document.getElementById('archiveMotivo')) document.getElementById('archiveMotivo').value = '';
    if (document.getElementById('archiveDetalle')) document.getElementById('archiveDetalle').value = '';
    if (document.getElementById('archiveLugarDerivacion')) document.getElementById('archiveLugarDerivacion').value = '';
    if (document.getElementById('archiveResponsable')) document.getElementById('archiveResponsable').value = '';
    if (document.getElementById('archiveDniResponsable')) document.getElementById('archiveDniResponsable').value = '';
    if (document.getElementById('archiveHoraDeceso')) document.getElementById('archiveHoraDeceso').value = '';
    if (document.getElementById('archiveLinkCertificado')) document.getElementById('archiveLinkCertificado').value = '';

    handleArchiveMotivoChange();
    document.getElementById('archiveModal').classList.add('show'); 
}

function closeArchiveModal() { 
    document.getElementById('archiveModal').classList.remove('show'); 
    residentToArchive = null; 
    socioToArchive = null;
}

async function executeArchive() {
    const fechaSalida = document.getElementById('archiveDate').value.trim();
    const motivoSalida = document.getElementById('archiveMotivo') ? document.getElementById('archiveMotivo').value.trim() : '';
    const detalleSalida = document.getElementById('archiveDetalle') ? document.getElementById('archiveDetalle').value.trim() : '';
    const lugarDerivacion = document.getElementById('archiveLugarDerivacion') ? document.getElementById('archiveLugarDerivacion').value.trim() : '';
    const responsableSalida = document.getElementById('archiveResponsable') ? document.getElementById('archiveResponsable').value.trim() : '';
    const dniResponsableSalida = document.getElementById('archiveDniResponsable') ? document.getElementById('archiveDniResponsable').value.trim() : '';
    const horaDeceso = document.getElementById('archiveHoraDeceso') ? document.getElementById('archiveHoraDeceso').value.trim() : '';
    const linkCertificadoDefuncion = document.getElementById('archiveLinkCertificado') ? document.getElementById('archiveLinkCertificado').value.trim() : '';

    if (!fechaSalida) {
        return alert('Por favor, indique la fecha de salida.');
    }
    if (!motivoSalida) {
        return alert('Por favor, seleccione el motivo claro de la salida.');
    }
    if (motivoSalida === 'derivación medica de urgencia' && !lugarDerivacion) {
        return alert('Por favor, complete el Lugar de Derivación.');
    }
    if ((motivoSalida === 'traslado voluntario' || motivoSalida === 'retiro por alta') && (!responsableSalida || !dniResponsableSalida)) {
        return alert('Por favor, complete el Responsable y el DNI del responsable.');
    }
    if (motivoSalida === 'retiro por fallecimiento' && (!horaDeceso || !linkCertificadoDefuncion)) {
        return alert('Por favor, complete la Hora del deceso y el Link del certificado de defunción.');
    }

    const btn = document.getElementById('confirmArchive'); 
    btn.disabled = true; 
    btn.innerHTML = 'Archivando...';
    
    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: 'archiveResident', 
                payload: { 
                    nombre: residentToArchive, 
                    numeroSocio: socioToArchive,
                    fechaSalida: fechaSalida,
                    motivoSalida: motivoSalida,
                    detalleSalida: detalleSalida,
                    lugarDerivacion: motivoSalida === 'derivación medica de urgencia' ? lugarDerivacion : '',
                    responsableSalida: (motivoSalida === 'traslado voluntario' || motivoSalida === 'retiro por alta') ? responsableSalida : '',
                    dniResponsableSalida: (motivoSalida === 'traslado voluntario' || motivoSalida === 'retiro por alta') ? dniResponsableSalida : '',
                    horaDeceso: motivoSalida === 'retiro por fallecimiento' ? horaDeceso : '',
                    linkCertificadoDefuncion: motivoSalida === 'retiro por fallecimiento' ? linkCertificadoDefuncion : ''
                } 
            }) 
        });
        
        const jsonResult = await res.json();
        
        if(jsonResult.status === 'success') { 
            closeArchiveModal(); 
            fetchActivos(); 
            fetchArchivados(); 
        } else {
            alert('Error al archivar: ' + (jsonResult.message || 'Error desconocido'));
        }
    } catch(e) {
        console.error(e);
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = 'Archivar Residente'; 
    }
}

async function executeRestore(nombre, numeroSocio = '', btnElement = null) {
    if (btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }
    
    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: 'restoreResident', 
                payload: { 
                    nombre: nombre,
                    numeroSocio: numeroSocio
                } 
            }) 
        });
        
        const jsonResult = await res.json();
        
        if(jsonResult.status === 'success') { 
            fetchActivos(); 
            fetchArchivados(); 
        } else if (btnElement) {
            btnElement.disabled = false;
            btnElement.innerHTML = '<i class="fa-solid fa-box-open"></i>';
        }
    } catch(e) {
        console.error(e);
        if (btnElement) {
            btnElement.disabled = false;
            btnElement.innerHTML = '<i class="fa-solid fa-box-open"></i>';
        }
    }
}
