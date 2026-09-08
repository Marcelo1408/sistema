const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                pr.id,
                pr.titulo,
                pr.descricao,
                pr.imagem,
                pr.preco_promocional,
                pr.data_inicio,
                pr.data_fim,
                pr.ativo,
                p.nome AS produto
            FROM promocoes pr
            LEFT JOIN produtos p 
            ON p.id = pr.produto_id
            WHERE pr.ativo = 1
            ORDER BY pr.id DESC
        `);

        res.json(rows);

    } catch (err) {
        res.status(500).json({
            erro: err.message
        });
    }
});

module.exports = router;