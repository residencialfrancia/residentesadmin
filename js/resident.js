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
            showToast("Residente no encontrado en la base de datos", true);
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
            addResponsableRow(
                resp, 
                data.parentescoList ? data.parentescoList[i] : '', 
                data.dniResponsablesList[i] || '', 
                data.telefonosList[i] || '', 
                data.domicilioResponsablesList[i] || ''
            );
        });
    } else { 
        addResponsableRow('', '', '', '', ''); 
    }

    // Control de UI para Archivados
    const divSalida = document.getElementById('divFechaSalida');
    const inputSalida = document.getElementById('fechaSalida');
    const statusBadge = document.getElementById('statusBadge'); 
    const btnRestore = document.getElementById('btnRestore');
    
    if (isArchivedProfile) {
        if (divSalida) divSalida.classList.remove('hidden');
        if (inputSalida) inputSalida.value = formatToInputDate(data.fechaSalida);
        if (btnRestore) btnRestore.classList.remove('hidden');
        
        if (statusBadge) {
            statusBadge.textContent = 'ARCHIVADO';
            statusBadge.classList.remove('hidden');
        }
    } else {
        if (divSalida) divSalida.classList.add('hidden');
        if (btnRestore) btnRestore.classList.add('hidden');
        if (statusBadge) statusBadge.classList.add('hidden');
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
        if(child.id !== 'docsEmptyMsg') {
            child.remove();
        }
    });

    docSections.forEach((sec) => {
        const val1 = data[sec.f1] || '';
        const val2 = data[sec.f2] || '';

        // Botón Barra Lateral
        const btn = document.createElement('button');
        btn.className = `docs-tab-btn`;
        btn.id = `btn-doc-${sec.id}`;
        btn.innerHTML = `<i class="fa-solid ${sec.icon}"></i> ${sec.label}`;
        btn.onclick = (e) => { 
            e.preventDefault(); 
            switchDocSubTab(sec.id); 
        };
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
function createOriginalViewerCard(title, fileId, inputId, icon) {
    const downloadUrl = fileId ? `https://drive.google.com/uc?export=download&id=${extractDriveId(fileId)}` : '#';
    const hiddenClass = isEditMode && !isArchivedProfile ? '' : 'hidden'; 
    
    return `
        <div style="flex: 1; min-width: 350px;">
            <h3 style="color: var(--primary-blue); border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-top: 0;">
                <i class="fa-solid ${icon}"></i> ${title}
            </h3>
            
            <div class="doc-viewer-card" style="background: var(--white); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 15px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow-sm);">
                <div id="container-${inputId}" style="position: relative; width: 100%; min-height: ${fileId ? '450px' : '250px'}; height: auto; border: 1px solid #eee; border-radius: 4px; overflow: hidden; background: #f9f9f9; display: flex; align-items: center; justify-content: center; padding: 15px;">
                    ${fileId ? `
                        <div id="loader-${inputId}" style="position: absolute; display: flex; flex-direction: column; align-items: center; color: var(--primary-blue);">
                            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.5em; margin-bottom: 10px;"></i>
                            <span style="font-weight: bold;">Descargando...</span>
                        </div>
                        <img id="img-${inputId}" alt="${title}" style="width: 100%; height: auto; max-height: 750px; object-fit: contain; display: none;">
                    ` : `
                        <p style="text-align:center; color:#888; font-style:italic; padding:20px; margin: 0;">
                            <i class="fa-solid fa-image" style="font-size: 3em; margin-bottom: 10px; color: #ccc;"></i><br>Sin documento
                        </p>
                    `}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div>
                        <label class="btn-upload-doc ${hiddenClass}" for="upload-${inputId}" style="background: #0F9D58; color: white; padding: 10px 18px; border-radius: 4px; font-size: 0.9em; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-cloud-arrow-up"></i> Cargar manual
                        </label>
                        <input type="file" id="upload-${inputId}" accept="image/*,application/pdf" style="display: none;" onchange="handleDocumentUpload(this, '${inputId}')">
                    </div>
                    ${fileId ? `
                    <a href="${downloadUrl}" target="_blank" style="background: var(--primary-blue); color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px; font-size: 0.9em; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-download"></i> Ver Original
                    </a>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// [Descripción: Oculta subpestañas vacías de la barra lateral. Muestra mensaje vacío centrado si no hay nada que ver.]
function updateDocsSidebarVisibility() {
    const sections = ['dni', 'os1', 'os2', 'os3', 'resp1', 'resp2', 'resp3', 'resp4', 'resp5'];
    let firstVisible = null;

    sections.forEach(secId => {
        const btn = document.getElementById(`btn-doc-${secId}`);
        const panel = document.getElementById(`panel-doc-${secId}`);
        if (!btn || !panel) return;

        const inputs = panel.querySelectorAll('.doc-id-input');
        let hasValue = false;
        
        inputs.forEach(inp => { 
            if (inp.value.trim() !== '') {
                hasValue = true; 
            }
        });

        if (isEditMode) {
            btn.style.display = 'flex';
            if (!firstVisible) firstVisible = secId;
        } else {
            if (hasValue) {
                btn.style.display = 'flex';
                if (!firstVisible) firstVisible = secId;
            } else {
                btn.style.display = 'none';
            }
        }
    });

    const emptyMsg = document.getElementById('docsEmptyMsg');
    
    if (firstVisible) {
        emptyMsg.style.display = 'none';
        switchDocSubTab(firstVisible);
    } else {
        sections.forEach(secId => {
            const panel = document.getElementById(`panel-doc-${secId}`);
            if (panel) panel.classList.add('hidden');
        });
        emptyMsg.style.display = 'flex'; 
    }
}

// [Descripción: Alternador de visualización de paneles en la vista de documentos.]
function switchDocSubTab(tabId) {
    const sections = ['dni', 'os1', 'os2', 'os3', 'resp1', 'resp2', 'resp3', 'resp4', 'resp5'];
    
    sections.forEach(secId => {
        const btn = document.getElementById(`btn-doc-${secId}`);
        const panel = document.getElementById(`panel-doc-${secId}`);
        
        if (btn) btn.classList.remove('active');
        if (panel) panel.classList.add('hidden');
    });

    const activeBtn = document.getElementById(`btn-doc-${tabId}`);
    const activePanel = document.getElementById(`panel-doc-${tabId}`);
    
    if (activeBtn) activeBtn.classList.add('active');
    if (activePanel) activePanel.classList.remove('hidden');
}

// [Descripción: Controlador Global del Estado de Edición. Activa o desactiva la lectura/escritura de los inputs, botones e interacción en base al estado de la ficha.]
function toggleEditMode(tab, enable) {
    if (isArchivedProfile) {
        return showToast("Perfil archivado: Solo lectura.", true);
    }
    
    isEditMode = enable;
    
    const tabContainer = tab === 'perfil' ? document.getElementById('tab-perfil') : document.getElementById('tab-documentacion');
    const inputs = tabContainer.querySelectorAll('input:not([type="hidden"]):not([type="file"])');
    const selectGenero = document.getElementById('genero');
    
    if (enable) {
        document.getElementById('residentForm').classList.remove('readonly-mode');
        
        inputs.forEach(input => input.removeAttribute('readonly'));
        
        if (document.getElementById('edad')) {
            document.getElementById('edad').setAttribute('readonly', 'true');
        }
        
        if (selectGenero) {
            selectGenero.removeAttribute('disabled');
        }
        
        if (tab === 'perfil') {
            document.getElementById('btnEditPerfil').classList.add('hidden');
            document.getElementById('btnSavePerfil').classList.remove('hidden');
            document.getElementById('btnCancelPerfil').classList.remove('hidden');
            
            document.getElementById('btnUploadContainer').classList.remove('hidden');
            document.getElementById('btnAddMedico').classList.remove('hidden');
            document.getElementById('btnAddOs').classList.remove('hidden');
            document.getElementById('btnAddResponsable').classList.remove('hidden');
            
            tabContainer.querySelectorAll('.btn-remove-os, .btn-remove-resp').forEach(btn => {
                btn.classList.remove('hidden');
            });
        } else {
            document.getElementById('btnEditDocs').classList.add('hidden');
            document.getElementById('btnSaveDocs').classList.remove('hidden');
            document.getElementById('btnCancelDocs').classList.remove('hidden');
            
            document.querySelectorAll('.btn-upload-doc').forEach(btn => {
                btn.classList.remove('hidden');
            });
            updateDocsSidebarVisibility(); 
        }
    } else {
        document.getElementById('residentForm').classList.add('readonly-mode');
        
        inputs.forEach(input => input.setAttribute('readonly', 'true'));
        
        if (selectGenero) {
            selectGenero.setAttribute('disabled', 'true');
        }
        
        if (tab === 'perfil') {
            document.getElementById('btnEditPerfil').classList.remove('hidden');
            document.getElementById('btnSavePerfil').classList.add('hidden');
            document.getElementById('btnCancelPerfil').classList.add('hidden');
            
            document.getElementById('btnUploadContainer').classList.add('hidden');
            document.getElementById('btnAddMedico').classList.add('hidden');
            document.getElementById('btnAddOs').classList.add('hidden');
            document.getElementById('btnAddResponsable').classList.add('hidden');
            
            tabContainer.querySelectorAll('.btn-remove-os, .btn-remove-resp').forEach(btn => {
                btn.classList.add('hidden');
            });
        } else {
            document.getElementById('btnEditDocs').classList.remove('hidden');
            document.getElementById('btnSaveDocs').classList.add('hidden');
            document.getElementById('btnCancelDocs').classList.add('hidden');
            
            document.querySelectorAll('.btn-upload-doc').forEach(btn => {
                btn.classList.add('hidden');
            });
            updateDocsSidebarVisibility(); 
        }
    }
    
    // Auto-ajuste visual al cambiar el estado de lectura/escritura
    setTimeout(adjustInputFontSizes, 100);
}

// [Descripción: Envío principal de datos a Google Sheets. Recolecta todos los campos sueltos, agrupa las listas dinámicas y recoge los 18 IDs de Drive.]
async function saveResident(tab) {
    if(isArchivedProfile) return;
    
    const btnSave = tab === 'perfil' ? document.getElementById('btnSavePerfil') : document.getElementById('btnSaveDocs');
    const loader = document.getElementById('loader');
    
    const nombreInput = document.getElementById('nombre').value.trim();
    if(!nombreInput) {
        return showToast("El Nombre Completo es Obligatorio", true);
    }

    btnSave.disabled = true; 
    loader.classList.remove('hidden');

    try {
        let finalFotoUrl = currentFotoUrl;
        
        // Subida de imagen principal si hay una en cola
        if (base64ImageToUpload) {
            const imgRes = await fetch(API_URL, { 
                method: 'POST', 
                body: JSON.stringify({ 
                    action: 'uploadImage', 
                    payload: { 
                        nombre: nombreInput, 
                        base64: base64ImageToUpload.base64, 
                        mimeType: base64ImageToUpload.mimeType 
                    } 
                }) 
            });
            
            const imgData = await imgRes.json();
            if(imgData.status === 'success') {
                finalFotoUrl = imgData.data.url;
            }
        }

        // Subida manual de documentos si hay en cola
        for (const [inputId, docData] of Object.entries(documentsToUpload)) {
            const docRes = await fetch(API_URL, { 
                method: 'POST', 
                body: JSON.stringify({ 
                    action: 'uploadDocument', 
                    payload: { 
                        nombre: nombreInput, 
                        base64: docData.base64, 
                        mimeType: docData.mimeType, 
                        docType: inputId 
                    } 
                }) 
            });
            
            const docResult = await docRes.json();
            
            if (docResult.status === 'success') {
                const idInput = document.getElementById(inputId);
                if(idInput) {
                    idInput.value = docResult.data.fileId;
                }
            }
        }

        // Armado integral del JSON explícito para enviar a Apps Script
        const residentData = {
            nombreViejo: currentResidentName, 
            nombre: nombreInput, 
            apodo: document.getElementById('apodo').value,
            numeroSocio: document.getElementById('numeroSocio').value, 
            fechaNacimiento: document.getElementById('fechaNacimiento').value,
            dni: document.getElementById('dni').value, 
            cuil: document.getElementById('cuil').value, 
            numeroTramite: document.getElementById('numeroTramite').value,
            lugarInternacion: document.getElementById('lugarInternacion').value, 
            alergias: document.getElementById('alergias').value,
            fechaIngreso: document.getElementById('fechaIngreso').value, 
            nacionalidad: document.getElementById('nacionalidad').value,
            genero: document.getElementById('genero') ? document.getElementById('genero').value : '', 
            domicilio: document.getElementById('domicilio').value, 
            fotoUrl: finalFotoUrl, 
            carpetaDrive: document.getElementById('carpetaDrive') ? document.getElementById('carpetaDrive').value.trim() : '',
            
            medicosList: Array.from(document.querySelectorAll('.med-nombre')).map(el => el.value.trim()),
            especialidadList: Array.from(document.querySelectorAll('.med-esp')).map(el => el.value.trim()),
            
            obrasSociales: Array.from(document.querySelectorAll('.os-name')).map(el => el.value.trim()),
            numerosOs: Array.from(document.querySelectorAll('.os-number')).map(el => el.value.trim()),
            dorsosOs: Array.from(document.querySelectorAll('.os-dorso')).map(el => el.value.trim()),
            
            responsablesList: Array.from(document.querySelectorAll('.resp-nombre')).map(el => el.value.trim()),
            parentescoList: Array.from(document.querySelectorAll('.resp-par')).map(el => el.value.trim()),
            dniResponsablesList: Array.from(document.querySelectorAll('.resp-dni')).map(el => el.value.trim()),
            telefonosList: Array.from(document.querySelectorAll('.resp-tel')).map(el => el.value.trim()),
            domicilioResponsablesList: Array.from(document.querySelectorAll('.resp-dom')).map(el => el.value.trim()),

            // Extraemos los 18 IDs de Documentos usando Regex por si pegaron el Link completo
            dniArchivo1: extractDriveId(document.getElementById('dniArchivo1')?.value),
            dniArchivo2: extractDriveId(document.getElementById('dniArchivo2')?.value),
            osFrente1: extractDriveId(document.getElementById('osFrente1')?.value), 
            osDorso1: extractDriveId(document.getElementById('osDorso1')?.value),
            osFrente2: extractDriveId(document.getElementById('osFrente2')?.value), 
            osDorso2: extractDriveId(document.getElementById('osDorso2')?.value),
            osFrente3: extractDriveId(document.getElementById('osFrente3')?.value), 
            osDorso3: extractDriveId(document.getElementById('osDorso3')?.value),
            respFrente1: extractDriveId(document.getElementById('respFrente1')?.value), 
            respDorso1: extractDriveId(document.getElementById('respDorso1')?.value),
            respFrente2: extractDriveId(document.getElementById('respFrente2')?.value), 
            respDorso2: extractDriveId(document.getElementById('respDorso2')?.value),
            respFrente3: extractDriveId(document.getElementById('respFrente3')?.value), 
            respDorso3: extractDriveId(document.getElementById('respDorso3')?.value),
            respFrente4: extractDriveId(document.getElementById('respFrente4')?.value), 
            respDorso4: extractDriveId(document.getElementById('respDorso4')?.value),
            respFrente5: extractDriveId(document.getElementById('respFrente5')?.value), 
            respDorso5: extractDriveId(document.getElementById('respDorso5')?.value)
        };

        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'saveResident', payload: residentData }) 
        });
        
        const result = await res.json();
        
        if (result.status === 'success') {
            showToast("Guardado correctamente");
            
            currentResidentName = nombreInput; 
            base64ImageToUpload = null; 
            documentsToUpload = {};
            
            toggleEditMode(tab, false); 
            window.history.replaceState({}, '', `resident.html?id=${encodeURIComponent(nombreInput)}`);
            
            loadResidentData();
        } else { 
            showToast("Error: " + result.message, true); 
        }
    } catch (e) { 
        showToast("Error de conexión al guardar", true); 
    } finally { 
        btnSave.disabled = false; 
        loader.classList.add('hidden'); 
    }
}

