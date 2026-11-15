const http = require('http');
const { interactuarConRamCelular } = require('./low_level_core');


// Función ultrarrápida para consultar a la IA interna y gratuita
async function consultarIALocal(errorLog, modeloCelular) {
  const prompt = `Analiza este error de flasheo a bajo nivel para el modelo ${modeloCelular}. Sé breve (1 frase): "${errorLog}"`;
  
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-r1:1.5b', // Tu IA local y gratis
        prompt: prompt,
        stream: false // Para recibir la respuesta completa de golpe
      })
    });
    
    const data = await response.json();
    return data.response.replace(/<think>[\s\S]*?<\/think>/, '').trim(); // Limpiar pensamientos del modelo si usa R1
  } catch (e) {
    return "Error del motor local de IA. Asegúrate de que Ollama está corriendo.";
  }
}


// Servidor principal y Watchdog síncrono
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');


  if (req.url === '/api/ejecutar-accion' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      const { modeloCelular } = JSON.parse(body);


      // --- CONFIGURACIÓN DEL WATCHDOG NATIVO ---
      let operacionCompletada = false;
      const timeoutWatchdog = setTimeout(() => {
        if (!operacionCompletada) {
          console.error("WATCHDOG CRÍTICO: El bus USB se congeló.");
          res.writeHead(504);
          res.end(JSON.stringify({ status: "TIMEOUT", error: "El teléfono no respondió a nivel de hardware." }));
        }
      }, 5000); // 5 segundos máximo para comandos de memoria RAM


      try {
        // Ejecución a bajo nivel (Milisegundos)
        const resultadoHardware = await interactuarConRamCelular();
        operacionCompletada = true;
        clearTimeout(timeoutWatchdog);


        res.writeHead(200);
        res.end(JSON.stringify({ status: "SUCCESS", data: resultadoHardware }));
        
      } catch (err) {
        operacionCompletada = true;
        clearTimeout(timeoutWatchdog);


        // Si falla el hardware, llamamos a la IA local (Costo $0.00)
        console.log("Invocando diagnóstico de IA local...");
        const diagnosticoIA = await consultarIALocal(err.message || err, modeloCelular);


        res.writeHead(500);
        res.end(JSON.stringify({ 
          status: "FAILED", 
          error: err.message || err,
          diagnostico_ia: diagnosticoIA 
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});


server.listen(5000, () => console.log("Núcleo de bajo nivel e IA local escuchando en el puerto 5000"));