const express = require('express');
const router = express.Router();
const db = require('../db');

function erroCliente(mensagem) {
    const error = new Error(mensagem);
    error.statusCode = 400;
    return error;
}

function quantidadeInteira(valor) {
    const quantidade = parseInt(valor, 10);
    return Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 0;
}

function normalizarTipoItem(item) {
    const tipo = String(item?.tipo || 'produto').toLowerCase().trim();

    if (tipo === 'combo') return 'combo';
    if (tipo === 'promocao' || tipo === 'promoção') return 'promocao';

    return 'produto';
}

function obterIdInformado(item) {
    return Number(item?.produto_id || item?.item_id || item?.id || 0);
}

async function garantirColunasItensPedido(conn) {
    const [colunas] = await conn.query(`SHOW COLUMNS FROM itens_pedido`);
    const existentes = new Set(colunas.map(coluna => coluna.Field));

    if (!existentes.has('tipo_item')) {
        await conn.query(`ALTER TABLE itens_pedido ADD COLUMN tipo_item VARCHAR(30) NOT NULL DEFAULT 'produto' AFTER produto_id`);
    }

    if (!existentes.has('item_id')) {
        await conn.query(`ALTER TABLE itens_pedido ADD COLUMN item_id INT(11) DEFAULT NULL AFTER tipo_item`);
    }

    if (!existentes.has('nome_item')) {
        await conn.query(`ALTER TABLE itens_pedido ADD COLUMN nome_item VARCHAR(255) DEFAULT NULL AFTER item_id`);
    }

    const [idxTipo] = await conn.query(`SHOW INDEX FROM itens_pedido WHERE Key_name = 'idx_itens_pedido_tipo_item'`);
    if (!idxTipo.length) {
        await conn.query(`ALTER TABLE itens_pedido ADD INDEX idx_itens_pedido_tipo_item (tipo_item)`);
    }

    const [idxItemId] = await conn.query(`SHOW INDEX FROM itens_pedido WHERE Key_name = 'idx_itens_pedido_item_id'`);
    if (!idxItemId.length) {
        await conn.query(`ALTER TABLE itens_pedido ADD INDEX idx_itens_pedido_item_id (item_id)`);
    }
}

async function obterDadosItemParaPedido(conn, item) {
    const tipo = normalizarTipoItem(item);
    const idInformado = obterIdInformado(item);

    if (!idInformado) {
        throw erroCliente('Item inválido no pedido.');
    }

    if (tipo === 'combo') {
        const [combos] = await conn.query(
            `SELECT id, nome, preco
             FROM combos
             WHERE id = ?
             LIMIT 1`,
            [idInformado]
        );

        if (!combos.length) {
            throw erroCliente('Combo inválido no pedido.');
        }

        const [itensCombo] = await conn.query(
            `SELECT produto_id
             FROM combo_produtos
             WHERE combo_id = ?
             ORDER BY id ASC
             LIMIT 1`,
            [idInformado]
        );

        return {
            tipoItem: 'combo',
            itemId: idInformado,
            nomeItem: item.nome || combos[0].nome,
            // Mantém um produto_id de referência para compatibilidade com telas antigas/adicionais.
            // A baixa correta do estoque do combo continua sendo feita em adicionarBaixaEstoqueDoItem().
            produtoId: itensCombo.length ? Number(itensCombo[0].produto_id) : null,
            preco: Number(item.preco ?? combos[0].preco) || 0
        };
    }

    if (tipo === 'promocao') {
        const [promocoes] = await conn.query(
            `SELECT pr.id AS produto_id, pr.nome AS produto_nome, pm.titulo, pm.preco_promocional
             FROM promocoes pm
             LEFT JOIN produtos pr ON pr.id = pm.produto_id
             WHERE pm.id = ?
             LIMIT 1`,
            [idInformado]
        );

        if (!promocoes.length || !promocoes[0].produto_id) {
            throw erroCliente('Promoção inválida ou sem produto vinculado.');
        }

        return {
            tipoItem: 'promocao',
            itemId: idInformado,
            nomeItem: item.nome || promocoes[0].titulo || promocoes[0].produto_nome,
            produtoId: Number(promocoes[0].produto_id),
            preco: Number(item.preco ?? promocoes[0].preco_promocional) || 0
        };
    }

    const [produtos] = await conn.query(
        `SELECT id, nome, preco
         FROM produtos
         WHERE id = ?
         LIMIT 1`,
        [idInformado]
    );

    if (!produtos.length) {
        throw erroCliente('Produto inválido no pedido.');
    }

    return {
        tipoItem: 'produto',
        itemId: idInformado,
        nomeItem: item.nome || produtos[0].nome,
        produtoId: idInformado,
        preco: Number(item.preco ?? produtos[0].preco) || 0
    };
}


