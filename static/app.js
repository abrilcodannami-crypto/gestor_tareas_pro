const $ = (id) => document.getElementById(id);
let tareas = [];
let filtro = 'todas';
let editandoId = null;
let toastTimer;

function aviso(mensaje) {
  const toast = $('toast'); toast.textContent = mensaje; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
async function peticion(url, opciones = {}) {
  const respuesta = await fetch(url, {headers: {'Content-Type': 'application/json'}, ...opciones});
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || 'Ocurrió un error.');
  return datos;
}
async function cargar() {
  try {
    tareas = await peticion('/api/tareas');
    const stats = await peticion('/api/estadisticas');
    $('totalStat').textContent = stats.total; $('pendingStat').textContent = stats.pendientes;
    $('doneStat').textContent = stats.completadas; $('visitsStat').textContent = stats.visitas ?? '—';
    $('redisStatus').textContent = stats.redis_conectado ? 'Contador conectado con Redis' : 'Redis no está conectado';
    $('sideTotal').textContent = stats.total;
    renderizar();
  } catch (error) { aviso(error.message); $('taskList').innerHTML = '<div class="empty-state">No se pudieron cargar las tareas. Revisa que el servidor esté activo.</div>'; }
}
function renderizar() {
  const busqueda = $('searchInput').value.trim().toLowerCase();
  const prioridad = $('priorityFilter').value;
  const completadas = tareas.filter(t => t.estado === 'completada').length;
  const pendientes = tareas.length - completadas;
  $('allCount').textContent = tareas.length; $('pendingCount').textContent = pendientes; $('doneCount').textContent = completadas;
  $('listSummary').textContent = `${tareas.length} ${tareas.length === 1 ? 'tarea' : 'tareas'}`;
  const visibles = tareas.filter(t => (filtro === 'todas' || t.estado === filtro) && (prioridad === 'todas' || t.prioridad === prioridad) && `${t.nombre} ${t.descripcion || ''}`.toLowerCase().includes(busqueda));
  if (!visibles.length) {
    $('taskList').innerHTML = `<div class="empty-state"><div class="empty-emoji">${tareas.length ? '🔎' : '✦'}</div><strong>${tareas.length ? 'No hay resultados' : 'Tu espacio está listo'}</strong>${tareas.length ? 'Prueba con otro filtro o búsqueda.' : 'Crea tu primera tarea y empieza a organizarte.'}</div>`;
    return;
  }
  $('taskList').innerHTML = visibles.map(t => `<article class="task-row ${t.estado === 'completada' ? 'is-done' : ''}">
    <button class="check-btn" data-action="toggle" data-id="${t.id}" aria-label="${t.estado === 'completada' ? 'Marcar pendiente' : 'Completar tarea'}">${t.estado === 'completada' ? '✓' : ''}</button>
    <div class="task-copy"><div class="task-name">${escapar(t.nombre)}</div>${t.descripcion ? `<div class="task-description">${escapar(t.descripcion)}</div>` : ''}</div>
    <div class="task-meta"><span class="priority ${t.prioridad}">${t.prioridad[0].toUpperCase()+t.prioridad.slice(1)}</span><span class="status-label">${t.estado === 'completada' ? 'Completada' : 'Pendiente'}</span></div>
    <div class="row-actions"><button class="icon-btn" data-action="edit" data-id="${t.id}" title="Editar tarea" aria-label="Editar tarea">✎</button><button class="icon-btn" data-action="delete" data-id="${t.id}" title="Eliminar tarea" aria-label="Eliminar tarea">×</button></div></article>`).join('');
}
function escapar(texto) { return String(texto).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function abrirModal(tarea = null) {
  editandoId = tarea ? tarea.id : null;
  $('modalTitle').textContent = tarea ? 'Editar tarea' : 'Crear nueva tarea';
  $('saveTask').textContent = tarea ? 'Guardar cambios' : 'Guardar tarea';
  $('taskName').value = tarea?.nombre || ''; $('taskDescription').value = tarea?.descripcion || ''; $('taskPriority').value = tarea?.prioridad || 'media';
  $('modalBackdrop').hidden = false; setTimeout(() => $('taskName').focus(), 40);
}
function cerrarModal() { $('modalBackdrop').hidden = true; $('taskForm').reset(); editandoId = null; }
$('openCreate').addEventListener('click', () => abrirModal()); $('closeModal').addEventListener('click', cerrarModal); $('cancelModal').addEventListener('click', cerrarModal);
$('modalBackdrop').addEventListener('click', e => { if (e.target === $('modalBackdrop')) cerrarModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });
$('taskForm').addEventListener('submit', async e => {
  e.preventDefault();
  const datos = {nombre: $('taskName').value.trim(), descripcion: $('taskDescription').value.trim(), prioridad: $('taskPriority').value};
  try {
    if (editandoId) await peticion(`/api/tareas/${editandoId}`, {method:'PUT', body:JSON.stringify(datos)});
    else await peticion('/api/tareas', {method:'POST', body:JSON.stringify(datos)});
    cerrarModal(); await cargar(); aviso(editandoId ? 'Tarea actualizada.' : '¡Tarea creada!');
  } catch (error) { aviso(error.message); }
});
$('taskList').addEventListener('click', async e => {
  const boton = e.target.closest('button[data-action]'); if (!boton) return;
  const id = Number(boton.dataset.id), accion = boton.dataset.action, tarea = tareas.find(t => t.id === id); if (!tarea) return;
  try {
    if (accion === 'toggle') await peticion(`/api/tareas/${id}`, {method:'PUT', body:JSON.stringify({estado:tarea.estado === 'completada' ? 'pendiente' : 'completada'})});
    if (accion === 'edit') { abrirModal(tarea); return; }
    if (accion === 'delete') { if (!confirm(`¿Quieres eliminar “${tarea.nombre}”?`)) return; await peticion(`/api/tareas/${id}`, {method:'DELETE'}); aviso('Tarea eliminada.'); }
    if (accion === 'toggle') aviso(tarea.estado === 'completada' ? 'Tarea marcada como pendiente.' : '¡Tarea completada!');
    await cargar();
  } catch (error) { aviso(error.message); }
});
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  filtro = tab.dataset.filter; document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
  document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active')); renderizar();
}));
$('navAll').addEventListener('click', () => activarFiltro('todas'));
$('navPending').addEventListener('click', () => activarFiltro('pendiente'));
$('navDone').addEventListener('click', () => activarFiltro('completada'));
function activarFiltro(valor) { filtro = valor; document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.filter === valor)); document.querySelectorAll('.nav-item').forEach(t => t.classList.toggle('active', (valor === 'todas' && t.id === 'navAll') || (valor === 'pendiente' && t.id === 'navPending') || (valor === 'completada' && t.id === 'navDone'))); renderizar(); }
$('searchInput').addEventListener('input', renderizar); $('priorityFilter').addEventListener('change', renderizar);
const fecha = new Intl.DateTimeFormat('es-CO', {weekday:'long', day:'numeric', month:'long'}).format(new Date()); $('todayLabel').textContent = fecha.toLocaleUpperCase('es-CO');
cargar();
