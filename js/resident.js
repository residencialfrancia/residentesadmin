// [Descripción: Lógica del perfil del residente. Modificada para leer y guardar arrays múltiples: hasta 3 Médicos (con especialidad), 3 Obras Sociales (con número de dorso), y 5 Responsables (con parentesco). También genera dinámicamente hasta 20 visores de documentos requeridos en la pestaña Links.]

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

// [Descripción: Funciones utilitarias y de cálculo de edad en tiempo real]
function calculateAgeLive() {
    const dateVal = document.getElementById('fechaNacimiento').value;
    const ageInput = document.getElementById('edad');
    if (!dateVal) { ageInput.value = ''; return; }
    const birthDate = new Date(dateVal + 'T00:00:00'); 
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
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
    } catch { return sheetDate; }
}

// [Descripción: Carga inicial de datos desde el backend y mapeo a los nuevos arrays]
async function loadResidentData() {
    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');

    try {
        const [resActivos, resArchivados] = await Promise.all([
            fetch(`${API_URL}?action=getResidents`).then(r => r.json()),
            fetch(`${API_URL}?action=getArchived`).then(r => r.json())
        ]);

        let todosLosResidentes = [];
        if (resActivos.status === 'success') todosLosResidentes = todosLosResidentes.concat(resActivos.data);
        if (resArchivados.status === 'success') todosLosResidentes = todosLosResidentes.concat(resArchivados.data);

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

// [Descripción: Pobla las cajas de texto y llama a los creadores de filas dinámicas (Médicos, OS, Familiares)]
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
    document.getElementById('domicilio').value = data.domicilio || '';
    if(document.getElementById('carpetaDrive')) document.getElementById('carpetaDrive').value = data.carpetaDrive || '';

    // Llenar Médicos
    const medContainer = document.getElementById('medicosContainer');
    medContainer.innerHTML = '';
    const medicos = data.medicosList || [data.medicoCabecera]; // Fallback por si backend manda 1
    const especialidades = data.especialidadList || [];
    if (medicos.length > 0 && medicos[0]) {
        medicos.forEach((med, i) => addMedicoRow(med, especialidades[i] || ''));
    } else { addMedicoRow('', ''); }

    // Llenar Obras Sociales
    const osContainer = document.getElementById('obrasSocialesContainer');
    osContainer.innerHTML = '';
    if (data.obrasSociales && data.obrasSociales.length > 0 && data.obrasSociales[0]) {
        data.obrasSociales.forEach((os, i) => addOsRow(os, data.numerosOs[i] || '', data.dorsosOs ? data.dorsosOs[i] : ''));
    } else { addOsRow('', '', ''); }

    // Llenar Familiares
    const respContainer = document.getElementById('responsablesContainer');
    respContainer.innerHTML = '';
    if (data.responsablesList && data.responsablesList.length > 0 && data.responsablesList[0]) {
        data.responsablesList.forEach((resp, i) => {
            addResponsableRow(resp, data.parentescoList ? data.parentescoList[i] : '', data.dniResponsablesList[i] || '', data.telefonosList[i] || '', data.domicilioResponsablesList[i] || '');
        });
    } else { addResponsableRow('', '', '', '', ''); }

    // Estado Archivado
    const divSalida = document.getElementById('divFechaSalida');
    const inputSalida = document.getElementById('fechaSalida');
    const statusBadge = document.getElementById('statusBadge'); 
    if (isArchivedProfile) {
        if(divSalida) divSalida.classList.remove('hidden');
        if(inputSalida) inputSalida.value = formatToInputDate(data.fechaSalida);
        if(statusBadge) {
            statusBadge.textContent = 'ARCHIVADO';
            statusBadge.style.display = 'inline-block';
            statusBadge.style.backgroundColor = 'var(--danger)';
            statusBadge.style.color = 'white';
            statusBadge.style.padding = '5px 15px';
            statusBadge.style.borderRadius = '8px';
        }
    } else {
        if(divSalida) divSalida.classList.add('hidden');
        if(statusBadge) statusBadge.style.display = 'none';
    }

    currentFotoUrl = data.fotoUrl;
    document.getElementById('profileImage').src = (data.fotoUrl && data.fotoUrl !== '') ? data.fotoUrl : FALLBACK_IMAGE;

    renderDocumentViewers(data);
}

// [Descripción: Agrega dinámicamente un bloque HTML para 1 Médico (máximo 3)]
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
            <button type="button" class="btn-remove-os ${!isEditMode ? 'hidden' : ''}" onclick="this.closest('.os-row').remove();"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;
    container.appendChild(row);
}

