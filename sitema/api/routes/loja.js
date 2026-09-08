const express = require('express');
const router = express.Router();
const db = require('../db');

const SITE_URL_PADRAO = (
    process.env.SITE_URL ||
    process.env.PAINEL_URL ||
    process.env.URL_SISTEMA ||
    process.env.DOMINIO ||
    'https://espetarianabrasa.giize.com'
).replace(/\/+$/, '');

const MENSAGEM_LOJA_FECHADA_PADRAO = [
    'Ola! No momento a loja esta fechada.',
    '',
    'Nosso atendimento esta fora do horario de funcionamento.',
    'Assim que abrirmos, voce podera fazer seu pedido por aqui.',
    '',
    'Agradecemos a compreensao.'
].join('\n');

function valorValido(valor) {
    return valor !== undefined && valor !== null && String(valor).trim() !== '';
}

function corrigirTextoMojibake(valor) {
    if (!valorValido(valor)) return valor;

    let texto = String(valor);

    if (/[ÃÂâðŸ]/.test(texto)) {
        try {
            const corrigido = Buffer.from(texto, 'latin1').toString('utf8');
            if (corrigido && !/�/.test(corrigido)) {
                texto = corrigido;
            }
        } catch (e) {}
    }

    return texto;
}

function limparMensagemFechada(valor) {
    const texto = corrigirTextoMojibake(valor);

    if (!valorValido(texto)) {
        return MENSAGEM_LOJA_FECHADA_PADRAO;
    }

    if (/[ÃÂâðŸ�]/.test(texto)) {
        return MENSAGEM_LOJA_FECHADA_PADRAO;
    }

    return String(texto).trim();
}

function montarLogoUrl(logo) {
    if (!valorValido(logo)) return null;

    const valor = String(logo).trim();

    if (/^https?:\/\//i.test(valor)) {
        return valor;
    }

    let caminho = valor.replace(/^\.\//, '').replace(/^\/+/, '');

    // No painel a logo fica em uploads/NOME.png.
    if (!caminho.includes('/')) {
        caminho = `uploads/${caminho}`;
    }

    return `${SITE_URL_PADRAO}/${caminho}`;
}

async function colunaExiste(nomeColuna) {
    const [rows] = await db.query(
        `SELECT COUNT(*) total
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'configuracoes'
         AND COLUMN_NAME = ?`,
        [nomeColuna]
    );

    return Number(rows[0]?.total || 0) > 0;
}

function numeroEntrega(valor, padrao) {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 ? numero : padrao;
}

async function garantirControleLoja() {
    if (!(await colunaExiste('loja_aberta'))) {
        await db.query(`
            ALTER TABLE configuracoes
            ADD COLUMN loja_aberta TINYINT(1) NOT NULL DEFAULT 0
        `);
    }

    if (!(await colunaExiste('expediente_aberto_em'))) {
        await db.query(`
            ALTER TABLE configuracoes
            ADD COLUMN expediente_aberto_em DATETIME DEFAULT NULL
        `);
    }

    if (!(await colunaExiste('expediente_fechado_em'))) {
        await db.query(`
            ALTER TABLE configuracoes
            ADD COLUMN expediente_fechado_em DATETIME DEFAULT NULL
        `);
    }

    if (!(await colunaExiste('entrega_km_base'))) {
        await db.query(`
            ALTER TABLE configuracoes
            ADD COLUMN entrega_km_base DECIMAL(10,2) NOT NULL DEFAULT 3.00 AFTER taxa_entrega
        `);
    }

    if (!(await colunaExiste('entrega_valor_km_adicional'))) {
        await db.query(`
            ALTER TABLE configuracoes
            ADD COLUMN entrega_valor_km_adicional DECIMAL(10,2) NOT NULL DEFAULT 2.00 AFTER entrega_km_base
        `);
    }

    if (!(await colunaExiste('entrega_taxa_fallback'))) {
        await db.query(`
            ALTER TABLE configuracoes
            ADD COLUMN entrega_taxa_fallback DECIMAL(10,2) NOT NULL DEFAULT 10.00 AFTER entrega_valor_km_adicional
        `);
    }

    if (!(await colunaExiste('loja_lat'))) {
        await db.query(`
            ALTER TABLE configuracoes
            ADD COLUMN loja_lat VARCHAR(50) DEFAULT NULL AFTER entrega_taxa_fallback
        `);
    }

    if (!(await colunaExiste('loja_lng'))) {
        await db.query(`
            ALTER TABLE configuracoes
            ADD COLUMN loja_lng VARCHAR(50) DEFAULT NULL AFTER loja_lat
        `);
    }
}

router.get('/status', async (req, res) => {
    try {
        await garantirControleLoja();

        const [configRows] = await db.query(`
            SELECT
                loja_aberta,
                expediente_aberto_em,
                expediente_fechado_em,
                nome_empresa,
                logo,
                taxa_entrega,
                entrega_km_base,
                entrega_valor_km_adicional,
                entrega_taxa_fallback,
                loja_lat,
                loja_lng
            FROM configuracoes
            ORDER BY id ASC
            LIMIT 1
        `);

        let mensagemFechado = MENSAGEM_LOJA_FECHADA_PADRAO;

        try {
            const [whatsRows] = await db.query(`
                SELECT mensagem_fechado
                FROM configuracoes_whatsapp
                ORDER BY id ASC
                LIMIT 1
            `);

            if (whatsRows.length && whatsRows[0].mensagem_fechado) {
                mensagemFechado = limparMensagemFechada(whatsRows[0].mensagem_fechado);
            }
        } catch (e) {
            mensagemFechado = MENSAGEM_LOJA_FECHADA_PADRAO;
        }

        const config = configRows[0] || {};
        const logo = config.logo || null;

        const lojaAberta = Number(config.loja_aberta || 0) === 1;

        return res.json({
            aberta: lojaAberta,
            loja_aberta: lojaAberta,
            expediente_aberto_em: config.expediente_aberto_em || null,
            expediente_fechado_em: config.expediente_fechado_em || null,
            nome_empresa: corrigirTextoMojibake(config.nome_empresa || 'ESPETARIA CHURRASCO NA BRASA'),
            logo: logo,
            logo_url: montarLogoUrl(logo),
            site_url: SITE_URL_PADRAO,
            mensagem_fechado: mensagemFechado,
            entrega: {
                taxa_base: numeroEntrega(config.taxa_entrega, 10),
                km_base: numeroEntrega(config.entrega_km_base, 3),
                valor_km_adicional: numeroEntrega(config.entrega_valor_km_adicional, 2),
                taxa_fallback: numeroEntrega(config.entrega_taxa_fallback, numeroEntrega(config.taxa_entrega, 10)),
                loja_lat: config.loja_lat || null,
                loja_lng: config.loja_lng || null
            }
        });

    } catch (error) {
        console.error('Erro ao consultar status da loja:', error.message);

        return res.status(500).json({
            aberta: false,
            loja_aberta: false,
            nome_empresa: 'ESPETARIA CHURRASCO NA BRASA',
            logo: null,
            logo_url: null,
            mensagem_fechado: MENSAGEM_LOJA_FECHADA_PADRAO,
            entrega: {
                taxa_base: 10,
                km_base: 3,
                valor_km_adicional: 2,
                taxa_fallback: 10,
                loja_lat: null,
                loja_lng: null
            }
        });
    }
});

module.exports = router;
