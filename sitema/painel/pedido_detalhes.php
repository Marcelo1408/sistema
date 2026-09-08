<?php

session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

function garantirColunasItensPedidoPainel($conn){
    $colunas = [];
    $res = $conn->query("SHOW COLUMNS FROM itens_pedido");
    if($res){
        while($c = $res->fetch_assoc()){
            $colunas[$c['Field']] = true;
        }
    }

    if(!isset($colunas['tipo_item'])){
        @$conn->query("ALTER TABLE itens_pedido ADD COLUMN tipo_item VARCHAR(30) NOT NULL DEFAULT 'produto' AFTER produto_id");
    }

    if(!isset($colunas['item_id'])){
        @$conn->query("ALTER TABLE itens_pedido ADD COLUMN item_id INT(11) DEFAULT NULL AFTER tipo_item");
    }

    if(!isset($colunas['nome_item'])){
        @$conn->query("ALTER TABLE itens_pedido ADD COLUMN nome_item VARCHAR(255) DEFAULT NULL AFTER item_id");
    }
}

garantirColunasItensPedidoPainel($conn);

if(!isset($_GET['id'])){
    header("Location: pedidos.php");
    exit;
}

$id = intval($_GET['id']);

/*
|--------------------------------------------------------------------------
| PEDIDO
|--------------------------------------------------------------------------
*/