function somarBaixa(baixas, produtoId, quantidade) {
    produtoId = Number(produtoId || 0);
    quantidade = quantidadeInteira(quantidade);

    if (!produtoId || quantidade <= 0) {
        return;
    }

    baixas.set(produtoId, (baixas.get(produtoId) || 0) + quantidade);
}

async function adicionarBaixaEstoqueDoItem(conn, baixas, item) {
    const tipo = String(item.tipo || 'produto').toLowerCase();
    const idInformado = Number(item.produto_id || item.id || 0);
    const quantidadePedido = quantidadeInteira(item.quantidade);

    if (!idInformado) {
        throw erroCliente('Produto inválido no pedido.');
    }

    if (quantidadePedido <= 0) {
        throw erroCliente('Quantidade inválida no pedido.');
    }

    if (tipo === 'combo') {
        const [itensCombo] = await conn.query(
            `SELECT produto_id, quantidade
             FROM combo_produtos
             WHERE combo_id = ?`,
            [idInformado]
        );

        if (!itensCombo.length) {
            throw erroCliente('Combo inválido ou sem produtos vinculados.');
        }

        for (const itemCombo of itensCombo) {
            const quantidadeDoCombo = quantidadeInteira(itemCombo.quantidade) || 1;
            somarBaixa(baixas, itemCombo.produto_id, quantidadeDoCombo * quantidadePedido);
        }

        return;
    }

    if (tipo === 'promocao' || tipo === 'promoção') {
        const [promocoes] = await conn.query(
            `SELECT produto_id
             FROM promocoes
             WHERE id = ?
             LIMIT 1`,
            [idInformado]
        );

        if (!promocoes.length || !promocoes[0].produto_id) {
            throw erroCliente('Promoção inválida ou sem produto vinculado.');
        }

        somarBaixa(baixas, promocoes[0].produto_id, quantidadePedido);
        return;
    }

    somarBaixa(baixas, idInformado, quantidadePedido);
}

async function baixarEstoque(conn, baixas, pedidoId) {
    for (const [produtoId, quantidade] of baixas.entries()) {
        const [produtos] = await conn.query(
            `SELECT id, nome, estoque
             FROM produtos
             WHERE id = ?
             FOR UPDATE`,
            [produtoId]
        );

        if (!produtos.length) {
            throw erroCliente(`Produto ID ${produtoId} não encontrado para baixa de estoque.`);
        }

        const produto = produtos[0];
        const estoqueAtual = Number(produto.estoque || 0);

        if (estoqueAtual < quantidade) {
            throw erroCliente(
                `Estoque insuficiente para ${produto.nome}. Disponível: ${estoqueAtual}. Solicitado: ${quantidade}.`
            );
        }

        await conn.query(
            `UPDATE produtos
             SET estoque = estoque - ?
             WHERE id = ?`,
            [quantidade, produtoId]
        );

        await conn.query(
            `INSERT INTO estoque_movimentacoes
             (produto_id, tipo, quantidade, observacao)
             VALUES (?, 'SAIDA', ?, ?)`,
            [produtoId, quantidade, `Venda automática - Pedido #${pedidoId}`]
        );
    }
}


