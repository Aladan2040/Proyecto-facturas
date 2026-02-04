// src/api.js
import axios from 'axios';

// Creamos una instancia de Axios apuntando a tu backend
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000', // La URL donde corre tu FastAPI
});

export default api;