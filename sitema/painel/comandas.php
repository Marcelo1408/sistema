<?php
session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

function h($valor) {
    return htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8');
}

// ---- AÇÕES ----

// Forçar fechamento
if (isset($_GET['forcar_fechar']) && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    $res = $conn->query("SELECT SUM(subtotal) AS total FROM comanda_itens WHERE comanda_id = $id");
    $total = $res->fetch_assoc()['total'] ?? 0;
    $conn->query("UPDATE comandas SET total = $total, status = 'fechada', data_fechamento = NOW() WHERE id = $id");
    header("Location: comandas.php");
    exit;
}

// Registrar pagamento
if (isset($_POST['registrar_pagamento'])) {
    $comanda_id = (int)$_POST['comanda_id'];
    $forma = $conn->real_escape_string($_POST['forma_pagamento']);

    // Busca total da comanda
    $res = $conn->query("SELECT total, mesa_numero, nome_cliente FROM comandas WHERE id = $comanda_id");
    $comanda = $res->fetch_assoc();
    $total = $comanda['total'];

    // Cria pedido
    $descricao = "Comanda #{$comanda_id} - Mesa {$comanda['mesa_numero']} - {$comanda['nome_cliente']}";
    $conn->query("INSERT INTO pedidos (cliente_id, total, pagamento, observacao, status, origem, status_pagamento)
                  VALUES (NULL, $total, '$forma', '$descricao', 'FINALIZADO', 'COMANDA', 'PAGO')");
    $pedido_id = $conn->insert_id;

    // Insere itens no pedido (opcional, para histórico)
    $itens = $conn->query("SELECT * FROM comanda_itens WHERE comanda_id = $comanda_id");
    while ($item = $itens->fetch_assoc()) {
        $conn->query("INSERT INTO itens_pedido (pedido_id, produto_id, tipo_item, item_id, nome_item, quantidade, valor_unitario, subtotal)
                      VALUES ($pedido_id, {$item['produto_id']}, 'produto', {$item['produto_id']},
                              (SELECT nome FROM produtos WHERE id={$item['produto_id']}),
                              {$item['quantidade']}, {$item['preco_unitario']}, {$item['subtotal']})");
    }

    // Lança financeiro
    $conn->query("INSERT INTO financeiro (tipo, descricao, valor, data_movimento, forma_pagamento, observacao, pedido_id, automatico, categoria)
                  VALUES ('ENTRADA', '$descricao', $total, CURDATE(), '$forma', 'Pagamento de comanda', $pedido_id, 0, 'VENDA')");

    // Atualiza comanda
    $conn->query("UPDATE comandas SET status = 'paga', pedido_id = $pedido_id WHERE id = $comanda_id");

    header("Location: comandas.php?msg=Pagamento registrado com sucesso!");
    exit;
}

// Fechar expediente (marca comandas pagas como arquivadas)
if (isset($_POST['fechar_expediente'])) {
    $conn->query("UPDATE comandas SET expediente_fechado = 1 WHERE status = 'paga' AND expediente_fechado = 0");
    header("Location: comandas.php?msg=Expediente fechado!");
    exit;
}

// ---- CONSULTAS ----

$abertas = $conn->query("
    SELECT c.*, TIMESTAMPDIFF(MINUTE, c.data_abertura, NOW()) AS minutos
    FROM comandas c
    WHERE c.status = 'aberta'
    ORDER BY c.id DESC
");

$fechadas = $conn->query("
    SELECT *
    FROM comandas
    WHERE status = 'fechada'
    ORDER BY data_fechamento DESC
");

$pagas = $conn->query("
    SELECT *
    FROM comandas
    WHERE status = 'paga' AND expediente_fechado = 0
    ORDER BY data_fechamento DESC
");

?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comandas – Painel</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <style>
        .card { background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
        .btn { padding: 8px 12px; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 14px; }
        .btn-success { background: #198754; color: #fff; }
        .btn-warning { background: #ffc107; color: #000; }
        .btn-danger { background: #dc3545; color: #fff; }
        .btn-info { background: #0dcaf0; color: #000; }
        .msg { background: #d4edda; padding: 10px; border-radius: 8px; margin-bottom: 15px; }
    </style>
</head>
<body>
<?php include 'includes/sidebar.php'; ?>
<div class="main">
<?php include 'includes/topbar.php'; ?>
<div class="content">

<h1>Gerenciar Comandas</h1>

<?php if (isset($_GET['msg'])): ?>
    <div class="msg"><?= h($_GET['msg']) ?></div>
<?php endif; ?>

<!-- ABERTAS -->
<div class="card">
    <h2>🟢 Comandas Abertas</h2>
    <table>
        <tr><th>ID</th><th>Mesa</th><th>Cliente</th><th>Valor Atual</th><th>Tempo</th><th>Ações</th></tr>
        <?php while ($c = $abertas->fetch_assoc()):
            // Calcula total parcial
            $r = $conn->query("SELECT SUM(subtotal) AS total FROM comanda_itens WHERE comanda_id = {$c['id']}");
            $total_parcial = $r->fetch_assoc()['total'] ?? 0;
        ?>
        <tr>
            <td>#<?= $c['id'] ?></td>
            <td><?= h($c['mesa_numero']) ?></td>
            <td><?= h($c['nome_cliente']) ?></td>
            <td>R$ <?= number_format($total_parcial, 2, ',', '.') ?></td>
            <td><?= $c['minutos'] ?> min</td>
            <td>
                <a href="garcom.php?id=<?= $c['id'] ?>" class="btn btn-info" target="_blank">Ver</a>
                <a href="comandas.php?forcar_fechar=1&id=<?= $c['id'] ?>" class="btn btn-warning" onclick="return confirm('Fechar comanda?')">Fechar</a>
            </td>
        </tr>
        <?php endwhile; ?>
    </table>
</div>

<!-- FECHADAS (aguardando pagamento) -->
<div class="card">
    <h2>🟡 Aguardando Pagamento</h2>
    <table>
        <tr><th>ID</th><th>Mesa</th><th>Cliente</th><th>Total</th><th>Ações</th></tr>
        <?php while ($c = $fechadas->fetch_assoc()): ?>
        <tr>
            <td>#<?= $c['id'] ?></td>
            <td><?= h($c['mesa_numero']) ?></td>
            <td><?= h($c['nome_cliente']) ?></td>
            <td>R$ <?= number_format($c['total'], 2, ',', '.') ?></td>
            <td>
                <button onclick="abrirPagamento(<?= $c['id'] ?>, <?= $c['total'] ?>)" class="btn btn-success">Registrar Pagamento</button>
            </td>
        </tr>
        <?php endwhile; ?>
    </table>
</div>

<!-- PAGAS (histórico) -->
<div class="card">
    <h2>✅ Comandas Pagas (expediente atual)</h2>
    <table>
        <tr><th>ID</th><th>Mesa</th><th>Cliente</th><th>Total</th><th>Pedido</th></tr>
        <?php while ($c = $pagas->fetch_assoc()): ?>
        <tr>
            <td>#<?= $c['id'] ?></td>
            <td><?= h($c['mesa_numero']) ?></td>
            <td><?= h($c['nome_cliente']) ?></td>
            <td>R$ <?= number_format($c['total'], 2, ',', '.') ?></td>
            <td><a href="pedido_detalhes.php?id=<?= $c['pedido_id'] ?>" target="_blank">Pedido #<?= $c['pedido_id'] ?></a></td>
        </tr>
        <?php endwhile; ?>
    </table>
    <form method="POST" style="margin-top:15px;">
        <button type="submit" name="fechar_expediente" class="btn btn-danger" onclick="return confirm('Fechar expediente? Comandas pagas serão ocultadas.')">Fechar Expediente</button>
    </form>
</div>

<!-- Modal de pagamento (simplificado) -->
<div id="modalPagamento" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,.5); justify-content:center; align-items:center;">
    <div style="background:#fff; padding:20px; border-radius:12px; width:300px;">
        <h3>Registrar Pagamento</h3>
        <p>Total: R$ <span id="totalPagamento"></span></p>
        <form method="POST" id="formPagamento">
            <input type="hidden" name="comanda_id" id="comanda_id">
            <label>Forma de Pagamento</label>
            <select name="forma_pagamento" required>
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="CARTAO">Cartão</option>
            </select>
            <br><br>
            <button type="submit" name="registrar_pagamento" class="btn btn-success">Confirmar</button>
            <button type="button" onclick="fecharModal()" class="btn btn-danger">Cancelar</button>
        </form>
    </div>
</div>

<script>
function abrirPagamento(id, total) {
    document.getElementById('comanda_id').value = id;
    document.getElementById('totalPagamento').innerText = total.toFixed(2).replace('.', ',');
    document.getElementById('modalPagamento').style.display = 'flex';
}
function fecharModal() {
    document.getElementById('modalPagamento').style.display = 'none';
}
</script>

</div>
</div>
</body>
</html>