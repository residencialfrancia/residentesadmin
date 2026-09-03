// [Descripción: Variables globales e inicialización del perfil. Se capturan parámetros de la URL para saber si estamos editando un residente o creando uno nuevo.]
const API_URL = 'https://script.google.com/macros/s/AKfycbwS1IP_hh93Alc9YzCxNQr-k0YUh-FDjh8SqEyB4hBz5oUz4sJlHFFYR7nPSyw-89ZM/exec';
const FALLBACK_IMAGE = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

let currentResidentName = new URLSearchParams(window.location.search).get('id');
let isEditMode = false;
let base64ImageToUpload = null;
let currentFotoUrl = '';
let isArchivedProfile = false;
let documentsToUpload = {};
let loadedDataGlobal = null; 

document.addEventListener('DOMContentLoaded', () => {
    if (currentResidentName) {
        loadResidentData();
    } else {
        toggleEditMode('perfil', true);
        addMedicoRow('', '');
        addOsRow('', '', '');
        addResponsableRow('', '', '', '', '');
        document.getElementById('profileImage').src = FALLBACK_IMAGE;
        renderDocumentViewers({});
    }
    setupFormEvents();
});

// [Descripción: Sistema de Auto-ajuste de fuentes. Evita que textos largos (como CUIL, Nombres largos o Domicilios) se oculten o solapen. Reduce gradualmente el tamaño de la letra hasta que encaje perfecto en su caja.]
window.adjustInputFontSizes = function() {
    const inputs = document.querySelectorAll('#residentForm input[type="text"], #residentForm input[type="number"]');
    
    inputs.forEach(input => {
        if (input.offsetWidth === 0 || input.clientWidth === 0) return;
        
        input.style.fontSize = ''; 
        let currentSize = parseFloat(window.getComputedStyle(input).fontSize) || 16;
        
        const text = input.value || '';
        if (!text) return;
        
        const helper = document.createElement('span');
        const style = window.getComputedStyle(input);
        
        helper.style.fontFamily = style.fontFamily;
        helper.style.fontWeight = style.fontWeight;
        helper.style.letterSpacing = style.letterSpacing;
        helper.style.whiteSpace = 'pre';
        helper.style.position = 'absolute';
        helper.style.visibility = 'hidden';
        
        document.body.appendChild(helper);
        
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingRight = parseFloat(style.paddingRight) || 0;
        const availableWidth = input.clientWidth - paddingLeft - paddingRight - 12; 

        helper.textContent = text;
        helper.style.fontSize = currentSize + 'px';
        
        while (helper.offsetWidth > availableWidth && currentSize > 11) {
            currentSize -= 0.5;
            helper.style.fontSize = currentSize + 'px';
        }
        
        input.style.fontSize = currentSize + 'px';
        document.body.removeChild(helper);
    });
}
window.addEventListener('resize', () => setTimeout(adjustInputFontSizes, 100));

// [Descripción: Funciones utilitarias para cálculo de edad, extracción de IDs de Drive y formato de fechas.]
function calculateAgeLive() {
    const dateVal = document.getElementById('fechaNacimiento').value;
    const ageInput = document.getElementById('edad');
    
    if (!dateVal) { 
        ageInput.value = ''; 
        return; 
    }
    
    const birthDate = new Date(dateVal + 'T00:00:00'); 
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    ageInput.value = age;
}

function extractDriveId(input) {
    if (!input) return '';
    const match = input.trim().match(/([a-zA-Z0-9_-]{25,})/);
    return match ? match[1] : input.trim(); 
}

