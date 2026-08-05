/**
 * RESIDENT.JS - Lógica de Perfil (Drive Automático + Auto-Resize Preciso + Fix Documentos + Edad en Vivo)
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbzpHZgl9ZUD_NCVXR1qN45ohwiObhWgmpxgUzK883ySzC30LPRLrD3iFxKB1F22fcC3Qw/exec';
const FALLBACK_IMAGE = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

let currentResidentName = new URLSearchParams(window.location.search).get('id');
let isEditMode = false;
let base64ImageToUpload = null;
let currentFotoUrl = '';
let isArchivedProfile = false;
let documentsToUpload = {};

document.addEventListener('DOMContentLoaded', () => {
    window.onbeforeunload = null;

    if (currentResidentName) {
        loadResidentData();
    } else {
        toggleEditMode('perfil', true);
        addOsRow('', '');
        addResponsableRow('', '', '', '');
        document.getElementById('profileImage').src = FALLBACK_IMAGE;
        
        renderDocumentViewers({
            dniArchivo1: '', dniArchivo2: '',
            osArchivo1: '', osArchivo2: ''
        });
    }
    setupFormEvents();
});

// NUEVA FUNCIÓN: Calcula la edad en tiempo real al tocar la fecha de nacimiento
function calculateAgeLive() {
    const dateVal = document.getElementById('fechaNacimiento').value;
    const ageInput = document.getElementById('edad');
    
    if (!dateVal) {
        ageInput.value = '';
        return;
    }
    
    // Forzamos la zona horaria neutral para evitar desfases de días
    const birthDate = new Date(dateVal + 'T00:00:00'); 
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    
    // Restamos un año si todavía no pasó el mes/día de su cumpleaños este año
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    ageInput.value = age;
    setTimeout(adjustInputFontSizes, 50);
}

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
            populateForm(resident);
        } else {
            showToast("Residente no encontrado en la base de datos", true);
        }
    } catch (error) {
        showToast("Error de conexión al cargar", true);
        console.error(error);
    } finally {
        loader.classList.add('hidden');
    }
}

function populateForm(data) {
    document.getElementById('nombre').value = data.nombre;
    document.getElementById('numeroSocio').value = data.numeroSocio || '';
    document.getElementById('fechaNacimiento').value = formatToInputDate(data.fechaNacimiento);
    document.getElementById('edad').value = data.edad || '';
    document.getElementById('dni').value = data.dni || '';
    document.getElementById('cuil').value = data.cuil || '';
    document.getElementById('numeroTramite').value = data.numeroTramite || '';
    document.getElementById('lugarInternacion').value = data.lugarInternacion || '';
    document.getElementById('alergias').value = data.alergias || '';
    document.getElementById('medicoCabecera').value = data.medicoCabecera || '';
    document.getElementById('fechaIngreso').value = formatToInputDate(data.fechaIngreso);
    document.getElementById('nacionalidad').value = data.nacionalidad || '';
    
    if(document.getElementById('carpetaDrive')) document.getElementById('carpetaDrive').value = data.carpetaDrive || '';
    if(document.getElementById('imagenDrive')) document.getElementById('imagenDrive').value = data.imagenDrive || '';

    if(document.getElementById('carpetaDriveDni')) document.getElementById('carpetaDriveDni').value = data.carpetaDriveDni || '';
    if(document.getElementById('dniArchivo1')) document.getElementById('dniArchivo1').value = data.dniArchivo1 || '';
    if(document.getElementById('dniArchivo2')) document.getElementById('dniArchivo2').value = data.dniArchivo2 || '';
    
    if(document.getElementById('carpetaDriveOs')) document.getElementById('carpetaDriveOs').value = data.carpetaDriveOs || '';
    if(document.getElementById('osArchivo1')) document.getElementById('osArchivo1').value = data.osArchivo1 || '';
    if(document.getElementById('osArchivo2')) document.getElementById('osArchivo2').value = data.osArchivo2 || '';
    
    if(document.getElementById('domicilio')) document.getElementById('domicilio').value = data.domicilio || '';

    const osContainer = document.getElementById('obrasSocialesContainer');
    if (osContainer) {
        osContainer.innerHTML = '';
        if (data.obrasSociales && data.obrasSociales.length > 0) {
            data.obrasSociales.forEach((os, index) => { addOsRow(os, data.numerosOs[index]); });
        } else { addOsRow('', ''); }
    }

    const respContainer = document.getElementById('responsablesContainer');
    if (respContainer) {
        respContainer.innerHTML = '';
        if (data.responsablesList && data.responsablesList.length > 0) {
            data.responsablesList.forEach((resp, index) => {
                addResponsableRow(
                    resp, 
                    data.dniResponsablesList[index] || '', 
                    data.telefonosList[index] || '', 
                    data.domicilioResponsablesList[index] || ''
                );
            });
        } else {
            addResponsableRow('', '', '', '');
        }
    }

    const divSalida = document.getElementById('divFechaSalida');
    const inputSalida = document.getElementById('fechaSalida');
    const statusBadge = document.getElementById('statusBadge'); 

    if (isArchivedProfile) {
        if(divSalida) divSalida.classList.remove('hidden');
        if(inputSalida) inputSalida.value = formatToInputDate(data.fechaSalida);
        if(document.getElementById('btnRestore')) document.getElementById('btnRestore').classList.remove('hidden');
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
    setTimeout(adjustInputFontSizes, 100);
}

function extractDriveId(input) {
    if (!input) return '';
    const match = input.trim().match(/([a-zA-Z0-9_-]{25,})/);
    if (match && match[1]) {
        return match[1];
    }
    return input.trim(); 
}

function renderDocumentViewers(data) {
    const visorDni = document.getElementById('visorDni');
    const visorOs = document.getElementById('visorOs');

    if (visorDni) {
        let htmlDni = '';
        htmlDni += createViewerCard('DNI Frente', data.dniArchivo1, 'dniArchivo1');
        htmlDni += createViewerCard('DNI Dorso', data.dniArchivo2, 'dniArchivo2');
        visorDni.innerHTML = htmlDni;
    }

    if (visorOs) {
        let htmlOs = '';
        htmlOs += createViewerCard('Credencial Frente', data.osArchivo1, 'osArchivo1');
        htmlOs += createViewerCard('Credencial Dorso', data.osArchivo2, 'osArchivo2');
        visorOs.innerHTML = htmlOs;
    }

    if(data.dniArchivo1) loadDriveImageAsBase64(data.dniArchivo1, 'dniArchivo1');
    if(data.dniArchivo2) loadDriveImageAsBase64(data.dniArchivo2, 'dniArchivo2');
    if(data.osArchivo1) loadDriveImageAsBase64(data.osArchivo1, 'osArchivo1');
    if(data.osArchivo2) loadDriveImageAsBase64(data.osArchivo2, 'osArchivo2');
}

function createViewerCard(title, fileId, inputId) {
    const downloadUrl = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : '#';
    
    // CORRECCIÓN: El botón de carga manual ahora responde ÚNICAMENTE al estado del botón Editar Documentos
    const hiddenClass = isEditMode && !isArchivedProfile ? '' : 'hidden'; 

    return `
        <div class="doc-viewer-card" style="border: 1px solid var(--border-color, #e0e0e0); border-radius: 8px; padding: 20px; margin-bottom: 25px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); width: 100%;">
            <h4 style="margin-top: 0; margin-bottom: 15px; color: var(--primary-blue, #2c3e50); font-weight: 600;">
                <i class="fa-solid fa-id-card" style="margin-right: 8px;"></i>${title}
            </h4>
            
            <div id="container-${inputId}" class="image-container" style="position: relative; width: 100%; min-height: ${fileId ? '450px' : '250px'}; height: auto; border: 1px solid #eee; border-radius: 4px; overflow: hidden; margin-bottom: 15px; background: #f9f9f9; display: flex; align-items: center; justify-content: center; padding: 15px;">
                
                ${fileId ? `
                    <div id="loader-${inputId}" style="position: absolute; display: flex; flex-direction: column; align-items: center; color: var(--primary-blue, #3498db);">
                        <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.5em; margin-bottom: 10px;"></i>
                        <span style="font-weight: bold;">Descargando...</span>
                    </div>
                    <img id="img-${inputId}" alt="${title}" style="width: 100%; height: auto; max-height: 750px; object-fit: contain; display: none;">
                ` : `
                    <p style="text-align:center; color:#888; font-style:italic; padding:20px; margin: 0;"><i class="fa-solid fa-image" style="font-size: 3em; margin-bottom: 10px; color: #ccc;"></i><br>Sin documento cargado</p>
                `}
            </div>

            <div class="document-actions" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%;">
                
                <div>
                    <label class="btn-upload-doc ${hiddenClass}" for="upload-${inputId}" style="background: #0F9D58; color: white; padding: 10px 18px; border-radius: 4px; font-size: 0.9em; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-cloud-arrow-up"></i> Cargar de forma manual
                    </label>
                    <input type="file" id="upload-${inputId}" accept="image/*,application/pdf" style="display: none;" onchange="handleDocumentUpload(this, '${inputId}')">
                </div>
                
                ${fileId ? `
                <div>
                    <a href="${downloadUrl}" target="_blank" class="btn-download" style="background: var(--primary-blue, #3498db); color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px; font-size: 0.9em; font-weight: bold; transition: background 0.3s; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-download"></i> Ver / Descargar Original
                    </a>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

async function loadDriveImageAsBase64(fileId, inputId) {
    const imgElement = document.getElementById(`img-${inputId}`);
    const loaderElement = document.getElementById(`loader-${inputId}`);
    const containerElement = document.getElementById(`container-${inputId}`);
    
    if (!imgElement || !loaderElement || !containerElement) return;

    try {
        const cleanId = extractDriveId(fileId);
        const postData = { action: 'getFileBase64', payload: { fileId: cleanId } };
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(postData) });
        const result = await response.json();

        if (result.status === 'success') {
            const mimeType = result.data.mimeType;

            if (mimeType.includes('pdf')) {
                loaderElement.style.display = 'none';
                containerElement.innerHTML = `<p style="text-align:center; color:#888; font-style:italic; padding:20px;"><i class="fa-solid fa-file-pdf" style="font-size: 3em; margin-bottom: 10px; color: #e74c3c;"></i><br>Este archivo es un PDF.<br>Hacé clic en Ver / Descargar Original para abrirlo.</p>`;
            } else {
                imgElement.src = `data:${mimeType};base64,${result.data.base64}`;
                imgElement.onload = () => {
                    loaderElement.style.display = 'none';
                    imgElement.style.display = 'block';
                };
            }
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Error devuelto por Apps Script:", error.message);
        loaderElement.style.display = 'none';
        containerElement.innerHTML = `<p style="text-align:center; color:#888; font-style:italic; padding:20px;"><i class="fa-solid fa-triangle-exclamation" style="font-size: 2em; margin-bottom: 10px; color: #e74c3c;"></i><br><b>Error:</b> ${error.message}</p>`;
    }
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

function setupFormEvents() {
    const btnEditPerfil = document.getElementById('btnEditPerfil');
    if(btnEditPerfil) btnEditPerfil.onclick = (e) => { e.preventDefault(); toggleEditMode('perfil', true); };
    
    const btnSavePerfil = document.getElementById('btnSavePerfil');
    if(btnSavePerfil) btnSavePerfil.onclick = (e) => { e.preventDefault(); saveResident('perfil'); };
    
    const btnCancelPerfil = document.getElementById('btnCancelPerfil');
    if(btnCancelPerfil) btnCancelPerfil.onclick = (e) => { 
        e.preventDefault(); 
        if(!currentResidentName) return window.location.reload(); 
        base64ImageToUpload = null;
        toggleEditMode('perfil', false);
        loadResidentData(); 
    };

    const btnEditDocs = document.getElementById('btnEditDocs');
    if(btnEditDocs) btnEditDocs.onclick = (e) => { e.preventDefault(); toggleEditMode('docs', true); };
    
    const btnSaveDocs = document.getElementById('btnSaveDocs');
    if(btnSaveDocs) btnSaveDocs.onclick = (e) => { e.preventDefault(); saveResident('docs'); };
    
    const btnCancelDocs = document.getElementById('btnCancelDocs');
    if(btnCancelDocs) btnCancelDocs.onclick = (e) => { 
        e.preventDefault(); 
        if(!currentResidentName) return window.location.reload();
        documentsToUpload = {};
        toggleEditMode('docs', false);
        loadResidentData(); 
    };

    const btnRestore = document.getElementById('btnRestore');
    if(btnRestore) btnRestore.onclick = (e) => { e.preventDefault(); restoreResidentProfile(); };
    
    const btnAddOs = document.getElementById('btnAddOs');
    if(btnAddOs) btnAddOs.onclick = (e) => { e.preventDefault(); addOsRow('', ''); };
    
    const btnAddResp = document.getElementById('btnAddResponsable');
    if(btnAddResp) btnAddResp.onclick = (e) => { e.preventDefault(); addResponsableRow('', '', '', ''); };
    
    document.getElementById('imageUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                document.getElementById('profileImage').src = event.target.result;
                base64ImageToUpload = { base64: event.target.result, mimeType: file.type };
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('residentForm').addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT') adjustInputFontSizes();
    });

    // LISTENER PARA EL CÁLCULO DE EDAD EN VIVO
    const inputFechaNac = document.getElementById('fechaNacimiento');
    if (inputFechaNac) {
        inputFechaNac.addEventListener('change', calculateAgeLive);
        inputFechaNac.addEventListener('input', calculateAgeLive);
    }
}

function toggleEditMode(tab, enable) {
    if (isArchivedProfile) {
        showToast("Los perfiles archivados son de solo lectura.", true);
        return;
    }

    isEditMode = enable;
    const tabContainer = tab === 'perfil' ? document.getElementById('tab-perfil') : document.getElementById('tab-documentacion');
    const inputs = tabContainer.querySelectorAll('input');
    
    if (enable) {
        document.getElementById('residentForm').classList.remove('readonly-mode');
        tabContainer.classList.remove('readonly-mode');
        inputs.forEach(input => input.removeAttribute('readonly'));

        // Bloqueamos manualmente el input de "Edad" para que el usuario no pueda escribir en él, solo el sistema.
        const edadInput = document.getElementById('edad');
        if (edadInput) edadInput.setAttribute('readonly', 'true');
        
        if (tab === 'perfil') {
            document.getElementById('btnEditPerfil').classList.add('hidden');
            document.getElementById('btnSavePerfil').classList.remove('hidden');
            document.getElementById('btnCancelPerfil').classList.remove('hidden');
            
            document.getElementById('btnUploadContainer').classList.remove('hidden');
            if(document.getElementById('btnAddOs')) document.getElementById('btnAddOs').classList.remove('hidden');
            if(document.getElementById('btnAddResponsable')) document.getElementById('btnAddResponsable').classList.remove('hidden');
            tabContainer.querySelectorAll('.btn-remove-os, .btn-remove-resp').forEach(btn => btn.classList.remove('hidden'));
        } 
        else if (tab === 'docs') {
            document.getElementById('btnEditDocs').classList.add('hidden');
            document.getElementById('btnSaveDocs').classList.remove('hidden');
            document.getElementById('btnCancelDocs').classList.remove('hidden');
            
            tabContainer.querySelectorAll('.btn-upload-doc').forEach(btn => btn.classList.remove('hidden'));
        }
    } else {
        document.getElementById('residentForm').classList.add('readonly-mode');
        tabContainer.classList.add('readonly-mode');
        inputs.forEach(input => input.setAttribute('readonly', 'true'));
        
        if (tab === 'perfil') {
            document.getElementById('btnEditPerfil').classList.remove('hidden');
            document.getElementById('btnSavePerfil').classList.add('hidden');
            document.getElementById('btnCancelPerfil').classList.add('hidden');
            
            document.getElementById('btnUploadContainer').classList.add('hidden');
            if(document.getElementById('btnAddOs')) document.getElementById('btnAddOs').classList.add('hidden');
            if(document.getElementById('btnAddResponsable')) document.getElementById('btnAddResponsable').classList.add('hidden');
            tabContainer.querySelectorAll('.btn-remove-os, .btn-remove-resp').forEach(btn => btn.classList.add('hidden'));
        } 
        else if (tab === 'docs') {
            document.getElementById('btnEditDocs').classList.remove('hidden');
            document.getElementById('btnSaveDocs').classList.add('hidden');
            document.getElementById('btnCancelDocs').classList.add('hidden');
            
            tabContainer.querySelectorAll('.btn-upload-doc').forEach(btn => btn.classList.add('hidden'));
        }
        documentsToUpload = {}; 
    }
    setTimeout(adjustInputFontSizes, 100); 
}

function addOsRow(osValue, nroValue) {
    const container = document.getElementById('obrasSocialesContainer');
    if(!container) return;
    
    const row = document.createElement('div');
    row.className = 'os-row'; 
    
    row.innerHTML = `
        <div class="form-row" style="align-items: flex-end; width: 100%; margin-bottom: 0; gap: 15px;">
            <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
                <label>Obra Social</label>
                <input type="text" class="os-name" value="${osValue}" ${!isEditMode ? 'readonly' : ''} style="width: 100%;">
            </div>
            <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
                <label>N° Obra Social</label>
                <input type="text" class="os-number" value="${nroValue}" ${!isEditMode ? 'readonly' : ''} style="width: 100%;">
            </div>
            <div style="display: flex; align-items: flex-end; padding-left: 5px;">
                <button type="button" class="btn-remove-os ${!isEditMode ? 'hidden' : ''}" onclick="this.closest('.os-row').remove(); setTimeout(adjustInputFontSizes, 50);" title="Quitar Obra Social"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `;
    container.appendChild(row);
    setTimeout(adjustInputFontSizes, 50);
}

function addResponsableRow(nombreVal, dniVal, telVal, domVal) {
    const container = document.getElementById('responsablesContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'responsable-block'; 
    row.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    row.style.padding = '20px';
    row.style.borderRadius = '8px';
    row.style.backgroundColor = '#ffffff';
    row.style.marginBottom = '20px';
    row.style.border = '1px solid #eaeaea';
    row.style.borderLeft = '5px solid var(--primary-blue)';
    
    row.innerHTML = `
        <div class="form-row" style="align-items: flex-end; flex-wrap: wrap; gap: 15px; margin-bottom: 0;">
            <div class="form-group" style="flex: 1.5; min-width: 180px; margin-bottom: 0;">
                <label>Nombre</label>
                <input type="text" class="resp-nombre" value="${nombreVal}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="flex: 0.8; min-width: 100px; margin-bottom: 0;">
                <label>DNI</label>
                <input type="text" class="resp-dni" value="${dniVal}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="flex: 1.2; min-width: 140px; margin-bottom: 0;">
                <label>Teléfono</label>
                <input type="text" class="resp-tel" value="${telVal}" ${!isEditMode ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="flex: 1.5; min-width: 180px; margin-bottom: 0; display: flex; flex-direction: row; gap: 10px; align-items: flex-end;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <label>Domicilio</label>
                    <input type="text" class="resp-dom" value="${domVal}" ${!isEditMode ? 'readonly' : ''} style="width: 100%;">
                </div>
                <button type="button" class="btn-remove-resp ${!isEditMode ? 'hidden' : ''}" onclick="this.closest('.responsable-block').remove(); setTimeout(adjustInputFontSizes, 50);" title="Quitar Responsable" style="margin-bottom: 5px; flex-shrink: 0;"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `;
    container.appendChild(row);
    setTimeout(adjustInputFontSizes, 50);
}

async function saveResident(tab) {
    if(isArchivedProfile) return showToast("No se puede editar un perfil archivado.", true);

    const btnSave = tab === 'perfil' ? document.getElementById('btnSavePerfil') : document.getElementById('btnSaveDocs');
    const loader = document.getElementById('loader');
    
    const nombreInput = document.getElementById('nombre').value.trim();
    if(!nombreInput) { showToast("El Nombre Completo es obligatorio", true); return; }

    if(btnSave) btnSave.disabled = true;
    loader.classList.remove('hidden');

    try {
        let finalFotoUrl = currentFotoUrl;
        
        if (base64ImageToUpload) {
            const imgPayload = { action: 'uploadImage', payload: { nombre: nombreInput, base64: base64ImageToUpload.base64, mimeType: base64ImageToUpload.mimeType } };
            const imgRes = await fetch(API_URL, { method: 'POST', body: JSON.stringify(imgPayload) });
            const imgData = await imgRes.json();
            if(imgData.status === 'success') finalFotoUrl = imgData.data.url;
        }

        for (const [inputId, docData] of Object.entries(documentsToUpload)) {
            const docPayload = { 
                action: 'uploadDocument', 
                payload: { nombre: nombreInput, base64: docData.base64, mimeType: docData.mimeType, docType: inputId } 
            };
            const docRes = await fetch(API_URL, { method: 'POST', body: JSON.stringify(docPayload) });
            const docResult = await docRes.json();
            
            if (docResult.status === 'success') {
                document.getElementById(inputId).value = docResult.data.fileId;
            } else {
                throw new Error("Fallo al subir " + inputId);
            }
        }
        
        const osNames = Array.from(document.querySelectorAll('.os-name')).map(el => el.value.trim());
        const osNumbers = Array.from(document.querySelectorAll('.os-number')).map(el => el.value.trim());

        const respNames = Array.from(document.querySelectorAll('.resp-nombre')).map(el => el.value.trim());
        const respDnis = Array.from(document.querySelectorAll('.resp-dni')).map(el => el.value.trim());
        const respTels = Array.from(document.querySelectorAll('.resp-tel')).map(el => el.value.trim());
        const respDoms = Array.from(document.querySelectorAll('.resp-dom')).map(el => el.value.trim());

        const rawDniArchivo1 = document.getElementById('dniArchivo1') ? document.getElementById('dniArchivo1').value : '';
        const cleanDniArchivo1 = extractDriveId(rawDniArchivo1);
        if(document.getElementById('dniArchivo1')) document.getElementById('dniArchivo1').value = cleanDniArchivo1;

        const rawDniArchivo2 = document.getElementById('dniArchivo2') ? document.getElementById('dniArchivo2').value : '';
        const cleanDniArchivo2 = extractDriveId(rawDniArchivo2);
        if(document.getElementById('dniArchivo2')) document.getElementById('dniArchivo2').value = cleanDniArchivo2;

        const rawOsArchivo1 = document.getElementById('osArchivo1') ? document.getElementById('osArchivo1').value : '';
        const cleanOsArchivo1 = extractDriveId(rawOsArchivo1);
        if(document.getElementById('osArchivo1')) document.getElementById('osArchivo1').value = cleanOsArchivo1;

        const rawOsArchivo2 = document.getElementById('osArchivo2') ? document.getElementById('osArchivo2').value : '';
        const cleanOsArchivo2 = extractDriveId(rawOsArchivo2);
        if(document.getElementById('osArchivo2')) document.getElementById('osArchivo2').value = cleanOsArchivo2;

        const idCarpetaEstricto = document.getElementById('carpetaDrive') ? document.getElementById('carpetaDrive').value.trim() : '';

        const residentData = {
            nombreViejo: currentResidentName, 
            nombre: nombreInput,
            numeroSocio: document.getElementById('numeroSocio').value,
            fechaNacimiento: document.getElementById('fechaNacimiento').value,
            edad: document.getElementById('edad').value,
            dni: document.getElementById('dni').value,
            cuil: document.getElementById('cuil').value,
            numeroTramite: document.getElementById('numeroTramite').value,
            lugarInternacion: document.getElementById('lugarInternacion').value,
            alergias: document.getElementById('alergias').value,
            medicoCabecera: document.getElementById('medicoCabecera').value,
            obrasSociales: osNames,
            numerosOs: osNumbers,
            fechaIngreso: document.getElementById('fechaIngreso').value,
            nacionalidad: document.getElementById('nacionalidad').value,
            
            responsablesList: respNames,
            dniResponsablesList: respDnis,
            telefonosList: respTels,
            domicilioResponsablesList: respDoms,
            responsable: respNames[0] || '',
            dniResponsable: respDnis[0] || '',
            telefono: respTels[0] || '',
            domicilioResponsable: respDoms[0] || '',
            domicilio: document.getElementById('domicilio') ? document.getElementById('domicilio').value : '',
            
            carpetaDrive: idCarpetaEstricto, 
            imagenDrive: document.getElementById('imagenDrive') ? document.getElementById('imagenDrive').value.trim() : '',

            carpetaDriveDni: idCarpetaEstricto, 
            dniArchivo1: cleanDniArchivo1,
            dniArchivo2: cleanDniArchivo2,
            carpetaDriveOs: idCarpetaEstricto,  
            osArchivo1: cleanOsArchivo1,
            osArchivo2: cleanOsArchivo2,

            fotoUrl: finalFotoUrl
        };

        const postData = { action: 'saveResident', payload: residentData };
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(postData) });
        const result = await response.json();

        if (result.status === 'success') {
            showToast("Guardado y sincronizado con Drive correctamente");
            currentResidentName = nombreInput;
            currentFotoUrl = finalFotoUrl;
            
            base64ImageToUpload = null;
            documentsToUpload = {};
            
            toggleEditMode(tab, false);
            window.history.replaceState({}, '', `resident.html?id=${encodeURIComponent(nombreInput)}`);
            
            loadResidentData();
        } else {
            showToast("Error: " + result.message, true);
        }
    } catch (error) {
        showToast("Error al guardar: " + error.message, true);
    } finally {
        if(btnSave) btnSave.disabled = false;
        loader.classList.add('hidden');
    }
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + (isError ? 'error' : '');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function restoreResidentProfile() {
    if (!confirm(`¿Estás seguro de que deseas restaurar a ${currentResidentName} a la lista de residentes activos?`)) return;

    const btnRestore = document.getElementById('btnRestore');
    const loader = document.getElementById('loader');
    
    btnRestore.disabled = true;
    loader.classList.remove('hidden');

    try {
        const postData = {
            action: 'restoreResident',
            payload: { nombre: currentResidentName }
        };

        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(postData) });
        const result = await response.json();

        if (result.status === 'success') {
            showToast("Residente restaurado correctamente");
            setTimeout(() => {
                window.location.href = 'index.html'; 
            }, 1500);
        } else {
            showToast("Error: " + result.message, true);
            btnRestore.disabled = false;
        }
    } catch (error) {
        showToast("Error de conexión al restaurar", true);
        btnRestore.disabled = false;
    } finally {
        loader.classList.add('hidden');
    }
}

window.switchProfileTab = function(tabName) {
    const tabPerfil = document.getElementById('tab-perfil');
    const tabDocs = document.getElementById('tab-documentacion');
    const btnPerfil = document.getElementById('btnTabPerfil');
    const btnDocs = document.getElementById('btnTabDocs');

    if (tabName === 'perfil') {
        tabPerfil.classList.remove('hidden');
        tabDocs.classList.add('hidden');
        
        btnPerfil.style.background = 'var(--primary-blue)';
        btnPerfil.style.color = 'white';
        btnPerfil.style.border = 'none';
        
        btnDocs.style.background = '#f0f4f8';
        btnDocs.style.color = '#333';
        btnDocs.style.border = '1px solid var(--border-color)';
    } else {
        tabPerfil.classList.add('hidden');
        tabDocs.classList.remove('hidden');
        
        btnDocs.style.background = 'var(--primary-blue)';
        btnDocs.style.color = 'white';
        btnDocs.style.border = 'none';
        
        btnPerfil.style.background = '#f0f4f8';
        btnPerfil.style.color = '#333';
        btnPerfil.style.border = '1px solid var(--border-color)';
    }
    setTimeout(adjustInputFontSizes, 100);
}

window.handleDocumentUpload = function(inputElement, inputId) {
    const file = inputElement.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const base64 = event.target.result;
        
        documentsToUpload[inputId] = { base64: base64, mimeType: file.type };
        
        const container = document.getElementById(`container-${inputId}`);
        if (file.type.includes('pdf')) {
            container.innerHTML = `<p style="text-align:center; color:#888; font-style:italic; padding:20px;"><i class="fa-solid fa-file-pdf" style="font-size: 3em; margin-bottom: 10px; color: #0F9D58;"></i><br><b>Documento preparado.</b><br>Se guardará al hacer clic en "Guardar Cambios".</p>`;
        } else {
            container.innerHTML = `<img src="${base64}" style="width: 100%; height: auto; max-height: 750px; object-fit: contain;">`;
        }
        
        showToast("Archivo preparado. Recordá guardar los cambios.");
    };
    reader.readAsDataURL(file);
};
