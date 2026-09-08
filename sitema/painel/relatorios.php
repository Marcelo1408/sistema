<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

/*
|--------------------------------------------------------------------------
| CARDS
|--------------------------------------------------------------------------
*/

$totalPedidos = $conn->query("
SELECT COUNT(*) total
FROM pedidos
")->fetch_assoc();

$faturamentoHoje = $conn->query("
SELECT COALESCE(SUM(total),0) total
FROM pedidos
WHERE DATE(criado_em)=CURDATE()
AND status='ENTREGUE'
")->fetch_assoc();

$faturamentoMes = $conn->query("
SELECT COALESCE(SUM(total),0) total
FROM pedidos
WHERE MONTH(criado_em)=MONTH(CURDATE())
AND YEAR(criado_em)=YEAR(CURDATE())
AND status='ENTREGUE'
")->fetch_assoc();

$ticketMedio = $conn->query("
SELECT COALESCE(AVG(total),0) total
FROM pedidos
WHERE status='ENTREGUE'
")->fetch_assoc();

$totalClientes = $conn->query("
SELECT COUNT(*) total
FROM clientes
")->fetch_assoc();

/*
|--------------------------------------------------------------------------
| PRODUTOS MAIS VENDIDOS
|--------------------------------------------------------------------------
*/

$produtosVendidos = $conn->query("
SELECT
p.nome,
SUM(ip.quantidade) vendidos

FROM itens_pedido ip

LEFT JOIN produtos p
ON p.id = ip.produto_id

GROUP BY ip.produto_id

ORDER BY vendidos DESC

LIMIT 10
");

/*
|--------------------------------------------------------------------------
| CLIENTES QUE MAIS COMPRAM
|--------------------------------------------------------------------------
*/

$clientesTop = $conn->query("
SELECT
c.nome,
COUNT(pe.id) pedidos,
COALESCE(SUM(pe.total),0) total_gasto

FROM clientes c

LEFT JOIN pedidos pe
ON pe.cliente_id = c.id

GROUP BY c.id

ORDER BY total_gasto DESC

LIMIT 10
");

/*
|--------------------------------------------------------------------------
| PEDIDOS POR STATUS
|--------------------------------------------------------------------------
*/

$statusPedidos = $conn->query("
SELECT
status,
COUNT(*) total

FROM pedidos

GROUP BY status
");

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatórios</title>

<link rel="stylesheet"
href="assets/css/style.css">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>

.cards{
display:grid;
grid-template-columns:
repeat(auto-fit,minmax(220px,1fr));
gap:20px;
margin-bottom:30px;
}

.card{
background:#fff;
padding:25px;
border-radius:15px;
box-shadow:0 3px 15px rgba(0,0,0,.08);
}

.card h4{
color:#777;
margin-bottom:10px;
}

.card h2{
font-size:28px;
}

.bloco{
background:#fff;
padding:25px;
border-radius:15px;
margin-bottom:25px;
box-shadow:0 3px 15px rgba(0,0,0,.08);
}

.bloco h3{
margin-bottom:20px;
}

table{
width:100%;
border-collapse:collapse;
}

table th{
background:#f5f5f5;
padding:12px;
text-align:left;
}

table td{
padding:12px;
border-bottom:1px solid #eee;
}

</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1 style="margin-bottom:25px;">
Relatórios
</h1>

<div class="cards">

<div class="card">

<h4>Total de Pedidos</h4>

<h2>
<?= $totalPedidos['total']; ?>
</h2>

</div>

<div class="card">

<h4>Faturamento Hoje</h4>

<h2>
R$
<?= number_format(
$faturamentoHoje['total'],
2,
',',
'.'
); ?>
</h2>

</div>

<div class="card">

<h4>Faturamento Mês</h4>

<h2>
R$
<?= number_format(
$faturamentoMes['total'],
2,
',',
'.'
); ?>
</h2>

</div>

<div class="card">

<h4>Ticket Médio</h4>

<h2>
R$
<?= number_format(
$ticketMedio['total'],
2,
',',
'.'
); ?>
</h2>

</div>

<div class="card">

<h4>Clientes</h4>

<h2>
<?= $totalClientes['total']; ?>
</h2>

</div>

</div>

<div class="bloco">

<h3>
🥩 Produtos Mais Vendidos
</h3>

<table>

<tr>
<th>Produto</th>
<th>Quantidade Vendida</th>
</tr>

<?php while($produto = $produtosVendidos->fetch_assoc()){ ?>

<tr>

<td>
<?= $produto['nome']; ?>
</td>

<td>
<?= $produto['vendidos']; ?>
</td>

</tr>

<?php } ?>

</table>

</div>

<div class="bloco">

<h3>
👥 Clientes que Mais Compram
</h3>

<table>

<tr>
<th>Cliente</th>
<th>Pedidos</th>
<th>Total Gasto</th>
</tr>

<?php while($cliente = $clientesTop->fetch_assoc()){ ?>

<tr>

<td>
<?= $cliente['nome']; ?>
</td>

<td>
<?= $cliente['pedidos']; ?>
</td>

<td>

R$
<?= number_format(
$cliente['total_gasto'],
2,
',',
'.'
); ?>

</td>

</tr>

<?php } ?>

</table>

</div>

<div class="bloco">

<h3>
📦 Pedidos por Status
</h3>

<table>

<tr>
<th>Status</th>
<th>Quantidade</th>
</tr>

<?php while($status = $statusPedidos->fetch_assoc()){ ?>

<tr>

<td>
<?= $status['status']; ?>
</td>

<td>
<?= $status['total']; ?>
</td>

</tr>

<?php } ?>

</table>

</div>

</div>

</div>

</body>

</html>

