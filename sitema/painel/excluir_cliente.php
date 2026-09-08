<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

if(!isset($_GET['id'])){

    header("Location: clientes.php");
    exit;
}

$id = intval($_GET['id']);

/*
|--------------------------------------------------------------------------
| VERIFICA CLIENTE
|--------------------------------------------------------------------------
*/

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
| VERIFICA PEDIDOS
|--------------------------------------------------------------------------
*/

$pedidos = $conn->query("
SELECT COUNT(*) total
FROM pedidos
WHERE cliente_id='$id'
")->fetch_assoc();

$totalPedidos = $pedidos['total'];

/*
|--------------------------------------------------------------------------
| EXCLUIR
|--------------------------------------------------------------------------
*/

if(isset($_POST['confirmar'])){

    if($totalPedidos > 0){

        die("
        <h2>Não é possível excluir este cliente.</h2>
        <p>Existem pedidos vinculados ao cadastro.</p>
        <a href='clientes.php'>Voltar</a>
        ");
    }

    $conn->query("
    DELETE FROM clientes
    WHERE id='$id'
    ");

    header("Location: clientes.php");
    exit;
}

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Excluir Cliente</title>

<link rel="stylesheet"
href="assets/css/style.css">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>

.confirmacao{

background:#fff;
padding:30px;
border-radius:15px;
box-shadow:0 3px 15px rgba(0,0,0,.08);
max-width:700px;
}

.alerta{

font-size:18px;
margin-bottom:20px;
color:#dc3545;
}

.info{

margin-bottom:10px;
}

.botoes{

margin-top:25px;
display:flex;
gap:10px;
}

.btn-excluir{

background:#dc3545;
color:#fff;
border:none;
padding:12px 20px;
border-radius:8px;
cursor:pointer;
}

.btn-voltar{

background:#6c757d;
color:#fff;
padding:12px 20px;
border-radius:8px;
text-decoration:none;
}

.aviso{

background:#fff3cd;
padding:15px;
border-radius:10px;
margin-top:20px;
}

</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Excluir Cliente</h1>

<div class="confirmacao">

<div class="alerta">

⚠ Tem certeza que deseja excluir este cliente?

</div>

<p class="info">

<strong>Nome:</strong>
<?= $cliente['nome']; ?>

</p>

<p class="info">

<strong>Telefone:</strong>
<?= $cliente['telefone']; ?>

</p>

<p class="info">

<strong>Total de Pedidos:</strong>
<?= $totalPedidos; ?>

</p>

<?php if($totalPedidos > 0){ ?>

<div class="aviso">

Este cliente possui pedidos cadastrados e não pode ser excluído.

</div>

<?php } ?>

<div class="botoes">

<?php if($totalPedidos == 0){ ?>

<form method="POST">

<button
type="submit"
name="confirmar"
class="btn-excluir">

🗑 Excluir Cliente

</button>

</form>

<?php } ?>

<a
href="clientes.php"
class="btn-voltar">

⬅ Voltar

</a>

</div>

</div>

</div>

</div>

</body>

</html>