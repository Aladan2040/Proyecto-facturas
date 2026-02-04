import google.generativeai as genai
import os
from dotenv import load_dotenv
import json

load_dotenv()

# Configurar Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

def extract_invoice_data(pdf_path: str):
    """
    Toma la ruta de un PDF, lo sube a Gemini y extrae los datos en JSON.
    """
    # Usamos el alias que apunta a la versión Flash estable y gratuita
    model = genai.GenerativeModel("models/gemini-flash-latest")

    # 1. Subir el archivo a la memoria temporal de Google AI
    # Nota: Esto no consume tu storage de Supabase
    sample_file = genai.upload_file(path=pdf_path, display_name="Factura Procesar")

    # 2. El Prompt de Ingeniería (Las instrucciones precisas)
    prompt = """
    Analiza este documento PDF. Es un paquete de documentos, pero SOLO me interesa la 'FACTURA ELECTRÓNICA'.
    Ignora las órdenes de compra, guías de remisión o requerimientos.

    Extrae la siguiente información de la Factura Electrónica y devuélvela EXCLUSIVAMENTE en formato JSON válido:

    {
      "provider_ruc": "El RUC del proveedor (solo números)",
      "provider_name": "Razón social del proveedor",
      "issue_date": "Fecha de emisión (formato YYYY-MM-DD)",
      "igv_amount": 0.00 (número decimal),
      "total_amount": 0.00 (número decimal),
      "items": [
        {
          "description": "Descripción del producto",
          "quantity": 0,
          "unit_price": 0.00,
          "total_price": 0.00
        }
      ]
    }
    
    Si no encuentras una factura válida, devuelve un JSON con error: {"error": "No se encontró factura"}.
    No uses markdown (```json), solo devuelve el texto plano del JSON.
    """

    # 3. Generar la respuesta
    response = model.generate_content([sample_file, prompt])

    # 4. Limpieza (Importante para no pagar almacenamiento en Google AI)
    genai.delete_file(sample_file.name)

    # 5. Parsear el texto a Diccionario Python
    try:
        # Limpiamos por si Gemini puso ```json al principio
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"Error parseando JSON: {e}")
        return {"error": "Fallo al leer la respuesta de la IA"}