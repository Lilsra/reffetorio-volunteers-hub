

## Plan: Agregar enlace al panel de administrador

Agregaré un enlace discreto al panel de administrador en el footer de la página principal, para que puedas acceder fácilmente sin que sea muy visible para los voluntarios.

---

### Cambios a realizar

**Archivo: `src/pages/Index.tsx`**

Modificaré la sección del footer (líneas 99-106) para agregar un enlace discreto que diga "Administración" y que lleve a `/admin/login`.

El enlace será:
- Discreto y con estilo sutil (color gris claro)
- Separado del texto de copyright con un separador
- Con efecto hover para indicar que es clickeable

### Vista previa del resultado

```text
┌─────────────────────────────────────────────────┐
│                    Footer                        │
│                                                  │
│  © 2026 Reffetorio Mérida. Todos los derechos   │
│                  reservados.                     │
│                                                  │
│               Administración ←── (enlace nuevo)  │
└─────────────────────────────────────────────────┘
```

---

### Detalles técnicos

- Importar `Link` de `react-router-dom` en `Index.tsx`
- Agregar un `<Link to="/admin/login">` en el footer con clases de estilo discretas
- El enlace usará `text-muted-foreground/60 hover:text-primary` para un aspecto sutil

