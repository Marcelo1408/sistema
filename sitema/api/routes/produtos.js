const express = require('express');
const router = express.Router();
const db = require('../db');

async function colunaExiste(tabela, coluna) {
    const [rows] = await db.query(
        `SELECT COUNT(*) total
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
        [tabela, coluna]
    );

    return Number(rows[0]?.total || 0) > 0;
}

async function garantirOrdemProdutos() {
    const existe = await colunaExiste('produtos', 'ordem');

    if (!existe) {
        await db.query(`ALTER TABLE produtos ADD COLUMN ordem INT NOT NULL DEFAULT 0`);
    }

    const [rows] = await db.query(`
        SELECT id, ordem
        FROM produtos
        ORDER BY
            CASE WHEN IFNULL(ordem, 0) <= 0 THEN 1 ELSE 0 END ASC,
            ordem ASC,
            id ASC
    `);

    let posicao = 1;
    for (const row of rows) {
        if (Number(row.ordem || 0) !== posicao) {
            await db.query(`UPDATE produtos SET ordem = ? WHERE id = ?`, [posicao, row.id]);
        }
        posicao++;
    }
}

router.get('/', async (req, res) => {
    try {
        await garantirOrdemProdutos();

        const [rows] = await db.query(`
            SELECT
                p.id,
                p.nome,
                p.descricao,
                p.preco,
                p.imagem,
                p.estoque,
                p.ordem,
                c.nome categoria
            FROM produtos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE p.ativo = 1
            ORDER BY p.ordem ASC, p.id ASC
        `);

        res.json(rows);
    } catch (err) {
        res.status(500).json({
            erro: err.message
        });
    }
});

module.exports = router;