// [Descripción: Agrega dinámicamente un bloque HTML para 1 Obra Social (incluyendo Nro de Dorso, máximo 3)]
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
            <button type="button" class="btn-remove-os ${!isEditMode ? 'hidden' : ''}" onclick="this.closest('.os-row').remove();"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;
    container.appendChild(row);
}

// [Descripción: Agrega dinámicamente un bloque HTML para 1 Familiar (incluyendo Parentesco, máximo 5)]
function addResponsableRow(nombreVal, parentezcoVal, dniVal, telVal, domVal) {
    const container = document.getElementById('responsablesContainer');
    if(container.children.length >= 5) return showToast("Máximo 5 responsables permitidos.");

    const row = document.createElement('div');
    row.className = 'responsable-block'; 
    row.innerHTML = `
        <div class="form-row" style="align-items: flex-end; flex-wrap: wrap; gap: 15px; margin-bottom: 0;">
            <div class="form-group" style="flex: 1.5; min-width: 150px;">
                <label>Nombre</label><input type="text" class="resp-nombre" value="${nombreVal}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="flex: 1; min-width: 120px;">
                <label>Parentesco</label><input type="text" class="resp-par" value="${parentezcoVal}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="flex: 1; min-width: 120px;">
                <label>DNI</label><input type="text" class="resp-dni" value="${dniVal}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="flex: 1; min-width: 120px;">
                <label>Teléfono</label><input type="text" class="resp-tel" value="${telVal}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="flex: 2; min-width: 180px; display: flex; gap: 10px; align-items: flex-end;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <label>Domicilio</label><input type="text" class="resp-dom" value="${domVal}" ${!isEditMode ? 'readonly' : ''}>
                </div>
                <button type="button" class="btn-remove-resp ${!isEditMode ? 'hidden' : ''}" onclick="this.closest('.responsable-block').remove();"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `;
    container.appendChild(row);
}

// [Descripción: Genera los visores HTML para todos los documentos de la pestaña Links y llama a la API de Drive para cargar la imagen en Base64]
function renderDocumentViewers(data) {
    const grid = document.getElementById('documentosGridContainer');
    grid.innerHTML = ''; // Limpiar contenedor

    // Configuración de los 18 IDs de Drive posibles en la pestaña "Links"
    const docConfig = [
        { title: 'DNI Residente - Frente', id: 'dniArchivo1', fileId: data.dniArchivo1 },
        { title: 'DNI Residente - Dorso', id: 'dniArchivo2', fileId: data.dniArchivo2 },
        { title: 'OS 1 - Frente', id: 'osFrente1', fileId: data.osFrente1 },
        { title: 'OS 1 - Dorso', id: 'osDorso1', fileId: data.osDorso1 },
        { title: 'OS 2 - Frente', id: 'osFrente2', fileId: data.osFrente2 },
        { title: 'OS 2 - Dorso', id: 'osDorso2', fileId: data.osDorso2 },
        { title: 'OS 3 - Frente', id: 'osFrente3', fileId: data.osFrente3 },
        { title: 'OS 3 - Dorso', id: 'osDorso3', fileId: data.osDorso3 },
        { title: 'Resp 1 DNI - Frente', id: 'respFrente1', fileId: data.respFrente1 },
        { title: 'Resp 1 DNI - Dorso', id: 'respDorso1', fileId: data.respDorso1 },
        { title: 'Resp 2 DNI - Frente', id: 'respFrente2', fileId: data.respFrente2 },
        { title: 'Resp 2 DNI - Dorso', id: 'respDorso2', fileId: data.respDorso2 },
        { title: 'Resp 3 DNI - Frente', id: 'respFrente3', fileId: data.respFrente3 },
        { title: 'Resp 3 DNI - Dorso', id: 'respDorso3', fileId: data.respDorso3 },
        { title: 'Resp 4 DNI - Frente', id: 'respFrente4', fileId: data.respFrente4 },
        { title: 'Resp 4 DNI - Dorso', id: 'respDorso4', fileId: data.respDorso4 },
        { title: 'Resp 5 DNI - Frente', id: 'respFrente5', fileId: data.respFrente5 },
        { title: 'Resp 5 DNI - Dorso', id: 'respDorso5', fileId: data.respDorso5 }
    ];

    let html = '';
    docConfig.forEach(doc => { html += createViewerCard(doc.title, doc.fileId, doc.id); });
    grid.innerHTML = html;

    // Ejecutar descargas Base64
    docConfig.forEach(doc => { if(doc.fileId) loadDriveImageAsBase64(doc.fileId, doc.id); });
}

