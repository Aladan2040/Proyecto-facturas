import os
import uuid
import shutil
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel # <--- NUEVO

from extractor import extract_invoice_data

load_dotenv()

# --- CONFIGURACIÓN ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
BUCKET_NAME = "invoices_bucket"

if not url or not key:
    raise ValueError("¡Faltan credenciales en .env!")

supabase: Client = create_client(url, key)

app = FastAPI(title="API Facturas Perú")

# --- CORS ---
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://proyecto-facturas.vercel.app"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS DE DATOS (NUEVO) ---
class ItemUpdate(BaseModel):
    description: str | None = None
    brand: str | None = None
    quantity: float | None = None
    unit_price: float | None = None
    total_price: float | None = None

# --- ENDPOINTS ---

@app.get("/")
def health_check():
    return {"status": "online", "message": "Backend Inteligente Listo"}

@app.get("/invoices")
def get_invoices():
    try:
        response = supabase.table("invoices").select("*, invoice_items(*)").order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# NUEVO: Endpoint para editar un ítem específico
@app.put("/items/{item_id}")
def update_item(item_id: str, item: ItemUpdate):
    try:
        # Convertimos el modelo a diccionario, eliminando los valores vacíos (None)
        update_data = {k: v for k, v in item.dict().items() if v is not None}

        if not update_data:
            raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")

        # Actualizamos en Supabase
        data = supabase.table("invoice_items").update(update_data).eq("id", item_id).execute()
        return {"status": "success", "data": data.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error actualizando: {str(e)}")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    temp_filename = f"temp_{uuid.uuid4()}.pdf"

    try:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Solo se aceptan PDFs. Por favor verifica tu archivo.")

        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # PASO A: IA
        data_extracted = extract_invoice_data(temp_filename)

        # Manejo de error explícito desde la IA
        if "error" in data_extracted:
            raise HTTPException(status_code=422, detail=data_extracted["error"])

        # PASO B: Storage
        storage_filename = f"{uuid.uuid4()}.pdf"
        with open(temp_filename, "rb") as f:
            supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_filename, file=f, file_options={"content-type": "application/pdf"}
            )
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(storage_filename)

        # PASO C: Base de Datos
        invoice_payload = {
            "provider_ruc": data_extracted.get("provider_ruc"),
            "provider_name": data_extracted.get("provider_name"),
            "issue_date": data_extracted.get("issue_date"),
            "igv_amount": data_extracted.get("igv_amount"),
            "total_amount": data_extracted.get("total_amount"),
            "file_url": public_url,
            "status": "processed"
        }

        response_invoice = supabase.table("invoices").insert(invoice_payload).execute()
        new_invoice_id = response_invoice.data[0]['id']

        items_payload = []
        for item in data_extracted.get("items", []):
            items_payload.append({
                "invoice_id": new_invoice_id,
                "description": item.get("description"),
                "quantity": item.get("quantity"),
                "unit_price": item.get("unit_price"),
                "total_price": item.get("total_price")
            })

        if items_payload:
            supabase.table("invoice_items").insert(items_payload).execute()

        return {"status": "success", "message": "Factura procesada correctamente"}

    except HTTPException as he:
        raise he # Re-anzar errores HTTP conocidos (400, 422)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)