<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

if(!isset($_GET['id'])){

    header("Location: clientes.php");
    exit;
}

$id = intval($_GET['id']);

if(isset($_POST['salvar'])){

    $nome = $conn->real_escape_string($_POST['nome']);
    $telefone = $conn->real_escape_string($_POST['telefone']);
    $endereco = $conn->real_escape_string($_POST['endereco']);
    $numero = $conn->real_escape_string($_POST['numero']);
    $bairro = $conn->real_escape_string($_POST['bairro']);
    $complemento = $conn->real_escape_string($_POST['complemento']);
    $referencia = $conn->real_escape_string($_POST['referencia']);

    $conn->query("
    UPDATE clientes SET
    nome='$nome',
    telefone='$telefone',
    endereco='$endereco',
    numero='$numero',
    bairro='$bairro',
    complemento='$complemento',
    referencia='$referencia'
    WHERE id='$id'
    ");

    header("Location: cliente_detalhes.php?id=".$id);
    exit;
}

$cliente = $conn->query("
SELECT *
FROM clientes
WHERE id='$id'
");

if($cliente->num_rows == 0){

    die("Cliente não encontrado.");
}

$cliente = $cliente->fetch_assoc();

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Editar Cliente</title>

<link rel="stylesheet"
href="assets/css/style.css">

<style>

.form-card{

background:#fff;
padding:25px;
border-radius:15px;
box-shadow:0 3px 15px rgba(0,0,0,.08);
max-width:900px;
}

.form-group{

margin-bottom:15px;
}

.form-group label{

display:block;
margin-bottom:5px;
font-weight:bold;
}

.form-group input{

width:100%;
padding:10px;
border:1px solid #ddd;
border-radius:8px;
}

.botoes{

margin-top:20px;
display:flex;
gap:10px;
}

.btn-salvar{

background:#198754;
color:#fff;
padding:10px 20px;
border:none;
border-radius:8px;
cursor:pointer;
}

.btn-voltar{

background:#6c757d;
color:#fff;
padding:10px 20px;
border-radius:8px;
text-decoration:none;
}

</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Editar Cliente</h1>

<div class="form-card">

<form method="POST">

<div class="form-group">
<label>Nome</label>
<input
type="text"
name="nome"
value="<?= $cliente['nome']; ?>"
required>
</div>

<div class="form-group">
<label>Telefone</label>
<input
type="text"
name="telefone"
value="<?= $cliente['telefone']; ?>">
</div>

<div class="form-group">
<label>Endereço</label>
<input
type="text"
name="endereco"
value="<?= $cliente['endereco']; ?>">
</div>

<div class="form-group">
<label>Número</label>
<input
type="text"
name="numero"
value="<?= $cliente['numero']; ?>">
</div>

<div class="form-group">
<label>Bairro</label>
<input
type="text"
name="bairro"
value="<?= $cliente['bairro']; ?>">
</div>

<div class="form-group">
<label>Complemento</label>
<input
type="text"
name="complemento"
value="<?= $cliente['complemento']; ?>">
</div>

<div class="form-group">
<label>Referência</label>
<input
type="text"
name="referencia"
value="<?= $cliente['referencia']; ?>">
</div>

<div class="botoes">

<button
type="submit"
name="salvar"
class="btn-salvar">

Salvar Alterações

</button>

<a
href="cliente_detalhes.php?id=<?= $cliente['id']; ?>"
class="btn-voltar">

Voltar

</a>

</div>

</form>

</div>

</div>

</div>

</body>

</html>