// [Descripción: Solicitud asíncrona a Google Drive para restaurar un residente desde el perfil.]
async function restoreResidentProfile() {
    if (!confirm(`¿Estás seguro de que deseas restaurar a ${currentResidentName} a la lista de residentes activos?`)) return;

    const btnRestore = document.getElementById('btnRestore');
    const loader = document.getElementById('loader');
    
    if (btnRestore) btnRestore.disabled = true;
    loader.classList.remove('hidden');

    try {
        const postData = {
            action: 'restoreResident',
            payload: { nombre: currentResidentName }
        };

        const response = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify(postData) 
        });
        const result = await response.json();

        if (result.status === 'success') {
            showToast("Residente restaurado correctamente");
            setTimeout(() => {
                window.location.href = 'index.html'; 
            }, 1500);
        } else {
            showToast("Error: " + result.message, true);
            if (btnRestore) btnRestore.disabled = false;
        }
    } catch (error) {
        showToast("Error de conexión al restaurar", true);
        if (btnRestore) btnRestore.disabled = false;
    } finally {
        loader.classList.add('hidden');
    }
}

// [Descripción: Petición a Drive para renderizar imágenes/PDFs evadiendo políticas de CORS devolviendo Base64.]
async function loadDriveImageAsBase64(fileId, inputId) {
    const imgElement = document.getElementById(`img-${inputId}`);
    const loaderElement = document.getElementById(`loader-${inputId}`);
    
    if (!imgElement || !loaderElement) return;
    
    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'getFileBase64', payload: { fileId: extractDriveId(fileId) } }) 
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            if (result.data.mimeType.includes('pdf')) {
                loaderElement.innerHTML = `<i class="fa-solid fa-file-pdf fa-3x" style="color:#e74c3c;"></i><br><small>Es un PDF</small>`;
            } else {
                imgElement.src = `data:${result.data.mimeType};base64,${result.data.base64}`;
                imgElement.onload = () => { 
                    loaderElement.style.display = 'none'; 
                    imgElement.style.display = 'block'; 
                };
            }
        } else {
            throw new Error("Fallo de lectura");
        }
    } catch (e) { 
        loaderElement.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:red;"></i>`; 
    }
}

