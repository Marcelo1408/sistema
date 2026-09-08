'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const axios = require('axios');

// ============================================================
// CONFIGURAÇÕES
// ============================================================
const DISTANCIA_MAXIMA_ENTREGA_KM = Number(process.env.ENTREGA_KM_MAXIMO || 15);
const LOJA_LAT = Number(process.env.LOJA_LAT);
const LOJA_LNG = Number(process.env.LOJA_LNG);

// ============================================================
// TABELA DE TAXAS E TEMPO
// ============================================================
const TABELA_ENTREGA = [
    { km: 0.5, tempo: 38, taxa: 4.99 },
    { km: 1.0, tempo: 40, taxa: 5.99 },
    { km: 1.5, tempo: 42, taxa: 5.99 },
    { km: 2.0, tempo: 43, taxa: 6.99 },
    { km: 2.5, tempo: 44, taxa: 7.99 },
    { km: 3.0, tempo: 44, taxa: 12.99 },
    { km: 3.5, tempo: 43, taxa: 12.99 },
    { km: 4.0, tempo: 43, taxa: 13.99 },
    { km: 4.5, tempo: 44, taxa: 13.99 },
    { km: 5.0, tempo: 44, taxa: 14.99 },
    { km: 5.5, tempo: 45, taxa: 14.99 },
    { km: 6.0, tempo: 46, taxa: 15.99 },
    { km: 6.5, tempo: 47, taxa: 15.99 },
    { km: 7.0, tempo: 49, taxa: 16.99 },
    { km: 7.5, tempo: 50, taxa: 16.99 },
    { km: 8.0, tempo: 52, taxa: 17.99 },
    { km: 8.5, tempo: 54, taxa: 17.99 },
    { km: 9.0, tempo: 55, taxa: 18.99 },
    { km: 9.5, tempo: 56, taxa: 18.99 },
    { km: 10.0, tempo: 58, taxa: 20.99 },
    { km: 10.5, tempo: 59, taxa: 20.99 },
    { km: 11.0, tempo: 60, taxa: 22.99 },
    { km: 11.5, tempo: 62, taxa: 22.99 },
    { km: 12.0, tempo: 63, taxa: 23.99 },
    { km: 12.5, tempo: 65, taxa: 23.99 },
    { km: 13.0, tempo: 66, taxa: 24.99 },
    { km: 13.5, tempo: 67, taxa: 24.99 },
    { km: 14.0, tempo: 68, taxa: 25.99 },
    { km: 14.5, tempo: 69, taxa: 26.99 },
    { km: 15.0, tempo: 70, taxa: 29.99 }
];

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
function valorValido(v) { return v !== undefined && v !== null && String(v).trim() !== ''; }

function normalizarCoordenada(v) {
    if (!valorValido(v)) return null;
    const texto = String(v).trim().replace(',', '.').replace(/[^0-9.\-]/g, '');
    if (!texto) return null;
    const num = Number(texto);
    return Number.isFinite(num) ? num : null;
}

