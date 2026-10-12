# Mi Gestor — Aplicación de gestión de tareas en español

Aplicación web en español desarrollada con Flask, SQLite, Redis y Docker Compose.

## Requisitos
- Docker Desktop instalado y abierto en Windows.
- Visual Studio Code (opcional, recomendado para editar el proyecto).

## Ejecutar el proyecto
1. Descomprime la carpeta del proyecto.
2. Abre la carpeta `gestor_tareas_pro` en Visual Studio Code.
3. Abre **Terminal → New Terminal**.
4. Ejecuta:
   ```bash
   docker compose up --build
   ```
5. Cuando los servicios estén listos, abre `http://localhost:5000`.
6. Para detener la aplicación, pulsa `Ctrl + C` y ejecuta `docker compose down` en la terminal si fuera necesario.

## Qué incluye
- Interfaz gráfica en español, adaptable a móviles, con estadísticas, búsqueda, filtros y formulario modal.
- Crear, editar, completar/reabrir y eliminar tareas.
- SQLite para guardar las tareas en un volumen persistente.
- Redis para contar las visitas a la página principal.
- Docker Compose para iniciar Flask y Redis juntos.

## Comandos útiles
- Ver estado: `docker compose ps`
- Ver logs: `docker compose logs -f`
- Detener servicios: `docker compose down`
- Detener y borrar también los datos persistentes: `docker compose down -v` (¡esto elimina los datos guardados!).

El contador incrementa cada vez que se carga la página principal `/`. En esta versión cuenta cargas de página, no visitantes únicos.
