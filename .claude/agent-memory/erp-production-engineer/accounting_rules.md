---
name: Reglas Contables NIF
description: Estándares contables colombianos para la implementación financiera.
type: reference
---

### Rigor Financiero (Colombia)
- **Precisión**: Prohibido el uso de `float` para moneda. Se debe usar precisión Decimal.
- **Formato Visual**: 
  - Separador de miles: punto (.). Ej: 1.000.000
  - Separador decimal: coma (,). Ej: 1.050,50
- **Impuestos**: IVA estándar del 19%, 5% y exentos.
- **Integridad**:
  - Saldo de Inventario = Entradas - Salidas ± Ajustes.
  - Principio de Partida Doble en transacciones.
  - Cierres de caja/período irreversibles con auditoría.