$pedido = $conn->query("
SELECT
p.*,
c.nome,
c.telefone,
c.endereco,
c.numero,
c.bairro,
c.complemento,
c.referencia
FROM pedidos p
LEFT JOIN clientes c ON c.id = p.cliente_id
WHERE p.id = '$id'
");

if($pedido->num_rows == 0){
    die("Pedido não encontrado.");
}

$pedido = $pedido->fetch_assoc();

/*
|--------------------------------------------------------------------------
| ITENS DO PEDIDO
|--------------------------------------------------------------------------
*/

$itens = $conn->query("
SELECT
ip.*,
COALESCE(
    NULLIF(ip.nome_item, ''),
    CASE
        WHEN ip.tipo_item = 'combo' THEN cb.nome
        WHEN ip.tipo_item IN ('promocao','promoção') THEN pm.titulo
        ELSE pr.nome
    END,
    pr.nome,
    CONCAT('Item #', ip.produto_id)
) AS produto
FROM itens_pedido ip
LEFT JOIN produtos pr ON pr.id = ip.produto_id
LEFT JOIN combos cb ON cb.id = ip.item_id
LEFT JOIN promocoes pm ON pm.id = ip.item_id
WHERE ip.pedido_id = '$id'
");
?>

<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Pedido #<?= $pedido['id']; ?></title>

<link rel="stylesheet" href="assets/css/style.css">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>
.detalhes-card{
    background:#fff;
    padding:25px;
    border-radius:15px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
    margin-bottom:20px;
}

.titulo{
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-bottom:20px;
}

.info{
    margin-bottom:8px;
}

.info strong{
    color:#333;
}

table{
    width:100%;
    border-collapse:collapse;
    margin-top:15px;
}

table th,
table td{
    padding:12px;
    border-bottom:1px solid #eee;
    text-align:left;
    vertical-align:top;
}

.adicionais{
    margin-top:8px;
    padding:10px;
    background:#f8f9fa;
    border-radius:8px;
    font-size:14px;
}

.adicionais strong{
    display:block;
    margin-bottom:5px;
    color:#333;
}

.adicionais ul{
    margin:0;
    padding-left:18px;
}

.adicionais li{
    margin-bottom:3px;
}

.total{
    font-size:22px;
    font-weight:bold;
    margin-top:20px;
    color:#198754;
}

.status{
    display:inline-block;
    padding:8px 15px;
    border-radius:20px;
    font-size:13px;
    font-weight:bold;
    margin-top:10px;
    background:#f1f1f1;
}

.botoes{
    display:flex;
    gap:10px;
    margin-top:25px;
    flex-wrap:wrap;
}

.btn{
    padding:10px 15px;
    border-radius:8px;
    text-decoration:none;
    color:#fff;
    font-size:14px;
}

.voltar{ background:#6c757d; }
.imprimir{ background:#0d6efd; }
.preparo{ background:#fd7e14; }
.pronto{ background:#20c997; }
.entrega{ background:#6c757d; }
.entregue{ background:#198754; }
.cancelado{ background:#dc3545; }
</style>
</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<div class="detalhes-card">

<div class="titulo">
    <h2>Pedido #<?= $pedido['id']; ?></h2>
    <span class="status"><?= $pedido['status']; ?></span>
</div>

<h3>Cliente</h3>

<p class="info"><strong>Nome:</strong> <?= $pedido['nome']; ?></p>
<p class="info"><strong>Telefone:</strong> <?= $pedido['telefone']; ?></p>
<p class="info"><strong>Endereço:</strong> <?= $pedido['endereco']; ?></p>
<p class="info"><strong>Número:</strong> <?= $pedido['numero']; ?></p>
<p class="info"><strong>Bairro:</strong> <?= $pedido['bairro']; ?></p>

<?php if(!empty($pedido['complemento'])){ ?>
<p class="info"><strong>Complemento:</strong> <?= $pedido['complemento']; ?></p>
<?php } ?>

<?php if(!empty($pedido['referencia'])){ ?>
<p class="info"><strong>Referência:</strong> <?= $pedido['referencia']; ?></p>
<?php } ?>

<hr>

<h3>Itens do Pedido</h3>

<table>
<tr>
    <th>Produto</th>
    <th>Qtd</th>
    <th>Valor Unit.</th>
    <th>Subtotal</th>
</tr>

<?php while($item = $itens->fetch_assoc()){ ?>

<?php
$adicionais = $conn->query("
    SELECT nome, preco
    FROM itens_pedido_adicionais
    WHERE item_pedido_id = '{$item['id']}'
    ORDER BY id ASC
");
?>

<tr>
<td>
    <?= $item['produto']; ?>
    <?php if(!empty($item['tipo_item']) && $item['tipo_item'] !== 'produto'){ ?>
        <br><small style="color:#666;">Tipo: <?= strtoupper($item['tipo_item']); ?></small>
    <?php } ?>

    <?php if($adicionais && $adicionais->num_rows > 0){ ?>
        <div class="adicionais">
            <strong>Adicionais:</strong>
            <ul>
                <?php while($adicional = $adicionais->fetch_assoc()){ ?>
                    <li>
                        <?= $adicional['nome']; ?>
                        — R$ <?= number_format($adicional['preco'], 2, ',', '.'); ?>
                    </li>
                <?php } ?>
            </ul>
        </div>
    <?php } ?>
</td>

<td><?= $item['quantidade']; ?></td>

<td>
R$ <?= number_format($item['valor_unitario'], 2, ',', '.'); ?>
</td>

<td>
R$ <?= number_format($item['subtotal'], 2, ',', '.'); ?>
</td>
</tr>

<?php } ?>

</table>

<?php if(!empty($pedido['observacao'])){ ?>
<div style="margin-top:20px;">
    <h3>Observação</h3>
    <p><?= nl2br($pedido['observacao']); ?></p>
</div>
<?php } ?>

<div style="margin-top:20px;">
    <p><strong>Origem:</strong> <?= $pedido['origem']; ?></p>
    <p><strong>Pagamento:</strong> <?= $pedido['pagamento']; ?></p>
    <p><strong>Status Pagamento:</strong> <?= $pedido['status_pagamento']; ?></p>
</div>

<div class="total">
Total:
R$ <?= number_format($pedido['total'], 2, ',', '.'); ?>
</div>

<div class="botoes">

<a href="pedidos.php" class="btn voltar">⬅ Voltar</a>

<a href="pedido_imprimir.php?id=<?= $pedido['id']; ?>" target="_blank" class="btn imprimir">
🖨 Imprimir
</a>

<a href="pedidos.php?id=<?= $pedido['id']; ?>&status=EM_PREPARO" class="btn preparo">
Em Preparo
</a>

<a href="pedidos.php?id=<?= $pedido['id']; ?>&status=PRONTO" class="btn pronto">
Pronto
</a>

<a href="pedidos.php?id=<?= $pedido['id']; ?>&status=SAIU_ENTREGA" class="btn entrega">
Saiu para Entrega
</a>

<a href="pedidos.php?id=<?= $pedido['id']; ?>&status=ENTREGUE" class="btn entregue">
Entregue
</a>

<a href="pedidos.php?id=<?= $pedido['id']; ?>&status=CANCELADO" class="btn cancelado">
Cancelar
</a>

</div>

</div>

</div>

</div>

</body>
</html>