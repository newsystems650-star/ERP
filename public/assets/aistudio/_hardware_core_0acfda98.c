#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <libusb-1.0/libusb.h>


// Definición de constantes de Hardware de Bajo Nivel
#define MTK_VID 0x0e8d
#define MTK_PID 0x0003  // Modo BROM (Boot ROM)
#define EP_OUT 0x01     // Endpoint de salida para inyección en RAM
#define EP_IN 0x81      // Endpoint de entrada para lectura de RAM
#define TIMEOUT_MS 1000 // Watchdog de hardware a nivel de milisegundos


int main() {
    libusb_context *ctx = NULL;
    libusb_device_handle *dev_handle = NULL;
    int r;
    int transferred;


    // Búferes crudos de bytes (Handshake de bajo nivel para inicializar la RAM del chip)
    unsigned char handshake_sequence[] = {0xa1, 0x02, 0x00, 0x00, 0x4a, 0x5a}; 
    unsigned char response_buffer[64];


    // Initialize libusb nativo de Unix
    r = libusb_init(&ctx);
    if (r < 0) {
        fprintf(stderr, "{\"status\":\"failed\",\"error\":\"Error de inicialización de libusb\"}\n");
        return 1;
    }


    // Abrir comunicación directa con el controlador USB físico
    dev_handle = libusb_open_device_with_vid_pid(ctx, MTK_VID, MTK_PID);
    if (dev_handle == NULL) {
        fprintf(stderr, "{\"status\":\"failed\",\"error\":\"Dispositivo en modo BROM no detectado\"}\n");
        libusb_exit(ctx);
        return 1;
    }


    // Reclamar control exclusivo de la interfaz (Estructura interna de Unix)
    if (libusb_kernel_driver_active(dev_handle, 0) == 1) {
        libusb_detach_kernel_driver(dev_handle, 0);
    }
    libusb_claim_interface(dev_handle, 0);


    // INYECCIÓN DE BÚFER EN LA RAM: Escritura masiva síncrona (Bulk Transfer)
    r = libusb_bulk_transfer(dev_handle, EP_OUT, handshake_sequence, sizeof(handshake_sequence), &transferred, TIMEOUT_MS);
    if (r != 0) {
        fprintf(stderr, "{\"status\":\"failed\",\"error\":\"Fallo al inyectar búfer de handshake en la RAM\"}\n");
        libusb_close(dev_handle);
        libusb_exit(ctx);
        return 1;
    }


    // LECTURA DE RESPUESTA DESDE LA RAM DEL PROCESADOR
    memset(response_buffer, 0, sizeof(response_buffer));
    r = libusb_bulk_transfer(dev_handle, EP_IN, response_buffer, sizeof(response_buffer), &transferred, TIMEOUT_MS);
    
    if (r == 0 && transferred > 0) {
        // Retornar en JSON estructurado para el orquestador
        printf("{\"status\":\"success\",\"bytes_read\":%d,\"data_hex\":\"%02x%02x\"}\n", 
               transferred, response_buffer[0], response_buffer[1]);
    } else {
        fprintf(stderr, "{\"status\":\"failed\",\"error\":\"El procesador no respondió al handshake\"}\n");
    }


    // Liberar recursos de hardware
    libusb_release_interface(dev_handle, 0);
    libusb_close(dev_handle);
    libusb_exit(ctx);
    return 0;
}