function coordenadasValidas(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function dinheiro(valor) { return Number(valor || 0).toFixed(2); }

function limparCampo(v) {
    if (!valorValido(v)) return '';
    return String(v).replace(/\s+/g, ' ').trim();
}

function montarEnderecoCompleto(dados = {}) {
    if (valorValido(dados.endereco_completo)) return limparCampo(dados.endereco_completo);
    const endereco = limparCampo(dados.endereco);
    const numero = limparCampo(dados.numero);
    const bairro = limparCampo(dados.bairro);
    const cidade = limparCampo(dados.cidade);
    const uf = limparCampo(dados.uf || 'SP').toUpperCase();
    const cep = String(dados.cep || '').replace(/\D/g, '');
    const partes = [];
    if (endereco && numero) partes.push(`${endereco}, ${numero}`);
    else if (endereco) partes.push(endereco);
    if (bairro) partes.push(bairro);
    if (cidade && uf) partes.push(`${cidade}/${uf}`);
    else if (cidade) partes.push(cidade);
    if (cep) partes.push(cep);
    return partes.join(' - ');
}

function obterTaxaETempoPorDistancia(km) {
    let distancia = Number(km);
    if (!Number.isFinite(distancia) || distancia < 0) distancia = 0.5;
    if (distancia < 0.5) distancia = 0.5;
    let kmArredondado = Math.ceil(distancia * 2) / 2;
    if (kmArredondado > 15) kmArredondado = 15;
    let entrada = TABELA_ENTREGA.find(item => item.km === kmArredondado);
    if (!entrada) entrada = TABELA_ENTREGA[TABELA_ENTREGA.length - 1];
    return { km_arredondado: entrada.km, taxa: entrada.taxa, tempo: entrada.tempo };
}

// ============================================================
// GEOCÓDIGO DO CLIENTE - PRIORIZA ENDEREÇO COMPLETO VIA NOMINATIM
// ============================================================
async function obterCoordenadasCliente(enderecoCompleto, dados = {}) {
    console.log(`🔍 Geocodificando: "${enderecoCompleto}"`);

    // 1. Tenta com endereço completo via Nominatim (mais preciso)
    if (enderecoCompleto) {
        try {
            // Monta query com endereço completo + Brasil
            const query = encodeURIComponent(enderecoCompleto + ', Brasil');
            const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br&addressdetails=1`;
            console.log(`🔍 Nominatim URL: ${url}`);
            const resp = await axios.get(url, { headers: { 'User-Agent': 'EspetariaAPI/1.0' }, timeout: 15000 });
            if (resp.status === 200 && resp.data && resp.data.length > 0) {
                const item = resp.data[0];
                const lat = normalizarCoordenada(item.lat);
                const lng = normalizarCoordenada(item.lon);
                if (coordenadasValidas(lat, lng)) {
                    console.log(`✅ Nominatim (endereço): lat=${lat}, lng=${lng}`);
                    return { lat, lng, origem: 'nominatim_endereco' };
                }
            }
        } catch (e) {
            console.log(`⚠️ Nominatim falhou: ${e.message}`);
        }
    }

    // 2. Fallback: CEP via BrasilAPI
    const cep = String(dados?.cep || '').replace(/\D/g, '');
    if (cep && cep.length === 8) {
        try {
            const resp = await axios.get(`https://brasilapi.com.br/api/cep/v2/${cep}`, { timeout: 5000 });
            if (resp.status === 200 && resp.data) {
                const data = resp.data;
                let lat = normalizarCoordenada(data?.location?.coordinates?.latitude);
                let lng = normalizarCoordenada(data?.location?.coordinates?.longitude);
                if (coordenadasValidas(lat, lng)) {
                    console.log(`✅ BrasilAPI (CEP): lat=${lat}, lng=${lng}`);
                    return { lat, lng, origem: 'brasilapi' };
                }
            }
        } catch (e) {
            console.log(`⚠️ BrasilAPI falhou: ${e.message}`);
        }
    }

    console.log('❌ Todas as fontes falharam, sem coordenadas');
    return { lat: null, lng: null };
}

// ============================================================
// DISTÂNCIA (OSRM ou LINHA RETA)
// ============================================================
async function calcularDistanciaReal(lojaLat, lojaLng, clienteLat, clienteLng) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lojaLng},${lojaLat};${clienteLng},${clienteLat}?overview=false`;
        console.log(`🔍 OSRM URL: ${url}`);
        const resp = await axios.get(url, { timeout: 10000 });
        if (resp.status === 200 && resp.data && resp.data.routes && resp.data.routes.length > 0) {
            const km = resp.data.routes[0].distance / 1000;
            console.log(`📏 OSRM: ${km.toFixed(2)} km`);
            return { km, origem: 'osrm' };
        }
        return null;
    } catch (erro) {
        console.log(`⚠️ OSRM falhou: ${erro.message}`);
        return null;
    }
}

function calcularLinhaReta(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const km = R * c;
    console.log(`📏 Linha reta: ${km.toFixed(2)} km`);
    return km;
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================
async function calcularEntrega(enderecoCompleto, conversa = {}) {
    console.log('========================================');
    console.log('🚀 INICIANDO CÁLCULO DE ENTREGA');

    // Coordenadas da loja (fixas do .env)
    const lojaLat = Number(process.env.LOJA_LAT);
    const lojaLng = Number(process.env.LOJA_LNG);
    if (!coordenadasValidas(lojaLat, lojaLng)) {
        console.log('❌ Coordenadas da loja inválidas no .env');
        const fallback = obterTaxaETempoPorDistancia(3);
        return {
            km: 3,
            km_arredondado: fallback.km_arredondado,
            taxa: fallback.taxa,
            taxa_formatada: dinheiro(fallback.taxa),
            tempo: fallback.tempo,
            tempo_formatado: `${fallback.tempo} min`,
            calculada: true,
            bloqueada: false,
            estimada: true,
            origem: 'fallback_loja',
            aviso: 'Coordenadas da loja não configuradas'
        };
    }
    console.log(`📍 LOJA: lat=${lojaLat}, lng=${lojaLng}`);

    // Coordenadas do cliente
    const coordsCliente = await obterCoordenadasCliente(enderecoCompleto, conversa);
    if (!coordenadasValidas(coordsCliente.lat, coordsCliente.lng)) {
        console.log('❌ Cliente sem coordenadas, usando fallback 3km');
        const fallback = obterTaxaETempoPorDistancia(3);
        return {
            km: 3,
            km_arredondado: fallback.km_arredondado,
            taxa: fallback.taxa,
            taxa_formatada: dinheiro(fallback.taxa),
            tempo: fallback.tempo,
            tempo_formatado: `${fallback.tempo} min`,
            calculada: true,
            bloqueada: false,
            estimada: true,
            origem: 'fallback_cliente',
            aviso: 'Coordenadas do cliente não encontradas'
        };
    }
    console.log(`📍 CLIENTE: lat=${coordsCliente.lat}, lng=${coordsCliente.lng}`);

    // Calcular distância
    let distancia = await calcularDistanciaReal(lojaLat, lojaLng, coordsCliente.lat, coordsCliente.lng);
    let kmFinal, origemFinal, estimada = false, aviso = '';
    if (distancia && distancia.km > 0) {
        kmFinal = distancia.km;
        origemFinal = distancia.origem;
        estimada = false;
    } else {
        const kmLinhaReta = calcularLinhaReta(lojaLat, lojaLng, coordsCliente.lat, coordsCliente.lng);
        kmFinal = kmLinhaReta * 1.25;
        origemFinal = 'linha_reta_estimado';
        estimada = true;
        aviso = 'OSRM indisponível, distância estimada por linha reta com fator 1.25';
        console.log(`📏 Estimado (linha reta x 1.25): ${kmFinal.toFixed(2)} km`);
    }

    // Verificar limite
    if (kmFinal > DISTANCIA_MAXIMA_ENTREGA_KM) {
        return {
            km: kmFinal,
            km_arredondado: null,
            taxa: 0,
            taxa_formatada: '0.00',
            tempo: 0,
            tempo_formatado: '0 min',
            calculada: true,
            bloqueada: true,
            estimada: estimada,
            origem: origemFinal,
            motivo: 'fora_limite',
            mensagem: `Desculpe, esse endereço está fora da nossa área de entrega. Distância aproximada: ${kmFinal.toFixed(1).replace('.', ',')} km.`,
            aviso: aviso
        };
    }

    // Obter taxa e tempo
    const { km_arredondado, taxa, tempo } = obterTaxaETempoPorDistancia(kmFinal);

    console.log('========================================');
    console.log(`✅ RESULTADO FINAL:`);
    console.log(`   Distância real: ${kmFinal.toFixed(2)} km`);
    console.log(`   Arredondado: ${km_arredondado} km`);
    console.log(`   Taxa: R$ ${taxa.toFixed(2)}`);
    console.log(`   Tempo: ${tempo} min`);
    console.log(`   Origem: ${origemFinal}`);
    console.log('========================================');

    return {
        km: kmFinal,
        km_arredondado: km_arredondado,
        taxa: taxa,
        taxa_formatada: dinheiro(taxa),
        tempo: tempo,
        tempo_formatado: `${tempo} min`,
        calculada: true,
        bloqueada: false,
        estimada: estimada,
        origem: origemFinal,
        mensagem: 'Entrega calculada com sucesso',
        aviso: aviso || null
    };
}

// ============================================================
// ROTAS
// ============================================================
router.post('/', async (req, res) => {
    try {
        const dados = req.body || {};
        const enderecoCompleto = montarEnderecoCompleto(dados);
        if (!enderecoCompleto) {
            return res.status(400).json({
                status: false,
                calculada: false,
                bloqueada: true,
                motivo: 'endereco_vazio',
                mensagem: 'Informe endereço, número, bairro, cidade, UF e CEP.'
            });
        }
        const resultado = await calcularEntrega(enderecoCompleto, dados);
        return res.json({
            status: resultado.calculada && !resultado.bloqueada,
            endereco_completo: enderecoCompleto,
            ...resultado
        });
    } catch (erro) {
        console.error('❌ Erro na rota POST:', erro);
        return res.status(500).json({
            status: false,
            calculada: false,
            bloqueada: true,
            motivo: 'erro_api',
            mensagem: 'Erro interno ao calcular entrega.'
        });
    }
});

router.get('/teste', async (req, res) => {
    try {
        const dados = req.query || {};
        const enderecoCompleto = montarEnderecoCompleto(dados);
        if (!enderecoCompleto) {
            return res.status(400).json({
                status: false,
                mensagem: 'Informe os dados pela URL. Exemplo: /calculo-de-entrega/teste?cep=13190000&endereco=Rua+Exemplo&numero=123&bairro=Centro&cidade=Hortolandia&uf=SP'
            });
        }
        const resultado = await calcularEntrega(enderecoCompleto, dados);
        return res.json({
            status: resultado.calculada && !resultado.bloqueada,
            endereco_completo: enderecoCompleto,
            ...resultado
        });
    } catch (erro) {
        console.error('❌ Erro na rota GET /teste:', erro);
        return res.status(500).json({
            status: false,
            calculada: false,
            bloqueada: true,
            motivo: 'erro_api',
            mensagem: 'Erro interno ao calcular entrega.'
        });
    }
});

module.exports = router;
module.exports.calcularEntrega = calcularEntrega;