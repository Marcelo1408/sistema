const express = require('express');
const router = express.Router();
const db = require('../db');
const axios = require('axios');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

const payment = new Payment(client);

router.post('/criar', async (req, res) => {
    try {
        const { pedido_id } = req.body || {};

        if (!pedido_id) {
            return res.status(400).json({
                erro: 'pedido_id é obrigatório.'
            });
        }

        const [pedidos] = await db.query(
            `SELECT 
                p.id,
                p.total,
                p.status,
                c.nome,
                c.telefone
             FROM pedidos p
             LEFT JOIN clientes c ON c.id = p.cliente_id
             WHERE p.id = ?
             LIMIT 1`,
            [pedido_id]
        );

        if (!pedidos.length) {
            return res.status(404).json({
                erro: 'Pedido não encontrado.'
            });
        }

        const pedido = pedidos[0];

        const resultado = await payment.create({
            body: {
                transaction_amount: Number(pedido.total),
                description: `Pedido #${pedido.id} - Espetaria`,
                payment_method_id: 'pix',
                payer: {
                    email: `pedido${pedido.id}@gmail.com`,
                    first_name: pedido.nome || 'Cliente'
                },
                external_reference: String(pedido.id)
            },
            requestOptions: {
                idempotencyKey: `pedido-${pedido.id}-${Date.now()}`
            }
        });

        const pix = resultado.point_of_interaction?.transaction_data;

        await db.query(
            `UPDATE pedidos SET
                id_pagamento = ?,
                status_pagamento = 'PENDENTE',
                status = 'AGUARDANDO_PIX'
             WHERE id = ?`,
            [
                resultado.id,
                pedido.id
            ]
        );

        return res.json({
            sucesso: true,
            pedido_id: pedido.id,
            pagamento_id: resultado.id,
            qr_code: pix?.qr_code,
            qr_code_base64: pix?.qr_code_base64,
            ticket_url: pix?.ticket_url
        });

    } catch (error) {
        console.log('Erro ao gerar PIX:', error.message);

        return res.status(500).json({
            erro: error.message
        });
    }
});

router.post('/webhook', async (req, res) => {
    try {
        const body = req.body || {};

        console.log('WEBHOOK MERCADO PAGO:', body);

        const pagamentoId =
            body?.data?.id ||
            body?.id;

        if (!pagamentoId) {
            return res.sendStatus(200);
        }

        const pagamento = await payment.get({
            id: pagamentoId
        });

        const status = pagamento.status;
        const pedidoId = pagamento.external_reference;

        console.log('STATUS PAGAMENTO:', status);
        console.log('PEDIDO REFERÊNCIA:', pedidoId);

        if (status === 'approved' && pedidoId) {
            await db.query(
                `UPDATE pedidos SET
                    status_pagamento = 'PAGO',
                    status = 'EM_PREPARO'
                 WHERE id = ?`,
                [pedidoId]
            );

            const [dadosPedido] = await db.query(
                `SELECT 
                    p.id,
                    p.total,
                    c.nome,
                    c.telefone
                 FROM pedidos p
                 LEFT JOIN clientes c ON c.id = p.cliente_id
                 WHERE p.id = ?
                 LIMIT 1`,
                [pedidoId]
            );

            if (dadosPedido.length && dadosPedido[0].telefone) {
                const telefone = `${dadosPedido[0].telefone}@c.us`;

                await axios.post('http://127.0.0.1:4000/notificar-pedido', {
                    telefone,
                    mensagem:
`✅ Pagamento aprovado!

Pedido #${dadosPedido[0].id}

Olá ${dadosPedido[0].nome || 'cliente'}, seu pagamento foi confirmado com sucesso.

Seu pedido já está *em preparo*.

Assim que estiver pronto e sair para entrega, avisaremos por aqui.`
                });
            }
        }

        return res.sendStatus(200);

    } catch (error) {
        console.log('Erro webhook Mercado Pago:', error.message);
        return res.sendStatus(200);
    }
});

module.exports = router;