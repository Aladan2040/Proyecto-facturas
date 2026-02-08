# 📄 Sistema de Gestión de Facturas con IA

Sistema inteligente para el procesamiento automático de facturas PDF utilizando Inteligencia Artificial para extraer y gestionar datos de facturación.

## 🌟 Características Principales

- ✅ **Extracción automática de datos** de facturas PDF usando Google Gemini AI
- ✅ **Carga individual y masiva** de documentos (hasta 15 PDFs simultáneamente)
- ✅ **Base de datos en tiempo real** con Supabase
- ✅ **Interfaz moderna y responsiva** con React + Tailwind CSS
- ✅ **Edición en línea** de productos y cantidades
- ✅ **Exportación a Excel** con todos los datos procesados
- ✅ **Soporte multi-moneda** (PEN, USD, EUR)
- ✅ **Almacenamiento en la nube** de archivos PDF

## 🛠️ Tecnologías Utilizadas

### Backend
- **FastAPI** - Framework web Python moderno y rápido
- **Google Gemini AI** - Procesamiento de documentos con IA
- **Supabase** - Base de datos PostgreSQL en tiempo real
- **Python-dotenv** - Gestión de variables de entorno
- **Pydantic** - Validación de datos
- **Uvicorn** - Servidor ASGI

### Frontend
- **React 19** - Biblioteca de interfaz de usuario
- **Vite** - Herramienta de construcción rápida
- **Tailwind CSS** - Framework de diseño utility-first
- **Heroicons** - Iconografía SVG
- **Axios** - Cliente HTTP
- **Sonner** - Sistema de notificaciones
- **XLSX** - Exportación a Excel

### Infraestructura
- **Supabase Storage** - Almacenamiento de archivos
- **PostgreSQL** - Base de datos relacional
- **Row Level Security (RLS)** - Seguridad a nivel de fila

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  FastAPI Backend │    │  Google Gemini  │
│                 │    │                 │    │       AI        │
│  - Carga PDFs   │◄──►│  - Procesa PDFs │◄──►│  - Extrae datos │
│  - Muestra datos│    │  - API REST     │    │  - Valida JSON  │
│  - Edita items  │    │  - Validaciones │    └─────────────────┘
└─────────────────┘    └─────────────────┘              │
         │                       │                      │
         │                       ▼                      │
         │              ┌─────────────────┐              │
         │              │   Supabase      │              │
         │              │                 │              │
         └─────────────►│  - PostgreSQL   │◄─────────────┘
                        │  - Storage      │
                        │  - Real-time DB │
                        └─────────────────┘
```

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Python 3.12+** 
- **Node.js 18+** 
- **npm 8+**
- **Git**

## ⚙️ Configuración Inicial

### 1. Clonar el Repositorio

```bash
git clone <url-del-repositorio>
cd proyecto-facturas
```

### 2. Configurar Variables de Entorno

Crea el archivo `.env` en la carpeta `backend/` con las siguientes variables:

```env
# Google Gemini AI
GEMINI_API_KEY=tu_api_key_de_gemini

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_anon_key_de_supabase
```

### 3. Configurar Supabase

#### Crear las tablas necesarias:

```sql
-- Tabla de facturas
CREATE TABLE invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    invoice_series TEXT,
    invoice_number TEXT,
    provider_ruc TEXT,
    provider_name TEXT,
    issue_date DATE,
    currency TEXT DEFAULT 'PEN',
    igv_amount DECIMAL,
    total_amount DECIMAL,
    file_url TEXT,
    status TEXT DEFAULT 'processed'
);

-- Tabla de items de facturas
CREATE TABLE invoice_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT,
    brand TEXT,
    quantity DECIMAL,
    unit_price DECIMAL,
    total_price DECIMAL
);

-- Índices para mejor rendimiento
CREATE INDEX idx_invoices_series_number ON invoices(invoice_series, invoice_number);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
```

#### Configurar Storage:

1. Crear bucket llamado `invoices_bucket`
2. Marcar como **público**
3. Configurar políticas de acceso

#### Configurar RLS (Row Level Security):

```sql
-- Habilitar RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para desarrollo
CREATE POLICY "Allow all on invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on invoice_items" ON invoice_items FOR ALL USING (true) WITH CHECK (true);
```

## 🚀 Instalación y Ejecución

### Configuración del Entorno Python

```bash
# Crear entorno virtual en la raíz del proyecto
python -m venv .venv