function createViewerCard(title, fileId, inputId) {
    const downloadUrl = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : '#';
    const hiddenClass = isEditMode && !isArchivedProfile ? '' : 'hidden'; 
    return `
        <div class="doc-viewer-card" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <h4 style="margin-top: 0; margin-bottom: 15px; color: var(--primary-blue); font-size: 0.95rem;">${title}</h4>
            <input type="hidden" id="${inputId}" value="${fileId || ''}">
            <div id="container-${inputId}" style="position: relative; width: 100%; min-height: ${fileId ? '250px' : '150px'}; border: 1px solid #eee; background: #f9f9f9; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                ${fileId ? `
                    <div id="loader-${inputId}" style="text-align: center; color: var(--primary-blue);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
                    <img id="img-${inputId}" alt="${title}" style="width: 100%; height: auto; max-height: 400px; object-fit: contain; display: none;">
                ` : `<p style="color:#ccc;"><i class="fa-solid fa-image fa-2x"></i></p>`}
            </div>
            <div style="display: flex; justify-content: space-between;">
                <label class="btn-upload-doc ${hiddenClass}" for="upload-${inputId}" style="background: #0F9D58; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;"><i class="fa-solid fa-upload"></i> Subir</label>
                <input type="file" id="upload-${inputId}" accept="image/*,application/pdf" style="display: none;" onchange="handleDocumentUpload(this, '${inputId}')">
                ${fileId ? `<a href="${downloadUrl}" target="_blank" style="background: var(--primary-blue); color: white; padding: 5px 10px; border-radius: 4px; text-decoration: none; font-size: 0.8rem;"><i class="fa-solid fa-download"></i> Ver Original</a>` : ''}
            </div>
        </div>
    `;
}

async function loadDriveImageAsBase64(fileId, inputId) {
    const imgElement = document.getElementById(`img-${inputId}`);
    const loaderElement = document.getElementById(`loader-${inputId}`);
    if (!imgElement || !loaderElement) return;
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getFileBase64', payload: { fileId: extractDriveId(fileId) } }) });
        const result = await res.json();
        if (result.status === 'success') {
            if (result.data.mimeType.includes('pdf')) {
                loaderElement.innerHTML = `<i class="fa-solid fa-file-pdf fa-3x" style="color:#e74c3c;"></i><br><small>Es un PDF</small>`;
            } else {
                imgElement.src = `data:${result.data.mimeType};base64,${result.data.base64}`;
                imgElement.onload = () => { loaderElement.style.display = 'none'; imgElement.style.display = 'block'; };
            }
        }
    } catch (e) { loaderElement.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:red;"></i>`; }
}

