<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

if(!isset($_GET['id'])){

    header("Location: categorias.php");
    exit;
}

$id = intval($_GET['id']);

/*
|--------------------------------------------------------------------------
| BUSCA CATEGORIA
|--------------------------------------------------------------------------
*/

$categoria = $conn->query("
SELECT *
FROM categorias
WHERE id='$id'
");

if($categoria->num_rows == 0){

    die("Categoria não encontrada.");
}

$categoria = $categoria->fetch_assoc();

/*
|--------------------------------------------------------------------------
| VERIFICA PRODUTOS
|--------------------------------------------------------------------------
*/

$produtos = $conn->query("
SELECT COUNT(*) total
FROM produtos
WHERE categoria_id='$id'
");

$produtos = $produtos->fetch_assoc();

$totalProdutos = $produtos['total'];

/*
|--------------------------------------------------------------------------
| EXCLUIR
|--------------------------------------------------------------------------
*/

if(isset($_POST['confirmar'])){

    if($totalProdutos > 0){

        die("
        <h2>Não é possível excluir esta categoria.</h2>
        <p>Existem produtos vinculados a ela.</p>
        <a href='categorias.php'>Voltar</a>
        ");
    }

    $conn->query("
    DELETE FROM categorias
    WHERE id='$id'
    ");

    header("Location: categorias.php");
    exit;
}

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Excluir Categoria</title>

<link rel="stylesheet"
href="assets/css/style.css">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>

.confirmacao{
    background:#fff;
    padding:30px;
    border-radius:15px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
    max-width:800px;
}

.alerta{
    color:#dc3545;
    font-size:20px;
    margin-bottom:20px;
}

.info{
    margin-bottom:10px;
}

.aviso{
    background:#fff3cd;
    padding:15px;
    border-radius:10px;
    margin-top:20px;
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

</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Excluir Categoria</h1>

<div class="confirmacao">

<div class="alerta">

⚠ Tem certeza que deseja excluir esta categoria?

</div>

<p class="info">

<strong>ID:</strong>
<?= $categoria['id']; ?>

</p>

<p class="info">

<strong>Categoria:</strong>
<?= htmlspecialchars($categoria['nome']); ?>

</p>

<p class="info">

<strong>Produtos vinculados:</strong>
<?= $totalProdutos; ?>

</p>

<?php if($totalProdutos > 0){ ?>

<div class="aviso">

Esta categoria possui produtos cadastrados e não pode ser excluída.

</div>

<?php } ?>

<div class="botoes">

<?php if($totalProdutos == 0){ ?>

<form method="POST">

<button
type="submit"
name="confirmar"
class="btn-excluir">

🗑 Excluir Categoria

</button>

</form>

<?php } ?>

<a
href="categorias.php"
class="btn-voltar">

⬅ Voltar

</a>

</div>

</div>

</div>

</div>

</body>

</html>