# Activar entorno virtual
# En Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# En Windows CMD:
.venv\Scripts\activate.bat
# En macOS/Linux:
source .venv/bin/activate

# Instalar dependencias del backend
pip install -r backend/requirements.txt
```

### Backend (FastAPI)

```bash
# Desde la raíz del proyecto, con el entorno virtual activado
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# O alternativamente:
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

El backend estará disponible en: `http://localhost:8000`

### Frontend (React)

```bash
# Navegar a la carpeta del frontend (en otra terminal)
cd frontend

# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

## 📖 Guía de Uso

### 1. Carga Individual de Facturas
- Click en **"Seleccionar PDF"** (botón azul)
- Selecciona un archivo PDF de factura
- El sistema procesará automáticamente con IA
- Los datos aparecerán en las tablas

### 2. Carga Masiva de Facturas
- Click en **"Seleccionar Múltiples"** (botón verde)
- Selecciona hasta 15 PDFs simultáneamente
- Observa el progreso en tiempo real
- Revisa el resumen final

### 3. Visualización de Datos
- **Vista "Por Facturas"**: Muestra todos los productos línea por línea
- **Vista "Editar Productos"**: Permite modificar descripción, cantidad y precios

### 4. Edición de Productos
- Click en el icono de lápiz en cualquier producto
- Modifica descripción, cantidad o precio unitario
- El total se recalcula automáticamente
- Click en ✅ para guardar o ❌ para cancelar

### 5. Exportación de Datos
- Click en **"Exportar"** para descargar Excel
- El archivo incluye todos los datos visibles en las tablas
- Formato: `Reporte_Facturas.xlsx`

## 📊 Estructura de Datos

### Formato JSON extraído por IA:
```json
{
  "invoice_series": "F001",
  "invoice_number": "00000123",
  "provider_ruc": "20123456789",
  "provider_name": "Empresa Ejemplo S.A.C.",
  "issue_date": "2024-12-01",
  "currency": "PEN",
  "igv_amount": 180.00,
  "total_amount": 1180.00,
  "items": [
    {
      "description": "Producto ejemplo",
      "quantity": 2,
      "unit_price": 500.00,
      "total_price": 1000.00
    }
  ]
}
```

## 🔧 Scripts Disponibles

### Backend
```bash
# Ejecutar servidor (desde la raíz del proyecto)
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Verificar modelos de Gemini (desde la carpeta backend)
cd backend
python check-models.py
```

### Frontend
```bash
npm run dev                 # Servidor de desarrollo
npm run build              # Construir para producción
npm run preview            # Preview de producción
npm run lint               # Linter de código
```

## 📝 API Endpoints

### Principales endpoints del backend:

- `GET /` - Health check
- `GET /invoices` - Obtener todas las facturas
- `POST /upload` - Subir factura individual
- `POST /upload-bulk` - Subir facturas masivamente
- `PUT /items/{item_id}` - Actualizar item específico

### Documentación interactiva:
Visita `http://localhost:8000/docs` para la documentación completa de la API.

## 🎯 Límites y Consideraciones

- **Carga masiva**: Máximo 15 archivos por lote
- **Tamaño de archivo**: Limitado por Supabase (plan gratuito: 500MB total)
- **Tipos de archivo**: Solo PDF
- **Monedas soportadas**: PEN, USD, EUR
- **Rate limiting**: Google Gemini AI (~60 requests/minuto)

## 🐛 Solución de Problemas

### Error: "No se encontró la API KEY"
- Verifica que `GEMINI_API_KEY` esté en el archivo `.env`
- Asegúrate de que la API key sea válida

### Error: "Error de conexión con Supabase"
- Verifica `SUPABASE_URL` y `SUPABASE_KEY` en `.env`
- Confirma que las tablas existan en la base de datos
- Revisa las políticas RLS

### Frontend no se conecta al backend
- Verifica que el backend esté ejecutándose en puerto 8000
- Revisa la configuración CORS en `main.py`
- Confirma que no haya firewall bloqueando las conexiones


## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

---