// [Descripción: Modos de edición y recolección de los arrays para guardarlos en Google Sheets]
function toggleEditMode(tab, enable) {
    if (isArchivedProfile) return showToast("Perfil archivado: Solo lectura.", true);
    isEditMode = enable;
    
    const tabContainer = tab === 'perfil' ? document.getElementById('tab-perfil') : document.getElementById('tab-documentacion');
    const inputs = tabContainer.querySelectorAll('input:not([type="hidden"]):not([type="file"])');
    
    if (enable) {
        document.getElementById('residentForm').classList.remove('readonly-mode');
        inputs.forEach(input => input.removeAttribute('readonly'));
        if(document.getElementById('edad')) document.getElementById('edad').setAttribute('readonly', 'true');
        
        if (tab === 'perfil') {
            document.getElementById('btnEditPerfil').classList.add('hidden');
            document.getElementById('btnSavePerfil').classList.remove('hidden');
            document.getElementById('btnCancelPerfil').classList.remove('hidden');
            document.getElementById('btnUploadContainer').classList.remove('hidden');
            document.getElementById('btnAddMedico').classList.remove('hidden');
            document.getElementById('btnAddOs').classList.remove('hidden');
            document.getElementById('btnAddResponsable').classList.remove('hidden');
            tabContainer.querySelectorAll('.btn-remove-os, .btn-remove-resp').forEach(btn => btn.classList.remove('hidden'));
        } else {
            document.getElementById('btnEditDocs').classList.add('hidden');
            document.getElementById('btnSaveDocs').classList.remove('hidden');
            document.getElementById('btnCancelDocs').classList.remove('hidden');
            document.querySelectorAll('.btn-upload-doc').forEach(btn => btn.classList.remove('hidden'));
        }
    } else {
        document.getElementById('residentForm').classList.add('readonly-mode');
        inputs.forEach(input => input.setAttribute('readonly', 'true'));
        
        if (tab === 'perfil') {
            document.getElementById('btnEditPerfil').classList.remove('hidden');
            document.getElementById('btnSavePerfil').classList.add('hidden');
            document.getElementById('btnCancelPerfil').classList.add('hidden');
            document.getElementById('btnUploadContainer').classList.add('hidden');
            document.getElementById('btnAddMedico').classList.add('hidden');
            document.getElementById('btnAddOs').classList.add('hidden');
            document.getElementById('btnAddResponsable').classList.add('hidden');
            tabContainer.querySelectorAll('.btn-remove-os, .btn-remove-resp').forEach(btn => btn.classList.add('hidden'));
        } else {
            document.getElementById('btnEditDocs').classList.remove('hidden');
            document.getElementById('btnSaveDocs').classList.add('hidden');
            document.getElementById('btnCancelDocs').classList.add('hidden');
            document.querySelectorAll('.btn-upload-doc').forEach(btn => btn.classList.add('hidden'));
        }
    }
}