function formatToInputDate(sheetDate) {
    if(!sheetDate) return '';
    try {
        if(sheetDate.includes('/')) {
            const parts = sheetDate.split('/');
            return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        return new Date(sheetDate).toISOString().split('T')[0];
    } catch { 
        return sheetDate; 
    }
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast'); 
    toast.textContent = message; 
    toast.className = 'toast show ' + (isError ? 'error' : '');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// [Descripción: Lógica de navegación entre la pestaña del Perfil y la Documentación.]
window.switchProfileTab = function(tabName) {
    const p = document.getElementById('tab-perfil');
    const d = document.getElementById('tab-documentacion');
    const bp = document.getElementById('btnTabPerfil');
    const bd = document.getElementById('btnTabDocs');

    if (tabName === 'perfil') {
        p.classList.remove('hidden'); 
        d.classList.add('hidden');
        bp.classList.add('active'); 
        bd.classList.remove('active');
    } else {
        p.classList.add('hidden'); 
        d.classList.remove('hidden');
        bd.classList.add('active'); 
        bp.classList.remove('active');
    }
    setTimeout(adjustInputFontSizes, 100);
}

// [Descripción: Descarga los datos del residente desde Google Sheets (vía backend).]
async function loadResidentData() {
    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');

    try {
        const [resActivos, resArchivados] = await Promise.all([
            fetch(`${API_URL}?action=getResidents`).then(r => r.json()),
            fetch(`${API_URL}?action=getArchived`).then(r => r.json())
        ]);

        let todosLosResidentes = [];
        if (resActivos.status === 'success') {
            todosLosResidentes = todosLosResidentes.concat(resActivos.data);
        }
        if (resArchivados.status === 'success') {
            todosLosResidentes = todosLosResidentes.concat(resArchivados.data);
        }

        const resident = todosLosResidentes.find(r => r.nombre === currentResidentName);
        
        if (resident) {
            isArchivedProfile = (resident.estado === 'Archivado');
            loadedDataGlobal = resident;
            populateForm(resident);
        } else {
            showToast("Residente no encontrado", true);
        }
    } catch (error) {
        showToast("Error de conexión al cargar", true);
    } finally {
        loader.classList.add('hidden');
    }
}

// [Descripción: Inyecta los datos del JSON en los campos del formulario HTML. Carga Apodo, Género y gestiona los arrays dinámicos.]
function populateForm(data) {
    document.getElementById('nombre').value = data.nombre || '';
    document.getElementById('apodo').value = data.apodo || '';
    document.getElementById('numeroSocio').value = data.numeroSocio || '';
    document.getElementById('fechaNacimiento').value = formatToInputDate(data.fechaNacimiento);
    document.getElementById('edad').value = data.edad || '';
    document.getElementById('dni').value = data.dni || '';
    document.getElementById('cuil').value = data.cuil || '';
    document.getElementById('numeroTramite').value = data.numeroTramite || '';
    document.getElementById('lugarInternacion').value = data.lugarInternacion || '';
    document.getElementById('alergias').value = data.alergias || '';
    document.getElementById('fechaIngreso').value = formatToInputDate(data.fechaIngreso);
    document.getElementById('nacionalidad').value = data.nacionalidad || '';
    document.getElementById('genero').value = data.genero || '';
    document.getElementById('domicilio').value = data.domicilio || '';
    
    if (document.getElementById('carpetaDrive')) {
        document.getElementById('carpetaDrive').value = data.carpetaDrive || '';
    }

    // Llenar Médicos
    const medContainer = document.getElementById('medicosContainer');
    medContainer.innerHTML = '';
    const medicos = data.medicosList || [data.medicoCabecera];
    const especialidades = data.especialidadList || [];
    
    if (medicos.length > 0 && medicos[0]) {
        medicos.forEach((med, i) => addMedicoRow(med, especialidades[i] || ''));
    } else { 
        addMedicoRow('', ''); 
    }

    // Llenar Obras Sociales
    const osContainer = document.getElementById('obrasSocialesContainer');
    osContainer.innerHTML = '';
    
    if (data.obrasSociales && data.obrasSociales.length > 0 && data.obrasSociales[0]) {
        data.obrasSociales.forEach((os, i) => addOsRow(os, data.numerosOs[i] || '', data.dorsosOs ? data.dorsosOs[i] : ''));
    } else { 
        addOsRow('', '', ''); 
    }

    // Llenar Familiares Responsables
    const respContainer = document.getElementById('responsablesContainer');
    respContainer.innerHTML = '';
    
    if (data.responsablesList && data.responsablesList.length > 0 && data.responsablesList[0]) {
        data.responsablesList.forEach((resp, i) => {
            addResponsableRow(resp, data.parentescoList ? data.parentescoList[i] : '', data.dniResponsablesList[i] || '', data.telefonosList[i] || '', data.domicilioResponsablesList[i] || '');
        });
    } else { 
        addResponsableRow('', '', '', '', ''); 
    }

    // Control de UI para Archivados
    const divSalida = document.getElementById('divFechaSalida');
    const inputSalida = document.getElementById('fechaSalida');
    const statusBadge = document.getElementById('statusBadge'); 
    
    if (isArchivedProfile) {
        if(divSalida) divSalida.classList.remove('hidden');
        if(inputSalida) inputSalida.value = formatToInputDate(data.fechaSalida);
        if(statusBadge) {
            statusBadge.textContent = 'ARCHIVADO';
            statusBadge.classList.remove('hidden');
        }
    } else {
        if(divSalida) divSalida.classList.add('hidden');
        if(statusBadge) statusBadge.classList.add('hidden');
    }

    currentFotoUrl = data.fotoUrl;
    document.getElementById('profileImage').src = (data.fotoUrl && data.fotoUrl !== '') ? data.fotoUrl : FALLBACK_IMAGE;

    renderDocumentViewers(data);
    
    // Auto-ajustar fuentes al terminar de cargar los datos
    setTimeout(adjustInputFontSizes, 150); 
}

// [Descripción: Creación de filas dinámicas HTML. Límite máximo establecido para Obras Sociales (3), Médicos (3) y Responsables (5).]
function addMedicoRow(medValue, espValue) {
    const container = document.getElementById('medicosContainer');
    if(container.children.length >= 3) return showToast("Máximo 3 médicos permitidos.");
    
    const row = document.createElement('div');
    row.className = 'os-row'; 
    row.innerHTML = `
        <div class="form-row" style="align-items: flex-end; width: 100%; margin-bottom: 0; gap: 15px;">
            <div class="form-group flex-1">
                <label>Nombre del Médico</label>
                <input type="text" class="med-nombre" value="${medValue}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group flex-1">
                <label>Especialidad</label>
                <input type="text" class="med-esp" value="${espValue}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <button type="button" class="btn-remove-os ${!isEditMode ? 'hidden' : ''}" onclick="this.closest('.os-row').remove(); setTimeout(adjustInputFontSizes, 50);">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
    container.appendChild(row);
    setTimeout(adjustInputFontSizes, 50);
}

function addOsRow(osValue, nroValue, dorsoValue) {
    const container = document.getElementById('obrasSocialesContainer');
    if(container.children.length >= 3) return showToast("Máximo 3 obras sociales permitidas.");
    
    const row = document.createElement('div');
    row.className = 'os-row'; 
    row.innerHTML = `
        <div class="form-row" style="align-items: flex-end; width: 100%; margin-bottom: 0; gap: 15px;">
            <div class="form-group flex-1">
                <label>Obra Social</label>
                <input type="text" class="os-name" value="${osValue}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group flex-1">
                <label>N° Credencial</label>
                <input type="text" class="os-number" value="${nroValue}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group flex-1">
                <label>N° Dorso</label>
                <input type="text" class="os-dorso" value="${dorsoValue}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <button type="button" class="btn-remove-os ${!isEditMode ? 'hidden' : ''}" onclick="this.closest('.os-row').remove(); setTimeout(adjustInputFontSizes, 50);">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
    container.appendChild(row);
    setTimeout(adjustInputFontSizes, 50);
}

function addResponsableRow(nombreVal, parentezcoVal, dniVal, telVal, domVal) {
    const container = document.getElementById('responsablesContainer');
    if(container.children.length >= 5) return showToast("Máximo 5 responsables permitidos.");

    const row = document.createElement('div');
    row.className = 'responsable-block'; 
    row.innerHTML = `
        <div class="form-row" style="align-items: flex-end; flex-wrap: wrap; gap: 15px; margin-bottom: 0;">
            <div class="form-group" style="flex: 1.5; min-width: 150px;">
                <label>Nombre</label>
                <input type="text" class="resp-nombre" value="${nombreVal}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="flex: 1; min-width: 120px;">
                <label>Parentesco</label>
                <input type="text" class="resp-par" value="${parentezcoVal}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="flex: 1; min-width: 120px;">
                <label>DNI</label>
                <input type="text" class="resp-dni" value="${dniVal}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="flex: 1; min-width: 120px;">
                <label>Teléfono</label>
                <input type="text" class="resp-tel" value="${telVal}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="flex: 2; min-width: 180px; display: flex; gap: 10px; align-items: flex-end;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <label>Domicilio</label>
                    <input type="text" class="resp-dom" value="${domVal}" ${!isEditMode ? 'readonly' : ''}>
                </div>
                <button type="button" class="btn-remove-resp ${!isEditMode ? 'hidden' : ''}" onclick="this.closest('.responsable-block').remove(); setTimeout(adjustInputFontSizes, 50);">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    container.appendChild(row);
    setTimeout(adjustInputFontSizes, 50);
}

// [Descripción: Pestaña Documentos. Genera la barra lateral y los visores grandes inyectando las tarjetas de Google Drive dinámicamente.]
function renderDocumentViewers(data) {
    const docSections = [
        { id: 'dni', label: 'DNI Residente', icon: 'fa-id-card', f1: 'dniArchivo1', f2: 'dniArchivo2', t1: 'DNI Frente 1', t2: 'DNI Dorso 2' },
        { id: 'os1', label: 'Obra Social 1', icon: 'fa-notes-medical', f1: 'osFrente1', f2: 'osDorso1', t1: 'Obra Social Frente 1', t2: 'Obra Social Dorso 1' },
        { id: 'os2', label: 'Obra Social 2', icon: 'fa-notes-medical', f1: 'osFrente2', f2: 'osDorso2', t1: 'Obra Social Frente 2', t2: 'Obra Social Dorso 2' },
        { id: 'os3', label: 'Obra Social 3', icon: 'fa-notes-medical', f1: 'osFrente3', f2: 'osDorso3', t1: 'Obra Social Frente 3', t2: 'Obra Social Dorso 3' },
        { id: 'resp1', label: 'DNI Responsable 1', icon: 'fa-user-shield', f1: 'respFrente1', f2: 'respDorso1', t1: 'DNI Resp Frente 1', t2: 'DNI Resp Dorso 1' },
        { id: 'resp2', label: 'DNI Responsable 2', icon: 'fa-user-shield', f1: 'respFrente2', f2: 'respDorso2', t1: 'DNI Resp Frente 2', t2: 'DNI Resp Dorso 2' },
        { id: 'resp3', label: 'DNI Responsable 3', icon: 'fa-user-shield', f1: 'respFrente3', f2: 'respDorso3', t1: 'DNI Resp Frente 3', t2: 'DNI Resp Dorso 3' },
        { id: 'resp4', label: 'DNI Responsable 4', icon: 'fa-user-shield', f1: 'respFrente4', f2: 'respDorso4', t1: 'DNI Resp Frente 4', t2: 'DNI Resp Dorso 4' },
        { id: 'resp5', label: 'DNI Responsable 5', icon: 'fa-user-shield', f1: 'respFrente5', f2: 'respDorso5', t1: 'DNI Resp Frente 5', t2: 'DNI Resp Dorso 5' }
    ];

    const sidebar = document.getElementById('docsSidebar');
    const content = document.getElementById('docsContent');
    
    sidebar.innerHTML = '';
    
    Array.from(content.children).forEach(child => {
        if(child.id !== 'docsEmptyMsg') child.remove();
    });

    docSections.forEach((sec) => {
        const val1 = data[sec.f1] || '';
        const val2 = data[sec.f2] || '';

        // Botón Barra Lateral
        const btn = document.createElement('button');
        btn.className = `docs-tab-btn`;
        btn.id = `btn-doc-${sec.id}`;
        btn.innerHTML = `<i class="fa-solid ${sec.icon}"></i> ${sec.label}`;
        btn.onclick = (e) => { e.preventDefault(); switchDocSubTab(sec.id); };
        sidebar.appendChild(btn);

        // Contenedor del Panel
        const panel = document.createElement('div');
        panel.className = 'doc-panel hidden';
        panel.id = `panel-doc-${sec.id}`;
        
        panel.innerHTML = `
            <div style="display: flex; gap: 40px; flex-wrap: wrap; align-items: flex-start;">
                ${createOriginalViewerCard(sec.t1, val1, sec.f1, sec.icon)}
                ${createOriginalViewerCard(sec.t2, val2, sec.f2, sec.icon)}
            </div>
            
            <div class="docs-ids-box" style="background: white; padding: 20px; border-radius: 8px; margin-top: 25px; border-left: 4px solid var(--primary-blue); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <h4 style="margin-top: 0; color: #333; margin-bottom: 15px;">Links o IDs de ${sec.label}</h4>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label>Frente</label>
                    <input type="text" id="${sec.f1}" value="${val1}" class="doc-id-input" ${!isEditMode ? 'readonly' : ''} placeholder="Pegar ID o enlace de la imagen frente...">
                </div>
                <div class="form-group">
                    <label>Dorso</label>
                    <input type="text" id="${sec.f2}" value="${val2}" class="doc-id-input" ${!isEditMode ? 'readonly' : ''} placeholder="Pegar ID o enlace de la imagen dorso...">
                </div>
            </div>
        `;
        content.appendChild(panel);

        if(val1) loadDriveImageAsBase64(val1, sec.f1);
        if(val2) loadDriveImageAsBase64(val2, sec.f2);
    });

    updateDocsSidebarVisibility();
}

// [Descripción: Generador HTML de las tarjetas individuales para el visualizador de Drive.]
function crea
