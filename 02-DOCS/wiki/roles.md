# Roles y Permisos — QA Hub

## Roles

| Rol | Descripción |
|---|---|
| **ADMIN** | Control total del sistema |
| **QA_LEAD** | Gestiona ciclos, matrices y campos. Sin proyectos ni usuarios. |
| **QA_TESTER** | Solo ejecución: editar celdas y marcar resultados |

## Permisos detallados

### Navegación

| Funcionalidad | ADMIN | QA_LEAD | QA_TESTER |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ |
| Proyectos (menú) | ✅ | ✅ | ❌ |
| Ciclos de Pruebas | ✅ | ✅ | ✅ |
| Mi Espacio | ✅ | ✅ | ✅ |
| Configuración | ✅ | ✅ | ✅ |

### Proyectos

| Funcionalidad | ADMIN | QA_LEAD | QA_TESTER |
|---|:---:|:---:|:---:|
| Ver todos los proyectos | ✅ | ❌ | ❌ |
| Ver proyectos asignados | — | ✅ | ✅ |
| Crear proyectos | ✅ | ❌ | ❌ |
| Eliminar proyectos | ✅ | ❌ | ❌ |

### Ciclos de pruebas

| Funcionalidad | ADMIN | QA_LEAD | QA_TESTER |
|---|:---:|:---:|:---:|
| Ver releases y ciclos | ✅ | ✅ | ✅ |
| Crear release / ciclo | ✅ | ✅ | ❌ |
| Eliminar release / ciclo | ✅ | ✅ | ❌ |
| Ver auditoría | ✅ | ✅ | ✅ |

### Matriz de pruebas

| Funcionalidad | ADMIN | QA_LEAD | QA_TESTER |
|---|:---:|:---:|:---:|
| Ver / editar celdas | ✅ | ✅ | ✅ |
| Cambiar status | ✅ | ✅ | ✅ |
| Escribir observaciones | ✅ | ✅ | ✅ |
| Eliminar fila | ✅ | ✅ | ❌ |
| Añadir/eliminar columna | ✅ | ✅ | ❌ |
| Importar CSV | ✅ | ✅ | ❌ |

### Configuración

| Funcionalidad | ADMIN | QA_LEAD | QA_TESTER |
|---|:---:|:---:|:---:|
| Mi perfil / cambiar password | ✅ | ✅ | ✅ |
| Campos personalizados | ✅ | ✅ | ❌ |
| Gestión de usuarios | ✅ | ❌ | ❌ |

## Implementación

Los permisos están aplicados en dos capas:
1. **Frontend** — visibilidad de botones y secciones según `role`
2. **Backend** — políticas RLS en Supabase que restringen operaciones por usuario autenticado
