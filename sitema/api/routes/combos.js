const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
    try {
        const [combos] = await db.query(`
            SELECT *
            FROM combos
            WHERE ativo = 1
            ORDER BY destaque DESC, id DESC
        `);

        for (const combo of combos) {
            const [itens] = await db.query(`
                SELECT 
                    cp.quantidade,
                    p.nome,
                    p.preco
                FROM combo_produtos cp
                LEFT JOIN produtos p ON p.id = cp.produto_id
                WHERE cp.combo_id = ?
            `, [combo.id]);

            combo.itens = itens;
        }

        res.json(combos);

    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

module.exports = router;