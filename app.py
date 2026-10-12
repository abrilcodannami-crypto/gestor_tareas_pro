import os
import sqlite3
from flask import Flask, jsonify, render_template, request
import redis

app = Flask(__name__)
DB_PATH = os.getenv('DB_PATH', 'tareas.db')
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))

cache = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True, socket_connect_timeout=2)


def conectar():
    conexion = sqlite3.connect(DB_PATH)
    conexion.row_factory = sqlite3.Row
    return conexion


def crear_tabla():
    carpeta = os.path.dirname(DB_PATH)
    if carpeta:
        os.makedirs(carpeta, exist_ok=True)
    with conectar() as conexion:
        conexion.execute('''CREATE TABLE IF NOT EXISTS tareas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT DEFAULT '',
            estado TEXT NOT NULL DEFAULT 'pendiente',
            prioridad TEXT NOT NULL DEFAULT 'media',
            creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')


crear_tabla()


@app.route('/')
def inicio():
    try:
        cache.incr('visitas_totales')
    except redis.RedisError:
        app.logger.warning('Redis no está disponible; no se pudo registrar la visita.')
    return render_template('index.html')


@app.get('/api/tareas')
def listar_tareas():
    with conectar() as conexion:
        filas = conexion.execute('SELECT * FROM tareas ORDER BY id DESC').fetchall()
    return jsonify([dict(fila) for fila in filas])


@app.post('/api/tareas')
def crear_tarea():
    datos = request.get_json(silent=True) or {}
    nombre = str(datos.get('nombre', '')).strip()
    descripcion = str(datos.get('descripcion', '')).strip()
    prioridad = datos.get('prioridad', 'media')
    if not nombre:
        return jsonify(error='Escribe un nombre para la tarea.'), 400
    if prioridad not in ('baja', 'media', 'alta'):
        return jsonify(error='La prioridad no es válida.'), 400
    with conectar() as conexion:
        cursor = conexion.execute(
            'INSERT INTO tareas (nombre, descripcion, prioridad) VALUES (?, ?, ?)',
            (nombre, descripcion, prioridad)
        )
        tarea = conexion.execute('SELECT * FROM tareas WHERE id = ?', (cursor.lastrowid,)).fetchone()
    return jsonify(dict(tarea)), 201


@app.put('/api/tareas/<int:tarea_id>')
def actualizar_tarea(tarea_id):
    datos = request.get_json(silent=True) or {}
    campos = {}
    if 'nombre' in datos:
        nombre = str(datos['nombre']).strip()
        if not nombre:
            return jsonify(error='El nombre no puede estar vacío.'), 400
        campos['nombre'] = nombre
    if 'descripcion' in datos:
        campos['descripcion'] = str(datos['descripcion']).strip()
    if 'estado' in datos:
        if datos['estado'] not in ('pendiente', 'completada'):
            return jsonify(error='El estado no es válido.'), 400
        campos['estado'] = datos['estado']
    if 'prioridad' in datos:
        if datos['prioridad'] not in ('baja', 'media', 'alta'):
            return jsonify(error='La prioridad no es válida.'), 400
        campos['prioridad'] = datos['prioridad']
    if not campos:
        return jsonify(error='No hay cambios para guardar.'), 400
    with conectar() as conexion:
        existente = conexion.execute('SELECT id FROM tareas WHERE id = ?', (tarea_id,)).fetchone()
        if not existente:
            return jsonify(error='No se encontró esa tarea.'), 404
        asignaciones = ', '.join(f'{campo} = ?' for campo in campos)
        conexion.execute(f'UPDATE tareas SET {asignaciones} WHERE id = ?', (*campos.values(), tarea_id))
        tarea = conexion.execute('SELECT * FROM tareas WHERE id = ?', (tarea_id,)).fetchone()
    return jsonify(dict(tarea))


@app.delete('/api/tareas/<int:tarea_id>')
def eliminar_tarea(tarea_id):
    with conectar() as conexion:
        cursor = conexion.execute('DELETE FROM tareas WHERE id = ?', (tarea_id,))
        if cursor.rowcount == 0:
            return jsonify(error='No se encontró esa tarea.'), 404
    return jsonify(mensaje='Tarea eliminada.')


@app.get('/api/estadisticas')
def estadisticas():
    with conectar() as conexion:
        total = conexion.execute('SELECT COUNT(*) FROM tareas').fetchone()[0]
        completadas = conexion.execute("SELECT COUNT(*) FROM tareas WHERE estado = 'completada'").fetchone()[0]
        pendientes = total - completadas
    try:
        visitas = int(cache.get('visitas_totales') or 0)
        redis_ok = True
    except redis.RedisError:
        visitas = None
        redis_ok = False
    return jsonify(total=total, completadas=completadas, pendientes=pendientes,
                   visitas=visitas, redis_conectado=redis_ok)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
