const express = require('express');
const router = express.Router();
const db = require('../db');

// Lista todos os adicionais ativos
router.get('/', async (req, res) => {
    try {
        const [adicionais] = await db.query(`
            SELECT id, nome, preco
            FROM adicionais
            WHERE ativo = 1
            ORDER BY nome ASC
        `);

        res.json(adicionais);

    } catch (error) {
        res.status(500).json({
            erro: error.message
        });
    }
});

// Lista adicionais vinculados a um produto
router.get('/produto/:produto_id', async (req, res) => {
    try {
        const produtoId = req.params.produto_id;

        const [adicionais] = await db.query(`
            SELECT 
                a.id,
                a.nome,
                a.preco
            FROM produto_adicionais pa
            INNER JOIN adicionais a ON a.id = pa.adicional_id
            WHERE pa.produto_id = ?
            AND a.ativo = 1
            ORDER BY a.nome ASC
        `, [produtoId]);

        res.json(adicionais);

    } catch (error) {
        res.status(500).json({
            erro: error.message
        });
    }
});

module.exports = router;