async function saveResident(tab) {
    if(isArchivedProfile) return;
    const btnSave = tab === 'perfil' ? document.getElementById('btnSavePerfil') : document.getElementById('btnSaveDocs');
    const loader = document.getElementById('loader');
    
    const nombreInput = document.getElementById('nombre').value.trim();
    if(!nombreInput) return showToast("Nombre Obligatorio", true);

    btnSave.disabled = true; loader.classList.remove('hidden');

    try {
        let finalFotoUrl = currentFotoUrl;
        if (base64ImageToUpload) {
            const imgRes = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'uploadImage', payload: { nombre: nombreInput, base64: base64ImageToUpload.base64, mimeType: base64ImageToUpload.mimeType } }) });
            const imgData = await imgRes.json();
            if(imgData.status === 'success') finalFotoUrl = imgData.data.url;
        }

        // Subida de todos los documentos en cola
        for (const [inputId, docData] of Object.entries(documentsToUpload)) {
            const docRes = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'uploadDocument', payload: { nombre: nombreInput, base64: docData.base64, mimeType: docData.mimeType, docType: inputId } }) });
            const docResult = await docRes.json();
            if (docResult.status === 'success') document.getElementById(inputId).value = docResult.data.fileId;
        }

        const residentData = {
            nombreViejo: currentResidentName, nombre: nombreInput, apodo: document.getElementById('apodo').value,
            numeroSocio: document.getElementById('numeroSocio').value, fechaNacimiento: document.getElementById('fechaNacimiento').value,
            dni: document.getElementById('dni').value, cuil: document.getElementById('cuil').value, numeroTramite: document.getElementById('numeroTramite').value,
            lugarInternacion: document.getElementById('lugarInternacion').value, alergias: document.getElementById('alergias').value,
            fechaIngreso: document.getElementById('fechaIngreso').value, nacionalidad: document.getElementById('nacionalidad').value,
            domicilio: document.getElementById('domicilio').value, fotoUrl: finalFotoUrl, carpetaDrive: document.getElementById('carpetaDrive').value.trim(),
            
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

            // Extraemos los IDs de los inputs hidden generados en la pestaña Docs
            dniArchivo1: extractDriveId(document.getElementById('dniArchivo1')?.value),
            dniArchivo2: extractDriveId(document.getElementById('dniArchivo2')?.value),
            osFrente1: extractDriveId(document.getElementById('osFrente1')?.value), osDorso1: extractDriveId(document.getElementById('osDorso1')?.value),
            osFrente2: extractDriveId(document.getElementById('osFrente2')?.value), osDorso2: extractDriveId(document.getElementById('osDorso2')?.value),
            osFrente3: extractDriveId(document.getElementById('osFrente3')?.value), osDorso3: extractDriveId(document.getElementById('osDorso3')?.value),
            respFrente1: extractDriveId(document.getElementById('respFrente1')?.value), respDorso1: extractDriveId(document.getElementById('respDorso1')?.value),
            respFrente2: extractDriveId(document.getElementById('respFrente2')?.value), respDorso2: extractDriveId(document.getElementById('respDorso2')?.value),
            respFrente3: extractDriveId(document.getElementById('respFrente3')?.value), respDorso3: extractDriveId(document.getElementById('respDorso3')?.value),
            respFrente4: extractDriveId(document.getElementById('respFrente4')?.value), respDorso4: extractDriveId(document.getElementById('respDorso4')?.value),
            respFrente5: extractDriveId(document.getElementById('respFrente5')?.value), respDorso5: extractDriveId(document.getElementById('respDorso5')?.value)
        };

        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'saveResident', payload: residentData }) });
        const result = await res.json();
        
        if (result.status === 'success') {
            showToast("Guardado correctamente");
            currentResidentName = nombreInput; base64ImageToUpload = null; documentsToUpload = {};
            toggleEditMode(tab, false); window.history.replaceState({}, '', `resident.html?id=${encodeURIComponent(nombreInput)}`);
            loadResidentData();
        } else { showToast("Error: " + result.message, true); }
    } catch (e) { showToast("Error de conexión", true); } 
    finally { btnSave.disabled = false; loader.classList.add('hidden'); }
}

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
    
    document.getElementById('imageUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const r = new FileReader();
            r.onload = ev => { document.getElementById('profileImage').src = ev.target.result; base64ImageToUpload = { base64: ev.target.result, mimeType: file.type }; };
            r.readAsDataURL(file);
        }
    });
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast'); toast.textContent = message; toast.className = 'toast show ' + (isError ? 'error' : '');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

window.switchProfileTab = function(tabName) {
    const p = document.getElementById('tab-perfil'), d = document.getElementById('tab-documentacion');
    const bp = document.getElementById('btnTabPerfil'), bd = document.getElementById('btnTabDocs');
    if (tabName === 'perfil') {
        p.classList.remove('hidden'); d.classList.add('hidden');
        bp.style.background = 'var(--primary-blue)'; bp.style.color = 'white'; bd.style.background = '#f0f4f8'; bd.style.color = '#333';
    } else {
        p.classList.add('hidden'); d.classList.remove('hidden');
        bd.style.background = 'var(--primary-blue)'; bd.style.color = 'white'; bp.style.background = '#f0f4f8'; bp.style.color = '#333';
    }
}

window.handleDocumentUpload = function(input, id) {
    const f = input.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ev => {
        documentsToUpload[id] = { base64: ev.target.result, mimeType: f.type };
        const c = document.getElementById(`container-${id}`);
        c.innerHTML = f.type.includes('pdf') ? `<p>PDF Preparado.</p>` : `<img src="${ev.target.result}" style="width:100%; max-height:400px; object-fit:contain;">`;
        showToast("Archivo listo. Guarde los cambios.");
    }; r.readAsDataURL(f);
};
