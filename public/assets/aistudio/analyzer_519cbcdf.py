import sys
import json
import pandas as pd


def analizar_log_hardware(nuevo_log_json, historico_csv_path):
    """
    Analiza instantáneamente el resultado de una operación de bajo nivel
    usando Pandas para correlacionar fallas sin usar modelos LLM pesados.
    """
    try:
        # 1. Cargar el error actual y el histórico de fallas de la base de datos
        nuevo_error = json.loads(nuevo_log_json)
        df_historico = pd.read_csv(historico_csv_path)
        
        # 2. Filtrar por el mismo código de error de hardware para ver la probabilidad de éxito
        errores_similares = df_historico[df_historico['error_msg'] == nuevo_error['error']]
        
        if errores_similares.empty:
            diagnostico = "Error crítico nuevo detectado. Posible hardware brickeado físicamente."
        else:
            # Calcular matemáticamente qué solución funcionó más veces para este error exacto
            solucion_mas_efectiva = errores_similares['solucion_exitosa'].mode()[0]
            tasa_exito = (errores_similares['estado'] == 'SOLUCIONADO').mean() * 100
            
            diagnostico = f"Patrón detectado. Solución recomendada: {solucion_mas_efectiva} (Tasa de éxito: {tasa_exito:.1f}%)"
            
        print(json.dumps({"status": "analyzed", "diagnosis": diagnostico}))
        
    except Exception as e:
        print(json.dumps({"status": "failed", "error": str(e)}))


if __name__ == "__main__":
    # Recibe el log de hardware por argumento de consola de Unix
    if len(sys.argv) > 1:
        analizar_log_hardware(sys.argv[1], 'historico_fallas.csv')