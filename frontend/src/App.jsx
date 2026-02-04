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

    const exportToExcel = () => {
        const rows = [];
        invoices.forEach(inv => {
            if (inv.invoice_items && inv.invoice_items.length > 0) {
                inv.invoice_items.forEach(item => {
                    rows.push({
                        Fecha: inv.issue_date,
                        RUC: inv.provider_ruc,
                        Proveedor: inv.provider_name,
                        Descripcion: item.description,
                        Cantidad: item.quantity,
                        Precio_Unit: item.unit_price,
                        Total_Linea: item.total_price,
                    });
                });
            } else {
                rows.push({
                    Fecha: inv.issue_date,
                    Proveedor: inv.provider_name,
                    Total_Factura: inv.total_amount
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

    // Aplanamos datos para la vista de productos
    const allProducts = invoices.flatMap(inv =>
        inv.invoice_items.map(item => ({
            ...item,
            provider_name: inv.provider_name,
            issue_date: inv.issue_date,
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

                {/* Carga */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-full shadow-sm">
                            <CloudArrowUpIcon className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-indigo-900">Cargar Nueva Factura</h3>
                            <p className="text-xs text-indigo-600">Sube tu PDF para procesarlo</p>
                        </div>
                    </div>
                    <label className={`cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {uploading ? 'Procesando...' : 'Seleccionar PDF'}
                        <input type="file" className="hidden" accept="application/pdf" onChange={handleFileChange} disabled={uploading}/>
                    </label>
                </div>

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
                        {/* VISTA FACTURAS (Solo lectura) */}
                        {viewMode === 'invoices' && (
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3">Fecha</th>
                                    <th className="px-6 py-3">Proveedor</th>
                                    <th className="px-6 py-3">RUC</th>
                                    <th className="px-6 py-3 text-right">Total</th>
                                    <th className="px-6 py-3 text-center"></th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                {invoices.map((inv) => (
                                    <>
                                        <tr key={inv.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">{inv.issue_date}</td>
                                            <td className="px-6 py-4 font-medium text-slate-900">{inv.provider_name}</td>
                                            <td className="px-6 py-4">{inv.provider_ruc}</td>
                                            <td className="px-6 py-4 text-right font-bold text-emerald-600">S/ {inv.total_amount}</td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => setExpandedRow(expandedRow === inv.id ? null : inv.id)} className="text-slate-400 hover:text-indigo-600">
                                                    {expandedRow === inv.id ? <ChevronUpIcon className="w-5 h-5"/> : <ChevronDownIcon className="w-5 h-5"/>}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedRow === inv.id && (
                                            <tr className="bg-slate-50">
                                                <td colSpan="5" className="px-6 py-4">
                                                    {/* Subtabla simple de items */}
                                                    <table className="w-full text-xs bg-white rounded border border-slate-200">
                                                        <thead className="bg-slate-100">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left">Producto</th>
                                                            <th className="px-4 py-2 text-right">Cant.</th>
                                                            <th className="px-4 py-2 text-right">Precio</th>
                                                        </tr>
                                                        </thead>
                                                        <tbody>
                                                        {inv.invoice_items.map(item => (
                                                            <tr key={item.id}><td className="px-4 py-1">{item.description}</td><td className="px-4 py-1 text-right">{item.quantity}</td><td className="px-4 py-1 text-right">{item.unit_price}</td></tr>
                                                        ))}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                                </tbody>
                            </table>
                        )}

                        {/* VISTA PRODUCTOS (EDITABLE) */}
                        {viewMode === 'products' && (
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3">Descripción</th>
                                    <th className="px-6 py-3 text-right">Cant.</th>
                                    <th className="px-6 py-3 text-right">P. Unit</th>
                                    <th className="px-6 py-3 text-right">Total</th>
                                    <th className="px-6 py-3 text-center">Acción</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                {allProducts.map((item) => (
                                    <tr key={item.id} className={editingId === item.id ? "bg-indigo-50" : "hover:bg-slate-50"}>

                                        {/* COLUMNA DESCRIPCIÓN */}
                                        <td className="px-6 py-3">
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
                                            <div className="text-xs text-slate-400 mt-1">{item.provider_name}</div>
                                        </td>

                                        {/* COLUMNA CANTIDAD */}
                                        <td className="px-6 py-3 text-right">
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
                                        <td className="px-6 py-3 text-right">
                                            {editingId === item.id ? (
                                                <input
                                                    type="number" step="0.01"
                                                    className="w-24 border-gray-300 rounded text-sm px-2 py-1 text-right"
                                                    value={editForm.unit_price}
                                                    onChange={(e) => handleEditChange(e, 'unit_price')}
                                                />
                                            ) : `S/ ${item.unit_price}`}
                                        </td>

                                        {/* COLUMNA TOTAL (Calculado) */}
                                        <td className="px-6 py-3 text-right font-bold text-emerald-600">
                                            S/ {editingId === item.id ? (parseFloat(editForm.quantity || 0) * parseFloat(editForm.unit_price || 0)).toFixed(2) : item.total_price}
                                        </td>

                                        {/* COLUMNA ACCIONES */}
                                        <td className="px-6 py-3 text-center">
                                            {editingId === item.id ? (
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={saveEdit} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Guardar"><CheckIcon className="w-5 h-5"/></button>
                                                    <button onClick={cancelEditing} className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Cancelar"><XMarkIcon className="w-5 h-5"/></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => startEditing(item)} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Editar fila">
                                                    <PencilSquareIcon className="w-5 h-5"/>
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