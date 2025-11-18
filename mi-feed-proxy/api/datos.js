// api/datos.js
const fetch = require('node-fetch');

const PARADA_ID = 151;

// TUS PARADAS FIJAS (Copiadas de tu log)
const PARADAS_STATIC = [];
const URLS = {
    llegadas: `https://itranvias.com/queryitr_v3.php?&func=0&dato=${PARADA_ID}`,
    clima: 'https://api.open-meteo.com/v1/forecast?latitude=43.3713&longitude=-8.396&hourly=precipitation_probability&timezone=Europe%2FBerlin',
    noticias: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.elpais.com%2Fmrss-s%2Fpages%2Fep%2Fsite%2Felpais.com%2Fsection%2Fultimas-noticias%2Fportada'
};

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

        // Peticiones básicas (Ligeras: 1 petición a itranvias)
        const promesas = [
            fetch(URLS.llegadas),
            fetch(URLS.clima),
            fetch(URLS.noticias)
        ];

        // Si piden horarios completos, añadimos las peticiones pesadas
        if (modo === 'completo') {
            promesas.push(fetch(`https://itranvias.com/queryitr_v3.php?&func=8&dato=500&fecha=${fechaHoy}`)); // L5
            promesas.push(fetch(`https://itranvias.com/queryitr_v3.php?&func=8&dato=300&fecha=${fechaHoy}`)); // L3
            promesas.push(fetch(`https://itranvias.com/queryitr_v3.php?&func=8&dato=301&fecha=${fechaHoy}`)); // L3A
        }

        const respuestas = await Promise.all(promesas);

        const dataLlegadas = await respuestas[0].json();
        const dataClima = await respuestas[1].json();
        const dataNoticias = await respuestas[2].json();
        
        let dataHorarios = null;

        if (modo === 'completo') {
            dataHorarios = {
                linea5: await respuestas[3].json(),
                linea3: await respuestas[4].json(),
                linea3A: await respuestas[5].json()
            };
        }

        // NOTA: Ahora enviamos las paradas limpias directamente (sin necesidad de regex en el front)
        const datosFinales = {
            paradas: PARADAS_STATIC, 
            llegadas: dataLlegadas,
            clima: dataClima,
            noticias: dataNoticias,
            horarios: dataHorarios
        };

        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(datosFinales);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
