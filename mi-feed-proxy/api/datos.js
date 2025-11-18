const fetch = require('node-fetch');

// 1. CARGA DE PARADAS (Intenta leer el archivo separado)
let PARADAS_STATIC = [];
try {
    // Asegúrate de haber creado el archivo 'api/paradas.json' con la lista que te pasé
    PARADAS_STATIC = require('./paradas.json');
} catch (e) {
    console.log("Aviso: No se encontró paradas.json. La web cargará pero sin nombres de paradas.");
}

const PARADA_ID = 151;

const URLS = {
    // Solo pedimos Bus y Clima. Hemos eliminado Noticias.
    llegadas: `https://itranvias.com/queryitr_v3.php?&func=0&dato=${PARADA_ID}`,
    clima: 'https://api.open-meteo.com/v1/forecast?latitude=43.3713&longitude=-8.396&hourly=precipitation_probability&timezone=Europe%2FBerlin'
};

// --- FUNCIÓN SEGURA (Anti-Caídas) ---
// Si la API de buses o clima falla, devuelve {} en lugar de romper la web
async function safeFetch(url, fallbackValue = {}) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) return fallbackValue;
        return await resp.json();
    } catch (e) {
        console.error(`Error recuperando ${url}:`, e.message);
        return fallbackValue;
    }
}

function obtenerFechaActual() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
}

module.exports = async (req, res) => {
    try {
        const modo = req.query.modo || 'vivo';
        const fechaHoy = obtenerFechaActual();

        // 1. PETICIONES BÁSICAS (Paralelo)
        const promesasBasicas = [
            safeFetch(URLS.llegadas, {}),
            safeFetch(URLS.clima, {})
        ];

        // 2. PETICIONES HORARIOS (Solo si modo='completo')
        let promesasHorarios = [];
        if (modo === 'completo') {
            promesasHorarios = [
                safeFetch(`https://itranvias.com/queryitr_v3.php?&func=8&dato=500&fecha=${fechaHoy}`, {}),
                safeFetch(`https://itranvias.com/queryitr_v3.php?&func=8&dato=300&fecha=${fechaHoy}`, {}),
                safeFetch(`https://itranvias.com/queryitr_v3.php?&func=8&dato=301&fecha=${fechaHoy}`, {})
            ];
        }

        // Esperamos resultados
        const [llegadas, clima] = await Promise.all(promesasBasicas);
        
        let horarios = null;
        if (modo === 'completo') {
            const [h5, h3, h3A] = await Promise.all(promesasHorarios);
            horarios = { linea5: h5, linea3: h3, linea3A: h3A };
        }

        // Construimos el JSON final (SIN la clave 'noticias')
        const datosFinales = {
            paradas: PARADAS_STATIC,
            llegadas: llegadas,
            clima: clima,
            horarios: horarios
        };

        // Cabeceras para evitar problemas de CORS y caché
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        res.status(200).json(datosFinales);

    } catch (error) {
        console.error("Error crítico en servidor:", error);
        res.status(500).json({ error: error.message });
    }
};
