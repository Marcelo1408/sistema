
<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

if(!isset($_GET['id'])){

    header("Location: clientes.php");
    exit;
}

$id = intval($_GET['id']);

$cliente = $conn->query("
SELECT *
FROM clientes
WHERE id='$id'
");

if($cliente->num_rows == 0){

    die("Cliente não encontrado.");
}

$cliente = $cliente->fetch_assoc();

/*
|--------------------------------------------------------------------------
| PEDIDOS DO CLIENTE
|--------------------------------------------------------------------------
*/

$pedidos = $conn->query("
SELECT *
FROM pedidos
WHERE cliente_id='$id'
ORDER BY id DESC
");

$totalPedidos = $cliente['total_pedidos'];
$valorGasto = $cliente['valor_gasto'];

$ticketMedio = 0;

if($totalPedidos > 0){

    $ticketMedio =
    $valorGasto / $totalPedidos;
}

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>
Cliente #<?= $cliente['id']; ?>
</title>

<link rel="stylesheet"
href="assets/css/style.css">

<style>

.detalhes-card{

background:#fff;
padding:25px;
border-radius:15px;
box-shadow:0 3px 15px rgba(0,0,0,.08);
margin-bottom:25px;
}

.dashboard{

display:grid;
grid-template-columns:
repeat(auto-fit,minmax(220px,1fr));
gap:20px;
margin-bottom:25px;
}

.card-info{

background:#fff;
padding:20px;
border-radius:15px;
box-shadow:0 3px 12px rgba(0,0,0,.08);
}

.card-info h2{

margin-top:10px;
color:#ff6b00;
}

.info{

margin-bottom:10px;
}

.info strong{

color:#333;
}

.table-box{

background:#fff;
padding:20px;
border-radius:15px;
box-shadow:0 3px 12px rgba(0,0,0,.08);
}

.btn-voltar{

display:inline-block;
margin-top:20px;
background:#6c757d;
color:#fff;
padding:10px 15px;
border-radius:8px;
text-decoration:none;
}

.status{

padding:5px 10px;
border-radius:20px;
font-size:12px;
font-weight:bold;
background:#d4edda;
}

</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Detalhes do Cliente</h1>

<div class="dashboard">

<div class="card-info">

<h4>Total de Pedidos</h4>

<h2>
<?= $totalPedidos ?>
</h2>

</div>

<div class="card-info">

<h4>Valor Gasto</h4>

<h2>
R$
<?= number_format(
$valorGasto,
2,
',',
'.'
) ?>
</h2>

</div>

<div class="card-info">

<h4>Ticket Médio</h4>

<h2>
R$
<?= number_format(
$ticketMedio,
2,
',',
'.'
) ?>
</h2>

</div>

</div>

<div class="detalhes-card">

<h2>
<?= $cliente['nome']; ?>
</h2>

<br>

<p class="info">

<strong>Telefone:</strong>

<?= $cliente['telefone']; ?>

</p>

<p class="info">

<strong>Endereço:</strong>

<?= $cliente['endereco']; ?>

</p>

<p class="info">

<strong>Número:</strong>

<?= $cliente['numero']; ?>

</p>

<p class="info">

<strong>Bairro:</strong>

<?= $cliente['bairro']; ?>

</p>

<?php if(!empty($cliente['complemento'])){ ?>

<p class="info">

<strong>Complemento:</strong>

<?= $cliente['complemento']; ?>

</p>

<?php } ?>

<?php if(!empty($cliente['referencia'])){ ?>

<p class="info">

<strong>Referência:</strong>

<?= $cliente['referencia']; ?>

</p>

<?php } ?>

<p class="info">

<strong>Data Cadastro:</strong>

<?= date(
'd/m/Y H:i',
strtotime(
$cliente['criado_em']
)
); ?>

</p>

</div>

<div class="table-box">

<h2>
Histórico de Pedidos
</h2>

<br>

<table>

<tr>

<th>ID</th>
<th>Total</th>
<th>Pagamento</th>
<th>Status</th>
<th>Data</th>

</tr>

<?php

if($pedidos->num_rows > 0){

while(
$pedido =
$pedidos->fetch_assoc()
){

?>

<tr>

<td>

#<?= $pedido['id']; ?>

</td>

<td>

R$
<?= number_format(
$pedido['total'],
2,
',',
'.'
) ?>

</td>

<td>

<?= $pedido['pagamento']; ?>

</td>

<td>

<span class="status">

<?= $pedido['status']; ?>

</span>

</td>

<td>

<?= date(
'd/m/Y H:i',
strtotime(
$pedido['criado_em']
)
); ?>

</td>

</tr>

<?php

}

}else{

?>

<tr>

<td colspan="5">

Nenhum pedido encontrado.

</td>

</tr>

<?php } ?>

</table>

<a
href="clientes.php"
class="btn-voltar">

⬅ Voltar

</a>

</div>

</div>

</div>

</body>

</html>
