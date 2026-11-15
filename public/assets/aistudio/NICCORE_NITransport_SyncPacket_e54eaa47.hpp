// ==============================================================================
// NICCORE / NITransport - Protocolo Binario de Empaquetado Offline (sync_packet.hpp)
// Arquitectura: Zero-Copy, Serialización Binaria Directa, Big-Endian / Network Order
// Autor: Oscar Alonso Mateo Calvo (newsystems) | Sello: NICC-NITRANSPORT-20260827
// ==============================================================================


#ifndef NICCORE_TRANSPORT_SYNC_PACKET_HPP
#define NICCORE_TRANSPORT_SYNC_PACKET_HPP


#include <cstdint>
#include <cstring>
#include <array>
#include <vector>
#include <string>
#include <openssl/sha.h>


namespace niccore::transport {


#pragma pack(push, 1)
struct SyncPacketHeader {
    uint32_t magic_header;      // 0x4E494354 ("NICT")
    uint8_t  protocol_version;  // 0x01
    uint8_t  event_type;        // 1=CREATED, 2=ASSIGNED, 3=DEPARTURE, 4=ARRIVAL, 5=DELIVERED, 6=INCIDENT
    uint16_t payload_len;       // Longitud del cuerpo (GeoPayload + notas)
    uint64_t client_timestamp;  // Microsegundos epoch UTC
    uint8_t  delivery_uuid[16]; // UUID v4 binario de la entrega (128 bits)
    uint32_t sequence_number;   // Contador incremental anti-duplicados (idempotencia)
};


struct GeoPayload {
    int32_t  lat_e7;            // Latitud * 10,000,000 (precisión ~1.1 cm)
    int32_t  lng_e7;            // Longitud * 10,000,000
    uint32_t speed_mps_e2;      // Velocidad m/s * 100
    uint16_t heading_deg_e1;    // Dirección grados * 10 (0 - 3600)
};
#pragma pack(pop)


class SyncPacketEngine {
public:
    static constexpr uint32_t MAGIC = 0x4E494354; // 'N','I','C','T'


    // Empaqueta y sella criptográficamente un evento offline
    static std::vector<uint8_t> PackEvent(
        uint8_t event_type,
        uint32_t seq_num,
        uint64_t timestamp_us,
        const std::array<uint8_t, 16>& uuid,
        const GeoPayload& geo,
        const std::string& note = ""
    ) {
        SyncPacketHeader header{};
        header.magic_header = MAGIC;
        header.protocol_version = 1;
        header.event_type = event_type;
        header.payload_len = static_cast<uint16_t>(sizeof(GeoPayload) + note.size());
        header.client_timestamp = timestamp_us;
        std::memcpy(header.delivery_uuid, uuid.data(), 16);
        header.sequence_number = seq_num;


        std::vector<uint8_t> packet;
        size_t raw_data_size = sizeof(SyncPacketHeader) + header.payload_len;
        packet.resize(raw_data_size + SHA256_DIGEST_LENGTH);


        uint8_t* ptr = packet.data();
        std::memcpy(ptr, &header, sizeof(SyncPacketHeader));
        ptr += sizeof(SyncPacketHeader);


        std::memcpy(ptr, &geo, sizeof(GeoPayload));
        ptr += sizeof(GeoPayload);


        if (!note.empty()) {
            std::memcpy(ptr, note.data(), note.size());
            ptr += note.size();
        }


        // Calcula checksum SHA-256 sobre header + payload
        SHA256(packet.data(), raw_data_size, ptr);


        return packet;
    }


    // Valida integridad y extrae el paquete en servidor/orquestador
    static bool VerifyAndUnpack(
        const uint8_t* buffer,
        size_t total_size,
        SyncPacketHeader& out_header,
        GeoPayload& out_geo,
        std::string& out_note,
        std::array<uint8_t, 32>& out_sha256
    ) {
        if (total_size < sizeof(SyncPacketHeader) + sizeof(GeoPayload) + SHA256_DIGEST_LENGTH) {
            return false;
        }


        const SyncPacketHeader* hdr = reinterpret_cast<const SyncPacketHeader*>(buffer);
        if (hdr->magic_header != MAGIC || hdr->protocol_version != 1) {
            return false;
        }


        size_t raw_data_size = sizeof(SyncPacketHeader) + hdr->payload_len;
        if (total_size != raw_data_size + SHA256_DIGEST_LENGTH) {
            return false;
        }


        // Validación SHA-256
        uint8_t computed_hash[SHA256_DIGEST_LENGTH];
        SHA256(buffer, raw_data_size, computed_hash);


        const uint8_t* expected_hash = buffer + raw_data_size;
        if (std::memcmp(computed_hash, expected_hash, SHA256_DIGEST_LENGTH) != 0) {
            return false; // Integridad comprometida
        }


        out_header = *hdr;
        const uint8_t* payload_ptr = buffer + sizeof(SyncPacketHeader);
        out_geo = *reinterpret_cast<const GeoPayload*>(payload_ptr);
        payload_ptr += sizeof(GeoPayload);


        size_t note_len = hdr->payload_len - sizeof(GeoPayload);
        if (note_len > 0) {
            out_note.assign(reinterpret_cast<const char*>(payload_ptr), note_len);
        } else {
            out_note.clear();
        }


        std::memcpy(out_sha256.data(), computed_hash, SHA256_DIGEST_LENGTH);
        return true;
    }
};


} // namespace niccore::transport


#endif // NICCORE_TRANSPORT_SYNC_PACKET_HPP