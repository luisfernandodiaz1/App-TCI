---
name: Contexto del Proyecto
description: Visión general del sistema actual y áreas de mejora crítica.
type: project
---

- **Sistema**: Aplicación de Control de Inventarios, Flota Vehicular y Órdenes de Trabajo (OT).
- **Arquitectura**: SPA (Single Page Application) basada en JavaScript con persistencia en `localStorage` (vía `js/db.js`).
- **Estado Actual**: 
  - Módulo de empleados recientemente integrado.
  - Se han detectado errores de redundancia y falta de librerías gráficas (corregidos recientemente).
  - **Deuda Técnica Crítica**: Uso de floats para cálculos monetarios, falta de cierres de caja y auditoría financiera.
- **Misión**: Transformar este prototipo avanzado en un ERP robusto que cumpla con normativas NIF.
