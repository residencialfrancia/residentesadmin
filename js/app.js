const API_URL = 'https://script.google.com/macros/s/AKfycbwS1IP_hh93Alc9YzCxNQr-k0YUh-FDjh8SqEyB4hBz5oUz4sJlHFFYR7nPSyw-89ZM/exec';
const FALLBACK_IMAGE = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

let globalActivos = [];
let globalArchivados = [];

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    fetchActivos();
    fetchArchivados();
    setupEventListeners();
});

// ================= NAVEGACIÓN DE TABS =================
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden')); 
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// ================= FETCH DATOS =================
async function fetchActivos() {
    const loader = document.getElementById('loaderActivos');
    loader.classList.remove('hidden');
    try {
        const res = await fetch(`${API_URL}?action=getResidents`);
        const json = await res.json();
        if (json.status === 'success') {
            globalActivos = json.data;
            
            // ORDEN ALFABÉTICO (A-Z) DE ACTIVOS
            globalActivos.sort((a, b) => a.nombre.localeCompare(b.nombre));

            populateFilters(globalActivos);
            renderGrid(globalActivos, 'gridActivos', false);
        }
    } catch (e) { alert('Error cargando activos.'); } 
    finally { loader.classList.add('hidden'); }
}

async function fetchArchivados() {
    const loader = document.getElementById('loaderArchivados');
    loader.classList.remove('hidden');
    try {
        const res = await fetch(`${API_URL}?action=getArchived`);
        const json = await res.json();
        if (json.status === 'success') {
            globalArchivados = json.data;

            // ORDEN ALFABÉTICO (A-Z) DE ARCHIVADOS
            globalArchivados.sort((a, b) => a.nombre.localeCompare(b.nombre));

            renderGrid(globalArchivados, 'gridArchivados', true);
        }
    } catch (e) { console.error(e); } 
    finally { loader.classList.add('hidden'); }
}

