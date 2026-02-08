import { useState, useEffect } from 'react';
import api from './api';
import * as XLSX from 'xlsx';
import { Toaster, toast } from 'sonner'; // <--- LIBRERÍA DE TOASTS
import {
    CloudArrowUpIcon, TableCellsIcon, ArrowDownTrayIcon,
    ChevronDownIcon, ChevronUpIcon, QueueListIcon, DocumentTextIcon,
    PencilSquareIcon, CheckIcon, XMarkIcon
} from '@heroicons/react/24/outline';

function App() {
    const [uploading, setUploading] = useState(false);
    const [invoices, setInvoices] = useState([]);
    const [expandedRow, setExpandedRow] = useState(null);
    const [viewMode, setViewMode] = useState('invoices');

    // ESTADOS PARA EDICIÓN
    const [editingId, setEditingId] = useState(null); // ID del producto que se está editando
    const [editForm, setEditForm] = useState({}); // Datos temporales mientras editas

    // ESTADOS PARA CARGA MASIVA
    const [bulkUploading, setBulkUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState([]);
    const [showBulkUpload, setShowBulkUpload] = useState(false);

    const fetchInvoices = async () => {
        try {
            const response = await api.get('/invoices');
            setInvoices(response.data);
        } catch (error) {
            toast.error('Error de conexión', { description: 'No se pudo cargar el historial.' });
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        // Usamos toast.promise para feedback visual automático de carga/éxito/error
        toast.promise(
            api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }),
            {
                loading: 'Analizando documento con IA...',
                success: (data) => {
                    fetchInvoices();
                    return '¡Factura procesada y guardada exitosamente!';
                },
                error: (err) => {
                    // Aquí capturamos el mensaje de error que envía el Backend (ej: "No es una factura")
                    return err.response?.data?.detail || 'Error al procesar el archivo';
                },
            }
        );

        // Limpiamos input y estado al finalizar (la promesa maneja la UI)
        e.target.value = '';
        setUploading(false);
    };

    // CARGA MASIVA DE ARCHIVOS - Optimizada con endpoint bulk
    const handleBulkFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        // Máximo 15 archivos
        if (files.length > 15) {
            toast.error('Máximo 15 archivos permitidos');
            return;
        }

        // Validar que todos sean PDFs
        const invalidFiles = files.filter(file => file.type !== 'application/pdf');
        if (invalidFiles.length > 0) {
            toast.error(`${invalidFiles.length} archivo(s) no son PDF. Solo se permiten archivos PDF.`);
            return;
        }

        setBulkUploading(true);
        setUploadProgress(files.map((file, index) => ({
            id: index,
            name: file.name,
            status: 'processing',
            message: 'Procesando...'
        })));

        try {
            const formData = new FormData();
            files.forEach(file => {
                formData.append('files', file);
            });

            const response = await api.post('/upload-bulk', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            // Actualizar progreso con resultados del servidor
            setUploadProgress(prev => prev.map((item, index) => {
                const result = response.data.results[index];
                return {
                    ...item,
                    status: result.status,
                    message: result.message
                };
            }));

            fetchInvoices(); // Recargar datos
            toast.success(response.data.message);

        } catch (error) {
            // Error general en la carga
            setUploadProgress(prev => prev.map(item => ({
                ...item,
                status: 'error',
                message: 'Error en la conexión'
            })));
            toast.error('Error durante la carga masiva');
        }

        setBulkUploading(false);
        e.target.value = ''; // Limpiar input
    };

    const exportToExcel = () => {
        const rows = [];
        invoices.forEach(inv => {
            if (inv.invoice_items && inv.invoice_items.length > 0) {
                inv.invoice_items.forEach(item => {
                    rows.push({
                        Fecha: inv.issue_date,
                        NRO_SERIE: inv.invoice_series || '-',
                        NRO_FACTURA: inv.invoice_number || '-',
                        Proveedor: inv.provider_name,
                        RUC: inv.provider_ruc,
                        Descripcion: item.description,
                        Cantidad: item.quantity,
                        Precio_Unit: item.unit_price,
                        Total_Linea: item.total_price,
                        Total_Factura: inv.total_amount,
                        IGV: inv.igv_amount ?? 0,
                        MONEDA: inv.currency || 'PEN'
                    });
                });
            } else {
                rows.push({
                    Fecha: inv.issue_date,
                    NRO_SERIE: inv.invoice_series || '-',
                    NRO_FACTURA: inv.invoice_number || '-',
                    Proveedor: inv.provider_name,
                    RUC: inv.provider_ruc,
                    Total_Factura: inv.total_amount,
                    IGV: inv.igv_amount ?? 0,
                    MONEDA: inv.currency || 'PEN'
                });
            }
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Facturas");
        XLSX.writeFile(workbook, "Reporte_Facturas.xlsx");
        toast.success("Archivo Excel descargado");
    };

    // --- LÓGICA DE EDICIÓN ---
    const startEditing = (item) => {
        setEditingId(item.id);
        setEditForm({ ...item }); // Copiamos los datos actuales al formulario temporal
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = async () => {
        try {
            // Enviamos solo los campos que queremos actualizar
            await api.put(`/items/${editingId}`, {
                description: editForm.description,
                quantity: parseFloat(editForm.quantity),
                unit_price: parseFloat(editForm.unit_price),
                total_price: parseFloat(editForm.quantity) * parseFloat(editForm.unit_price) // Recalculamos total
            });

            toast.success("Producto actualizado");
            setEditingId(null);
            fetchInvoices(); // Recargamos la tabla para ver cambios
        } catch (error) {
            toast.error("Error al guardar cambios");
            console.error(error);
        }
    };

    // Función auxiliar para manejar inputs
    const handleEditChange = (e, field) => {
        setEditForm(prev => ({ ...prev, [field]: e.target.value }));
    };

    // Aplanamos datos para la vista de productos con todos los campos del Excel
    const allProducts = invoices.flatMap(inv =>
        inv.invoice_items.map(item => ({
            ...item,
            // Datos de la factura
            issue_date: inv.issue_date,
            invoice_series: inv.invoice_series,
            invoice_number: inv.invoice_number,
            provider_name: inv.provider_name,
            provider_ruc: inv.provider_ruc,
            total_factura: inv.total_amount,
            igv_amount: inv.igv_amount,
            currency: item.currency || inv.currency,
        }))
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans">
            {/* Componente de Notificaciones (Toasts) */}
            <Toaster position="top-center" richColors />

            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Sistema de Gestión de Facturas</h1>
                        <p className="text-slate-500 text-sm">Panel de Control Inteligente</p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg mt-4 md:mt-0">
                        <button
                            onClick={() => setViewMode('invoices')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                viewMode === 'invoices' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <DocumentTextIcon className="w-4 h-4" /> Por Facturas
                        </button>
                        <button
                            onClick={() => setViewMode('products')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                viewMode === 'products' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <QueueListIcon className="w-4 h-4" /> Editar Productos
                        </button>
                    </div>
                </div>

                {/* Carga Individual y Masiva */}
                <div className="grid md:grid-cols-2 gap-4">
                    {/* Carga Individual */}
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-full shadow-sm">
                                <CloudArrowUpIcon className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-indigo-900">Cargar Factura Individual</h3>
                                <p className="text-xs text-indigo-600">Sube 1 PDF para procesarlo</p>
                            </div>
                        </div>
                        <label className={`cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {uploading ? 'Procesando...' : 'Seleccionar PDF'}
                            <input type="file" className="hidden" accept="application/pdf" onChange={handleFileChange} disabled={uploading}/>
                        </label>
                    </div>

                    {/* Carga Masiva */}
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-full shadow-sm">
                                <QueueListIcon className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-emerald-900">Carga Masiva</h3>
                                <p className="text-xs text-emerald-600">Sube hasta 15 PDFs simultáneamente</p>
                            </div>
                        </div>
                        <label className={`cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ${bulkUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {bulkUploading ? 'Procesando...' : 'Seleccionar Múltiples'}
                            <input type="file" className="hidden" accept="application/pdf" multiple onChange={handleBulkFileChange} disabled={bulkUploading}/>
                        </label>
                    </div>
                </div>

                {/* Progreso de Carga Masiva */}
                {uploadProgress.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            <QueueListIcon className="w-5 h-5" />
                            Progreso de Carga Masiva ({uploadProgress.filter(p => p.status === 'success').length}/{uploadProgress.length})
                        </h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {uploadProgress.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${
                                            item.status === 'success' ? 'bg-green-500' :
                                            item.status === 'error' ? 'bg-red-500' :
                                            item.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                                            'bg-gray-300'
                                        }`}></div>
                                        <span className="text-sm font-medium text-slate-700 truncate max-w-xs">{item.name}</span>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                        item.status === 'success' ? 'bg-green-100 text-green-700' :
                                        item.status === 'error' ? 'bg-red-100 text-red-700' :
                                        item.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>{item.message}</span>
                                </div>
                            ))}
                        </div>
                        {!bulkUploading && (
                            <button 
                                onClick={() => setUploadProgress([])} 
                                className="mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Limpiar lista
                            </button>
                        )}
                    </div>
                )}

                {/* TABLAS */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                        <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                            {viewMode === 'invoices' ? <DocumentTextIcon className="w-5 h-5"/> : <PencilSquareIcon className="w-5 h-5"/>}
                            {viewMode === 'invoices' ? `Historial (${invoices.length})` : `Edición de Productos (${allProducts.length})`}
                        </h2>
                        <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm transition-all">
                            <ArrowDownTrayIcon className="w-4 h-4"/> Exportar
                        </button>
                    </div>

                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        {/* VISTA FACTURAS - Mostrando todos los productos línea por línea */}
                        {viewMode === 'invoices' && (
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">NRO SERIE</th>
                                    <th className="px-4 py-3">NRO FACTURA</th>
                                    <th className="px-4 py-3">Proveedor</th>
                                    <th className="px-4 py-3">RUC</th>
                                    <th className="px-4 py-3">Descripción</th>
                                    <th className="px-4 py-3 text-right">Cantidad</th>
                                    <th className="px-4 py-3 text-right w-28">Precio Unit</th>
                                    <th className="px-4 py-3 text-right w-28">Total Línea</th>
                                    <th className="px-4 py-3 text-right w-32">Total Factura</th>
                                    <th className="px-4 py-3 text-right w-24">IGV</th>
                                    <th className="px-4 py-3 text-center">MONEDA</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                {invoices.map((inv) => (
                                    inv.invoice_items && inv.invoice_items.length > 0 ? (
                                        // Si tiene productos, mostrar una fila por producto
                                        inv.invoice_items.map((item, index) => (
                                            <tr key={`${inv.id}-${item.id}`} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">{inv.issue_date}</td>
                                                <td className="px-4 py-3">{inv.invoice_series || '-'}</td>
                                                <td className="px-4 py-3">{inv.invoice_number || '-'}</td>
                                                <td className="px-4 py-3 font-medium text-slate-900">{inv.provider_name}</td>
                                                <td className="px-4 py-3">{inv.provider_ruc}</td>
                                                <td className="px-4 py-3">{item.description}</td>
                                                <td className="px-4 py-3 text-right">{item.quantity}</td>
                                                <td className="px-4 py-3 text-right w-28 font-mono">{(inv.currency === 'USD' ? '$' : inv.currency === 'EUR' ? '€' : 'S/') + ' ' + item.unit_price}</td>
                                                <td className="px-4 py-3 text-right w-28 font-mono font-medium text-emerald-600">{(inv.currency === 'USD' ? '$' : inv.currency === 'EUR' ? '€' : 'S/') + ' ' + item.total_price}</td>
                                                <td className="px-4 py-3 text-right w-32 font-mono font-bold text-emerald-700">{(inv.currency === 'USD' ? '$' : inv.currency === 'EUR' ? '€' : 'S/') + ' ' + inv.total_amount}</td>
                                                <td className="px-4 py-3 text-right w-24 font-mono">{(inv.currency === 'USD' ? '$' : inv.currency === 'EUR' ? '€' : 'S/') + ' ' + (inv.igv_amount ?? 0)}</td>
                                                <td className="px-4 py-3 text-center">{inv.currency || 'PEN'}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        // Si no tiene productos, mostrar solo los datos de la factura
                                        <tr key={inv.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">{inv.issue_date}</td>
                                            <td className="px-4 py-3">{inv.invoice_series || '-'}</td>
                                            <td className="px-4 py-3">{inv.invoice_number || '-'}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{inv.provider_name}</td>
                                            <td className="px-4 py-3">{inv.provider_ruc}</td>
                                            <td className="px-4 py-3 text-slate-400 italic">Sin productos</td>
                                            <td className="px-4 py-3"></td>
                                            <td className="px-4 py-3"></td>
                                            <td className="px-4 py-3"></td>
                                            <td className="px-4 py-3 text-right w-32 font-mono font-bold text-emerald-700">{(inv.currency === 'USD' ? '$' : inv.currency === 'EUR' ? '€' : 'S/') + ' ' + inv.total_amount}</td>
                                            <td className="px-4 py-3 text-right w-24 font-mono">{(inv.currency === 'USD' ? '$' : inv.currency === 'EUR' ? '€' : 'S/') + ' ' + (inv.igv_amount ?? 0)}</td>
                                            <td className="px-4 py-3 text-center">{inv.currency || 'PEN'}</td>
                                        </tr>
                                    )
                                ))}
                                </tbody>
                            </table>
                        )}

                        {/* VISTA PRODUCTOS (EDITABLE) - Mismas columnas que el Excel */}
                        {viewMode === 'products' && (
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">NRO SERIE</th>
                                    <th className="px-4 py-3">NRO FACTURA</th>
                                    <th className="px-4 py-3">Proveedor</th>
                                    <th className="px-4 py-3">RUC</th>
                                    <th className="px-4 py-3">Descripción</th>
                                    <th className="px-4 py-3 text-right">Cantidad</th>
                                    <th className="px-4 py-3 text-right w-28">Precio Unit</th>
                                    <th className="px-4 py-3 text-right w-28">Total Línea</th>
                                    <th className="px-4 py-3 text-right w-32">Total Factura</th>
                                    <th className="px-4 py-3 text-right w-24">IGV</th>
                                    <th className="px-4 py-3 text-center">MONEDA</th>
                                    <th className="px-4 py-3 text-center">Acción</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                {allProducts.map((item) => (
                                    <tr key={item.id} className={editingId === item.id ? "bg-indigo-50" : "hover:bg-slate-50"}>
                                        
                                        {/* COLUMNA FECHA */}
                                        <td className="px-4 py-3">{item.issue_date}</td>
                                        
                                        {/* COLUMNA SERIE */}
                                        <td className="px-4 py-3">{item.invoice_series || '-'}</td>
                                        
                                        {/* COLUMNA NÚMERO */}
                                        <td className="px-4 py-3">{item.invoice_number || '-'}</td>
                                        
                                        {/* COLUMNA PROVEEDOR */}
                                        <td className="px-4 py-3 font-medium text-slate-900">{item.provider_name}</td>
                                        
                                        {/* COLUMNA RUC */}
                                        <td className="px-4 py-3">{item.provider_ruc}</td>

                                        {/* COLUMNA DESCRIPCIÓN */}
                                        <td className="px-4 py-3">
                                            {editingId === item.id ? (
                                                <input
                                                    type="text"
                                                    className="w-full border-gray-300 rounded text-sm px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                    value={editForm.description}
                                                    onChange={(e) => handleEditChange(e, 'description')}
                                                />
                                            ) : (
                                                <span className="font-medium text-slate-700">{item.description}</span>
                                            )}
                                        </td>

                                        {/* COLUMNA CANTIDAD */}
                                        <td className="px-4 py-3 text-right">
                                            {editingId === item.id ? (
                                                <input
                                                    type="number"
                                                    className="w-20 border-gray-300 rounded text-sm px-2 py-1 text-right"
                                                    value={editForm.quantity}
                                                    onChange={(e) => handleEditChange(e, 'quantity')}
                                                />
                                            ) : item.quantity}
                                        </td>

                                        {/* COLUMNA PRECIO UNITARIO */}
                                        <td className="px-4 py-3 text-right w-28">
                                            {editingId === item.id ? (
                                                <input
                                                    type="number" step="0.01"
                                                    className="w-24 border-gray-300 rounded text-sm px-2 py-1 text-right font-mono"
                                                    value={editForm.unit_price}
                                                    onChange={(e) => handleEditChange(e, 'unit_price')}
                                                />
                                            ) : (<span className="font-mono">{(item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : 'S/') + ' ' + item.unit_price}</span>)}
                                        </td>

                                        {/* COLUMNA TOTAL LÍNEA (Calculado) */}
                                        <td className="px-4 py-3 text-right w-28 font-mono font-medium text-emerald-600">
                                            {editingId === item.id ? 
                                                ((item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : 'S/') + ' ' + (parseFloat(editForm.quantity || 0) * parseFloat(editForm.unit_price || 0)).toFixed(2)) : 
                                                ((item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : 'S/') + ' ' + item.total_price)
                                            }
                                        </td>
                                        
                                        {/* COLUMNA TOTAL FACTURA */}
                                        <td className="px-4 py-3 text-right w-32 font-mono font-bold text-emerald-700">{(item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : 'S/') + ' ' + item.total_factura}</td>
                                        
                                        {/* COLUMNA IGV */}
                                        <td className="px-4 py-3 text-right w-24 font-mono">{(item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : 'S/') + ' ' + (item.igv_amount ?? 0)}</td>
                                        
                                        {/* COLUMNA MONEDA */}
                                        <td className="px-4 py-3 text-center">{item.currency || 'PEN'}</td>

                                        {/* COLUMNA ACCIONES */}
                                        <td className="px-4 py-3 text-center">
                                            {editingId === item.id ? (
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={saveEdit} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Guardar"><CheckIcon className="w-4 h-4"/></button>
                                                    <button onClick={cancelEditing} className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Cancelar"><XMarkIcon className="w-4 h-4"/></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => startEditing(item)} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Editar fila">
                                                    <PencilSquareIcon className="w-4 h-4"/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;