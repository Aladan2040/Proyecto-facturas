import google.generativeai as genai
import os
from dotenv import load_dotenv
import json

# Cargar .env desde la carpeta backend
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

def extract_invoice_data(pdf_path: str):
    """
    Toma la ruta de un PDF, lo sube a Gemini y extrae los datos en JSON.
    """

    model = genai.GenerativeModel("models/gemini-flash-latest")

    sample_file = genai.upload_file(
        path=pdf_path,
        display_name="Factura a procesar"
    )

    prompt = """
Analiza cuidadosamente este documento PDF. Puede contener varios documentos,
pero SOLO debes procesar la FACTURA ELECTRÓNICA.

Ignora órdenes de compra, guías de remisión, cotizaciones u otros documentos.

Extrae la información únicamente de la FACTURA ELECTRÓNICA y devuelve
EXCLUSIVAMENTE un JSON válido, sin texto adicional ni markdown.

REGLAS OBLIGATORIAS:
- Si un campo NO existe en la factura, devuelve null.
- NO inventes datos.
- Todos los montos deben ser números decimales sin símbolos.
- Las fechas deben estar en formato YYYY-MM-DD.
- Identifica correctamente la moneda según el documento.
- Si hay más de una moneda, usa la de TOTAL.

FORMATO EXACTO DE SALIDA:

{
  "invoice_series": "Serie de la factura (ej: F001, E001)",
  "invoice_number": "Número correlativo de la factura",
  "provider_ruc": "RUC del proveedor (solo números)",
  "provider_name": "Razón social del proveedor",
  "issue_date": "Fecha de emisión (YYYY-MM-DD)",
  "currency": "Código de moneda (PEN, USD, EUR)",
  "igv_amount": 0.00,
  "total_amount": 0.00,
  "items": [
    {
      "description": "Descripción del producto o servicio",
      "quantity": 0,
      "unit_price": 0.00,
      "total_price": 0.00
    }
  ]
}

CONDICIONES ESPECIALES:
- Si la factura NO incluye IGV, devuelve "igv_amount": null
- Si no se encuentra una factura electrónica válida, devuelve:
  {"error": "No se encontró factura electrónica válida"}

Devuelve SOLO el JSON plano.
"""

    response = model.generate_content([sample_file, prompt])

    genai.delete_file(sample_file.name)

    try:
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        print("❌ Error parseando JSON:", e)
        print("Respuesta cruda:", response.text)
        return {"error": "Fallo al leer la respuesta de la IA"}