async function garantirTabelasEmbalagens(conn) {
    await conn.query(`CREATE TABLE IF NOT EXISTS embalagens (
        id INT(11) NOT NULL AUTO_INCREMENT,
        nome VARCHAR(120) NOT NULL,
        descricao TEXT DEFAULT NULL,
        unidade VARCHAR(30) DEFAULT 'un',
        estoque INT(11) NOT NULL DEFAULT 0,
        estoque_minimo INT(11) NOT NULL DEFAULT 10,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

    await conn.query(`CREATE TABLE IF NOT EXISTS embalagem_movimentacoes (
        id INT(11) NOT NULL AUTO_INCREMENT,
        embalagem_id INT(11) NOT NULL,
        tipo ENUM('ENTRADA','SAIDA','AJUSTE') NOT NULL,
        quantidade INT(11) NOT NULL,
        observacao TEXT DEFAULT NULL,
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY embalagem_id (embalagem_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

    await conn.query(`CREATE TABLE IF NOT EXISTS produto_embalagens (
        id INT(11) NOT NULL AUTO_INCREMENT,
        produto_id INT(11) NOT NULL,
        embalagem_id INT(11) NOT NULL,
        quantidade INT(11) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY produto_embalagem_unica (produto_id, embalagem_id),
        KEY produto_id (produto_id),
        KEY embalagem_id (embalagem_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

    await conn.query(`CREATE TABLE IF NOT EXISTS pedido_embalagens_padrao (
        id INT(11) NOT NULL AUTO_INCREMENT,
        embalagem_id INT(11) NOT NULL,
        quantidade INT(11) NOT NULL DEFAULT 1,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY embalagem_pedido_unica (embalagem_id),
        KEY embalagem_id (embalagem_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);
}

function somarBaixaEmbalagem(baixas, embalagemId, quantidade) {
    embalagemId = Number(embalagemId || 0);
    quantidade = quantidadeInteira(quantidade);

    if (!embalagemId || quantidade <= 0) {
        return;
    }

    baixas.set(embalagemId, (baixas.get(embalagemId) || 0) + quantidade);
}

async function montarBaixasEmbalagensPorProdutos(conn, baixasProdutos, baixasEmbalagens) {
    for (const [produtoId, quantidadeVendida] of baixasProdutos.entries()) {
        const [vinculos] = await conn.query(
            `SELECT embalagem_id, quantidade
             FROM produto_embalagens
             WHERE produto_id = ?`,
            [produtoId]
        );

        for (const vinculo of vinculos) {
            const quantidadePorProduto = quantidadeInteira(vinculo.quantidade) || 1;
            somarBaixaEmbalagem(
                baixasEmbalagens,
                vinculo.embalagem_id,
                quantidadePorProduto * quantidadeVendida
            );
        }
    }
}

async function montarBaixasEmbalagensPorPedido(conn, baixasEmbalagens) {
    const [padroes] = await conn.query(
        `SELECT embalagem_id, quantidade
         FROM pedido_embalagens_padrao
         WHERE ativo = 1`
    );

    for (const padrao of padroes) {
        const quantidade = quantidadeInteira(padrao.quantidade) || 1;
        somarBaixaEmbalagem(baixasEmbalagens, padrao.embalagem_id, quantidade);
    }
}

async function baixarEmbalagens(conn, baixasEmbalagens, pedidoId) {
    for (const [embalagemId, quantidade] of baixasEmbalagens.entries()) {
        const [embalagens] = await conn.query(
            `SELECT id, nome, estoque
             FROM embalagens
             WHERE id = ?
             FOR UPDATE`,
            [embalagemId]
        );

        if (!embalagens.length) {
            throw erroCliente(`Embalagem ID ${embalagemId} não encontrada para baixa de estoque.`);
        }

        const embalagem = embalagens[0];
        const estoqueAtual = Number(embalagem.estoque || 0);

        if (estoqueAtual < quantidade) {
            throw erroCliente(
                `Estoque insuficiente para a embalagem ${embalagem.nome}. Disponível: ${estoqueAtual}. Solicitado: ${quantidade}.`
            );
        }

        await conn.query(
            `UPDATE embalagens
             SET estoque = estoque - ?
             WHERE id = ?`,
            [quantidade, embalagemId]
        );

        await conn.query(
            `INSERT INTO embalagem_movimentacoes
             (embalagem_id, tipo, quantidade, observacao)
             VALUES (?, 'SAIDA', ?, ?)`,
            [embalagemId, quantidade, `Baixa automática - Pedido #${pedidoId}`]
        );
    }
}


async function garantirFinanceiro(conn) {
    await conn.query(`CREATE TABLE IF NOT EXISTS financeiro (
        id INT(11) NOT NULL AUTO_INCREMENT,
        tipo ENUM('ENTRADA','SAIDA') NOT NULL,
        descricao VARCHAR(255) NOT NULL,
        valor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        data_movimento DATE NOT NULL,
        forma_pagamento VARCHAR(50) DEFAULT NULL,
        observacao TEXT DEFAULT NULL,
        pedido_id INT(11) DEFAULT NULL,
        automatico TINYINT(1) NOT NULL DEFAULT 0,
        categoria VARCHAR(50) DEFAULT NULL,
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_financeiro_pedido_id (pedido_id),
        KEY idx_financeiro_data (data_movimento),
        KEY idx_financeiro_tipo (tipo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

    const [colunasPedido] = await conn.query(`SHOW COLUMNS FROM financeiro LIKE 'pedido_id'`);
    if (!colunasPedido.length) {
        await conn.query(`ALTER TABLE financeiro ADD COLUMN pedido_id INT(11) DEFAULT NULL AFTER observacao`);
    }

    const [colunasAutomatico] = await conn.query(`SHOW COLUMNS FROM financeiro LIKE 'automatico'`);
    if (!colunasAutomatico.length) {
        await conn.query(`ALTER TABLE financeiro ADD COLUMN automatico TINYINT(1) NOT NULL DEFAULT 0 AFTER pedido_id`);
    }

    const [colunasCategoria] = await conn.query(`SHOW COLUMNS FROM financeiro LIKE 'categoria'`);
    if (!colunasCategoria.length) {
        await conn.query(`ALTER TABLE financeiro ADD COLUMN categoria VARCHAR(50) DEFAULT NULL AFTER automatico`);
    }

    const [indicesPedido] = await conn.query(`SHOW INDEX FROM financeiro WHERE Key_name = 'idx_financeiro_pedido_id'`);
    if (!indicesPedido.length) {
        await conn.query(`ALTER TABLE financeiro ADD INDEX idx_financeiro_pedido_id (pedido_id)`);
    }

    const [indicesData] = await conn.query(`SHOW INDEX FROM financeiro WHERE Key_name = 'idx_financeiro_data'`);
    if (!indicesData.length) {
        await conn.query(`ALTER TABLE financeiro ADD INDEX idx_financeiro_data (data_movimento)`);
    }
}

async function registrarVendaNoFinanceiro(conn, pedidoId, valorTotal, formaPagamento = 'PIX') {
    await garantirFinanceiro(conn);

    const valor = Number(valorTotal) || 0;
    if (valor <= 0) {
        return;
    }

    const [jaExiste] = await conn.query(
        `SELECT id
         FROM financeiro
         WHERE pedido_id = ?
         AND tipo = 'ENTRADA'
         LIMIT 1`,
        [pedidoId]
    );

    if (jaExiste.length) {
        return;
    }

    await conn.query(
        `INSERT INTO financeiro
         (tipo, descricao, valor, data_movimento, forma_pagamento, observacao, pedido_id, automatico, categoria)
         VALUES ('ENTRADA', ?, ?, CURDATE(), ?, ?, ?, 1, 'VENDA')`,
        [
            `Venda automática - Pedido #${pedidoId}`,
            valor,
            formaPagamento || 'PIX',
            'Entrada gerada automaticamente pelo pedido do WhatsApp.',
            pedidoId
        ]
    );
}

router.post('/', async (req, res) => {
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();
        await garantirTabelasEmbalagens(conn);
        await garantirColunasItensPedido(conn);

        const {
            nome,
            telefone,
            endereco,
            referencia,
            observacao,
            observacao_pedido,
            itens,
            total,
            taxa_entrega
        } = req.body || {};

        if (!nome || !telefone || !endereco || !itens || !itens.length) {
            await conn.rollback();
            return res.status(400).json({
                erro: 'Dados incompletos para criar pedido.'
            });
        }

        const valorTotal = Number(total) || 0;
        const taxaEntrega = taxa_entrega !== undefined ? Number(taxa_entrega) : 0;
        const observacaoPedido = String(observacao_pedido || observacao || '').trim();
        const observacaoPedidoTexto = observacaoPedido
            ? `Endereço: ${endereco} | Referência: ${referencia || ''} | Observação do pedido: ${observacaoPedido}`
            : `Endereço: ${endereco} | Referência: ${referencia || ''}`;
        const baixasEstoque = new Map();
        const baixasEmbalagens = new Map();

        const [clientes] = await conn.query(
            'SELECT * FROM clientes WHERE telefone = ? LIMIT 1',
            [telefone]
        );

        let clienteId;

        if (clientes.length > 0) {
            clienteId = clientes[0].id;

            await conn.query(
                `UPDATE clientes SET
                    nome = ?,
                    endereco = ?,
                    referencia = ?,
                    total_pedidos = IFNULL(total_pedidos, 0) + 1,
                    valor_gasto = IFNULL(valor_gasto, 0) + ?
                 WHERE id = ?`,
                [nome, endereco, referencia, valorTotal, clienteId]
            );
        } else {
            const [novoCliente] = await conn.query(
                `INSERT INTO clientes
                (nome, telefone, endereco, referencia, total_pedidos, valor_gasto)
                VALUES (?, ?, ?, ?, 1, ?)`,
                [nome, telefone, endereco, referencia, valorTotal]
            );

            clienteId = novoCliente.insertId;
        }

        const [pedido] = await conn.query(
            `INSERT INTO pedidos
            (cliente_id, total, pagamento, observacao, status, taxa_entrega, origem, status_pagamento)
            VALUES (?, ?, 'PIX', ?, 'AGUARDANDO_PIX', ?, 'WHATSAPP', 'PENDENTE')`,
            [
                clienteId,
                valorTotal,
                observacaoPedidoTexto,
                taxaEntrega
            ]
        );

        const pedidoId = pedido.insertId;

        for (const item of itens) {
            await adicionarBaixaEstoqueDoItem(conn, baixasEstoque, item);

            const dadosItem = await obterDadosItemParaPedido(conn, item);
            const produtoId = dadosItem.produtoId || null;
            const quantidade = quantidadeInteira(item.quantidade);
            const valorUnitario = Number(item.preco) || dadosItem.preco || 0;
            const subtotalItem = Number(item.subtotal) || (valorUnitario * quantidade);

            const [itemPedido] = await conn.query(
                `INSERT INTO itens_pedido
                (pedido_id, produto_id, tipo_item, item_id, nome_item, quantidade, valor_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    pedidoId,
                    produtoId,
                    dadosItem.tipoItem,
                    dadosItem.itemId,
                    dadosItem.nomeItem,
                    quantidade,
                    valorUnitario,
                    subtotalItem
                ]
            );

            const itemPedidoId = itemPedido.insertId;

            if (item.adicionais && item.adicionais.length) {
                for (const adicional of item.adicionais) {
                    await conn.query(
                        `INSERT INTO itens_pedido_adicionais
                        (item_pedido_id, pedido_id, produto_id, adicional_id, nome, preco)
                        VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            itemPedidoId,
                            pedidoId,
                            produtoId || 0,
                            adicional.id,
                            adicional.nome,
                            Number(adicional.preco) || 0
                        ]
                    );
                }
            }
        }

        await montarBaixasEmbalagensPorProdutos(conn, baixasEstoque, baixasEmbalagens);
        await montarBaixasEmbalagensPorPedido(conn, baixasEmbalagens);

        await baixarEstoque(conn, baixasEstoque, pedidoId);
        await baixarEmbalagens(conn, baixasEmbalagens, pedidoId);
        await registrarVendaNoFinanceiro(conn, pedidoId, valorTotal, 'PIX');

        await conn.commit();

        return res.json({
            sucesso: true,
            pedido_id: pedidoId,
            cliente_id: clienteId,
            taxa_entrega: taxaEntrega,
            total: valorTotal,
            mensagem: 'Pedido criado com sucesso.'
        });

    } catch (error) {
        await conn.rollback();

        console.log('Erro ao criar pedido:', error.message);

        return res.status(error.statusCode || 500).json({
            erro: error.message
        });

    } finally {
        conn.release();
    }
});

router.post('/confirmar-entrega', async (req, res) => {
    try {
        const { telefone } = req.body || {};

        if (!telefone) {
            return res.status(400).json({
                erro: 'Telefone obrigatório.'
            });
        }

        const [pedidos] = await db.query(
            `SELECT p.id
             FROM pedidos p
             INNER JOIN clientes c ON c.id = p.cliente_id
             WHERE c.telefone = ?
             AND p.status = 'ENTREGUE'
             ORDER BY p.id DESC
             LIMIT 1`,
            [telefone]
        );

        if (!pedidos.length) {
            return res.status(404).json({
                erro: 'Nenhum pedido entregue encontrado para confirmar.'
            });
        }

        const pedidoId = pedidos[0].id;

        await db.query(
            `UPDATE pedidos SET status = 'CONFIRMADO_CLIENTE'
             WHERE id = ?`,
            [pedidoId]
        );

        return res.json({
            sucesso: true,
            pedido_id: pedidoId
        });

    } catch (error) {
        return res.status(500).json({
            erro: error.message
        });
    }
});

module.exports = router;
