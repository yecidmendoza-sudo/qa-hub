# QA Hub — Matriz de Roles y Permisos

## Roles del Sistema

| Rol | Descripción |
|-----|-------------|
| **ADMIN** | Administrador del sistema. Acceso total a todas las funcionalidades. |
| **QA_LEAD** | Líder de QA. Gestiona ciclos y matrices, sin acceso a administración de usuarios ni proyectos. |
| **QA_TESTER** | Tester de QA. Ejecuta las pruebas asignadas dentro de la matriz. |

---

## Tabla Comparativa de Permisos

### Navegación y Acceso General

| Funcionalidad | ADMIN | QA_LEAD | QA_TESTER |
|---------------|:-----:|:-------:|:---------:|
| Dashboard | ✅ | ✅ | ✅ |
| Sección "Proyectos" en menú lateral | ✅ | ✅ | ❌ |
| Sección "Ciclos de Pruebas" en menú lateral | ✅ | ✅ | ✅ |
| Sección "Mi Espacio" en menú lateral | ✅ | ✅ | ✅ |
| Configuración del Sistema | ✅ | ✅ | ✅ |

---

### Proyectos

| Funcionalidad | ADMIN | QA_LEAD | QA_TESTER |
|---------------|:-----:|:-------:|:---------:|
| Ver todos los proyectos del sistema | ✅ | ❌ | ❌ |
| Ver proyectos asignados (vía `user_projects`) | — | ✅ | ✅ |
| Crear nuevos proyectos | ✅ | ❌ | ❌ |
| Eliminar proyectos | ✅ | ❌ | ❌ |

---

### Ciclos de Pruebas (Releases y Ciclos)

| Funcionalidad | ADMIN | QA_LEAD | QA_TESTER |
|---------------|:-----:|:-------:|:---------:|
| Ver releases y ciclos | ✅ | ✅ | ✅ |
| Crear nuevo release (versión) | ✅ | ✅ | ❌ |
| Eliminar release | ✅ | ✅ | ❌ |
| Crear nuevo ciclo dentro de un release | ✅ | ✅ | ❌ |
| Eliminar ciclo | ✅ | ✅ | ❌ |
| Abrir / ver la matriz de un ciclo | ✅ | ✅ | ✅ |
| Ver historial de auditoría | ✅ | ✅ | ✅ |

---

### Matriz de Pruebas (Ejecución)

| Funcionalidad | ADMIN | QA_LEAD | QA_TESTER |
|---------------|:-----:|:-------:|:---------:|
| Ver casos de prueba | ✅ | ✅ | ✅ |
| Editar celdas (Ticket, Task Name, Módulo, Expected Result) | ✅ | ✅ | ✅ |
| Cambiar status de un caso (PASS / FAIL / BLOCKED / PENDING) | ✅ | ✅ | ✅ |
| Escribir observaciones | ✅ | ✅ | ✅ |
| Editar valores de columnas personalizadas | ✅ | ✅ | ✅ |
| Añadir caso de prueba manual (nueva fila) | ✅ | ✅ | ✅ |
| Eliminar caso de prueba (fila) | ✅ | ✅ | ❌ |
| Añadir columna personalizada a la matriz | ✅ | ✅ | ❌ |
| Eliminar columna personalizada | ✅ | ✅ | ❌ |
| Importar CSV con casos de prueba | ✅ | ✅ | ❌ |
| Descargar plantilla CSV | ✅ | ✅ | ❌ |

---

### Dashboard

| Funcionalidad | ADMIN | QA_LEAD | QA_TESTER |
|---------------|:-----:|:-------:|:---------:|
| Ver estadísticas del proyecto (ciclos PASSED, FAILED, en progreso) | ✅ | ✅ | ✅ |
| Ver histórico global de ciclos por versión | ✅ | ✅ | ✅ |
| Ver sección "QA Team" (QAs asignados al proyecto) | ✅ | ✅ | ❌ |

---

### Configuración del Sistema

| Funcionalidad | ADMIN | QA_LEAD | QA_TESTER |
|---------------|:-----:|:-------:|:---------:|
| Mi Perfil (ver email, rol) | ✅ | ✅ | ✅ |
| Cambiar contraseña propia | ✅ | ✅ | ✅ |
| Campos Personalizados (crear/eliminar campos para formulario de ciclos) | ✅ | ✅ | ❌ |
| Gestión de Usuarios (crear QAs, asignar proyectos, reset passwords) | ✅ | ❌ | ❌ |

---

## Resumen Ejecutivo

```
┌─────────────┬──────────────────────────────────────────────────────────┐
│   ADMIN     │  Control total del sistema                              │
├─────────────┼──────────────────────────────────────────────────────────┤
│   QA_LEAD   │  Gestión de ciclos, matrices y campos personalizados.   │
│             │  Sin acceso a crear proyectos ni gestionar usuarios.    │
├─────────────┼──────────────────────────────────────────────────────────┤
│  QA_TESTER  │  Solo ejecución: editar celdas de la matriz y marcar   │
│             │  el resultado de cada caso de prueba.                   │
└─────────────┴──────────────────────────────────────────────────────────┘
```

> **Nota**: Los permisos están implementados tanto a nivel de **frontend** (visibilidad de botones y secciones) como a nivel de **backend** (políticas RLS en Supabase que restringen las operaciones según el usuario autenticado).