// ================= RENDER DE TARJETAS =================
function renderGrid(data, containerId, isArchived) {
    const grid = document.getElementById(containerId);
    grid.innerHTML = '';

    if (data.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">No hay registros para mostrar.</p>';
        return;
    }

    data.forEach(res => {
        const card = document.createElement('div');
        card.className = `card ${isArchived ? 'archived-card' : ''}`;
        card.style.cursor = 'pointer'; 
        
        card.onclick = function(e) {
            e.preventDefault(); e.stopPropagation(); 
            const actionBtn = e.target.closest('.btn-archive-card');
            
            if(actionBtn) {
                if (actionBtn.dataset.action === 'archive') {
                    openArchiveModal(res.nombre);
                } else if (actionBtn.dataset.action === 'restore') {
                    executeRestore(res.nombre);
                }
                return;
            }
            window.location.href = `resident.html?id=${encodeURIComponent(res.nombre)}`;
        };

        const imgSrc = res.fotoUrl && res.fotoUrl !== '' ? res.fotoUrl : FALLBACK_IMAGE;

        const actionBtnHtml = !isArchived 
            ? `<button type="button" class="btn-archive-card" data-action="archive" title="Archivar Residente"><i class="fa-solid fa-box-archive"></i></button>` 
            : `<button type="button" class="btn-archive-card" data-action="restore" title="Restaurar Residente"><i class="fa-solid fa-box-open"></i></button>`;

        card.innerHTML = `
            ${actionBtnHtml}
            <div class="card-header">
                <img src="${imgSrc}" alt="${res.nombre}" class="card-img" onerror="this.src='${FALLBACK_IMAGE}'">
                <div class="card-title">
                    <h3>${res.nombre}</h3>
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

                <div class="info-row">
                    <span><i class="fa-solid fa-file-lines"></i> N° Trámite:</span>
                    <strong>${res.numeroTramite || 'N/A'}</strong>
                </div>

                ${isArchived && res.fechaSalida ? `<div class="info-row"><span style="color:var(--danger)"><i class="fa-solid fa-door-open"></i> Fecha Salida:</span><strong>${res.fechaSalida}</strong></div>` : ''}

                <div class="info-row" style="flex-direction: column; gap: 8px; margin-top: 10px; border-top: 1px dashed var(--border-color); padding-top: 10px;">
                    <span style="color: var(--primary-blue); font-weight: 600;"><i class="fa-solid fa-notes-medical"></i> Obras Sociales:</span>
                    ${(res.obrasSociales && res.obrasSociales.length > 0 && res.obrasSociales[0] !== "") 
                        ? res.obrasSociales.map((os, idx) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 0.9rem; padding: 8px 12px; background: #ffffff; border: 1px solid #eaeaea; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.06);">
                                <span style="color: #000000; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${os}</span>
                                <strong style="color: #000000; font-family: monospace; font-size: 0.95rem; white-space: nowrap; flex-shrink: 0;">${res.numerosOs[idx] || 'S/N'}</strong>
                            </div>
                        `).join('') 
                        : '<div style="font-size: 0.9rem; color: #888; padding-left: 10px;">Sin cobertura registrada</div>'
                    }
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ================= FILTROS Y EVENTOS =================
function populateFilters(data) {
    const select = document.getElementById('osFilterActivos');
    const osSet = new Set();
    data.forEach(res => res.obrasSociales.forEach(os => { if(os && os.trim() !== '') osSet.add(os.trim()); }));
    select.innerHTML = '<option value="">Todas las Obras Sociales</option>';
    Array.from(osSet).sort().forEach(os => select.insertAdjacentHTML('beforeend', `<option value="${os}">${os}</option>`));
}

function setupEventListeners() {
    const searchActivos = document.getElementById('searchActivos');
    const osFilterActivos = document.getElementById('osFilterActivos');
    const searchArchivados = document.getElementById('searchArchivados');

    const doFilterActivos = () => {
        const term = searchActivos.value.toLowerCase();
        const os = osFilterActivos.value;
        const filtered = globalActivos.filter(r => 
            (r.nombre.toLowerCase().includes(term) || (r.dni && r.dni.includes(term))) &&
            (os === '' || r.obrasSociales.includes(os))
        );
        renderGrid(filtered, 'gridActivos', false);
    };

    const doFilterArchivados = () => {
        const term = searchArchivados.value.toLowerCase();
        const filtered = globalArchivados.filter(r => r.nombre.toLowerCase().includes(term) || (r.dni && r.dni.includes(term)));
        renderGrid(filtered, 'gridArchivados', true);
    };

    searchActivos.addEventListener('input', doFilterActivos);
    osFilterActivos.addEventListener('change', doFilterActivos);
    searchArchivados.addEventListener('input', doFilterArchivados);

    document.getElementById('closeModal').onclick = closeArchiveModal;
    document.getElementById('cancelArchive').onclick = closeArchiveModal;
    document.getElementById('confirmArchive').onclick = executeArchive;
}

// ================= LÓGICA ARCHIVAR / RESTAURAR =================
let residentToArchive = null;

window.openArchiveModal = function(nombre) {
    residentToArchive = nombre;
    document.getElementById('archiveName').textContent = nombre;
    document.getElementById('archiveDate').valueAsDate = new Date();
    document.getElementById('archiveModal').classList.add('show');
}

function closeArchiveModal() {
    document.getElementById('archiveModal').classList.remove('show');
    residentToArchive = null;
}

async function executeArchive() {
    const fechaSalida = document.getElementById('archiveDate').value;
    if (!fechaSalida) return alert("Ingrese una fecha de salida");

    const btn = document.getElementById('confirmArchive');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Archivando...';

    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'archiveResident', payload: { nombre: residentToArchive, fechaSalida: fechaSalida } }) });
        const result = await res.json();
        if(result.status === 'success') {
            closeArchiveModal();
            fetchActivos(); 
            fetchArchivados(); // Recargar ambos
        }
    } catch (e) { alert("Error al archivar"); } 
    finally { btn.disabled = false; btn.innerHTML = 'Archivar Residente'; }
}

async function executeRestore(nombre) {
    if (!confirm(`¿Estás seguro de que deseas restaurar a ${nombre} a la lista de residentes activos?`)) return;

    const loader = document.getElementById('loaderArchivados');
    if (loader) loader.classList.remove('hidden');

    try {
        const postData = {
            action: 'restoreResident',
            payload: { nombre: nombre }
        };

        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(postData) });
        const result = await res.json();

        if (result.status === 'success') {
            fetchActivos(); 
            fetchArchivados(); 
        } else {
            alert("Error al restaurar: " + result.message);
        }
    } catch (error) {
        alert("Error de conexión al restaurar");
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}
