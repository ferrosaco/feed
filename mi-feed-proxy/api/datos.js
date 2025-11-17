// Importamos 'node-fetch' que instalamos en package.json
const fetch = require('node-fetch');

// Las URLs de todas tus fuentes
const PARADA_ID = 151;
const URLS = {
    paradas: 'https://itranvias.com/queryitr_v3.php?dato=20160101T000000_es_0_20160101T000000&func=7',
    llegadas: `https://itranvias.com/queryitr_v3.php?&func=0&dato=${PARADA_ID}`,
    horarios5: 'https://itranvias.com/queryitr_v3.php?&func=8&dato=500&fecha=' + obtenerFechaActual(),
    horarios3: 'https://itranvias.com/queryitr_v3.php?&func=8&dato=300&fecha=' + obtenerFechaActual(),
    horarios3A: 'https://itranvias.com/queryitr_v3.php?&func=8&dato=301&fecha=' + obtenerFechaActual(),
    clima: 'https://api.open-meteo.com/v1/forecast?latitude=43.3713&longitude=-8.396&hourly=precipitation_probability&timezone=Europe%2FBerlin',
    noticias: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.elpais.com%2Fmrss-s%2Fpages%2Fep%2Fsite%2Felpais.com%2Fsection%2Fultimas-noticias%2Fportada'
};

// Función de ayuda para la fecha
function obtenerFechaActual() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
}

// Esta es la función principal que se ejecuta en Vercel
module.exports = async (req, res) => {
    try {
        // Hacemos todas las peticiones en paralelo para que sea rápido
        const [
            respParadas,
            respLlegadas,
            respHorarios5,
            respHorarios3,
            respHorarios3A,
            respClima,
            respNoticias
        ] = await Promise.all([
            fetch(URLS.paradas),
            fetch(URLS.llegadas),
            fetch(URLS.horarios5),
            fetch(URLS.horarios3),
            fetch(URLS.horarios3A),
            fetch(URLS.clima),
            fetch(URLS.noticias)
        ]);

        // Convertimos las respuestas (texto o json)
        const datos = {
            paradas: await respParadas.text(), // itranvias a veces envía texto malformado
            llegadas: await respLlegadas.json(),
            horarios: {
                linea5: await respHorarios5.json(),
                linea3: await respHorarios3.json(),
                linea3A: await respHorarios3A.json()
            },
            clima: await respClima.json(),
            noticias: await respNoticias.json()
        };

        // --- ¡IMPORTANTE! ---
        // 1. Política de Caché:
        //    Guardamos en caché el resultado por 60 segundos (s-maxage=60).
        //    Esto soluciona tu problema de "límite de peticiones".
        //    Aunque refresques 10 veces, Vercel solo llamará a itranvias 1 vez por minuto.
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

        // 2. Política de CORS:
        //    Permitimos que cualquier dominio (incluido tu github.io) llame a esta API.
        //    Esto soluciona tu problema de "CORS".
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');

        // Enviamos todos los datos juntos al iPad
        res.status(200).json(datos);

    } catch (error) {
        // Si algo falla, enviamos un error
        res.status(500).json({ error: error.message });
    }
};
