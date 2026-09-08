const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
    try {
        const [clientes] = await db.query(
            "SELECT * FROM clientes ORDER BY id DESC"
        );

        res.json(clientes);

    } catch (error) {
        res.status(500).json({
            erro: error.message
        });
    }
});
router.get('/telefone/:telefone', async (req, res) => {
    try {
        const telefone = req.params.telefone;

        const [clientes] = await db.query(
            'SELECT * FROM clientes WHERE telefone = ? LIMIT 1',
            [telefone]
        );

        if (!clientes.length) {
            return res.json({
                encontrado: false
            });
        }

        res.json({
            encontrado: true,
            cliente: clientes[0]
        });

    } catch (error) {
        res.status(500).json({
            erro: error.message
        });
    }
});

module.exports = router;