// [Descripción: Lee el archivo desde la PC o celular, lo previsualiza en el recuadro y lo guarda en variable global para subirlo luego.]
window.handleDocumentUpload = function(input, id) {
    const f = input.files[0]; 
    if(!f) return;
    
    const r = new FileReader();
    r.onload = ev => {
        documentsToUpload[id] = { base64: ev.target.result, mimeType: f.type };
        const c = document.getElementById(`container-${id}`);
        
        if (f.type.includes('pdf')) {
            c.innerHTML = `<p style="color: #0F9D58; font-weight: bold; text-align: center;"><i class="fa-solid fa-file-pdf fa-2x"></i><br>PDF Listo para guardar.</p>`;
        } else {
            c.innerHTML = `<img src="${ev.target.result}" style="width:100%; height:auto; max-height:450px; object-fit:contain;">`;
        }
        
        showToast("Archivo cargado temporalmente. Guarde los cambios.");
    }; 
    r.readAsDataURL(f);
};

// [Descripción: Eventos globales de botones y carga de imagen de perfil.]
function setupFormEvents() {
    document.getElementById('btnEditPerfil').onclick = (e) => { e.preventDefault(); toggleEditMode('perfil', true); };
    document.getElementById('btnSavePerfil').onclick = (e) => { e.preventDefault(); saveResident('perfil'); };
    document.getElementById('btnCancelPerfil').onclick = (e) => { e.preventDefault(); toggleEditMode('perfil', false); loadResidentData(); };
    
    document.getElementById('btnEditDocs').onclick = (e) => { e.preventDefault(); toggleEditMode('docs', true); };
    document.getElementById('btnSaveDocs').onclick = (e) => { e.preventDefault(); saveResident('docs'); };
    document.getElementById('btnCancelDocs').onclick = (e) => { e.preventDefault(); toggleEditMode('docs', false); loadResidentData(); };
    
    document.getElementById('btnAddMedico').onclick = () => addMedicoRow('','');
    document.getElementById('btnAddOs').onclick = () => addOsRow('','','');
    document.getElementById('btnAddResponsable').onclick = () => addResponsableRow('','','','','');
    
    document.getElementById('fechaNacimiento').addEventListener('change', calculateAgeLive);
    
    // Si existe el botón restaurar en el HTML, conectarlo a su función.
    const btnRestore = document.getElementById('btnRestore');
    if (btnRestore) {
        btnRestore.onclick = (e) => { e.preventDefault(); restoreResidentProfile(); };
    }
    
    // Auto-escalado de fuente interactivo al teclear
    document.getElementById('residentForm').addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT') adjustInputFontSizes();
    });
    
    document.getElementById('imageUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const r = new FileReader();
            r.onload = ev => { 
                document.getElementById('profileImage').src = ev.target.result; 
                base64ImageToUpload = { base64: ev.target.result, mimeType: file.type }; 
            }; 
            r.readAsDataURL(file);
        }
    });
}
