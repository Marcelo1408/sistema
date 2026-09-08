<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

if(!isset($_GET['produto_id'])){
    header("Location: produtos.php");
    exit;
}

$produto_id = intval($_GET['produto_id']);

$produto = $conn->query("
SELECT *
FROM produtos
WHERE id='$produto_id'
")->fetch_assoc();

if(!$produto){
    die("Produto não encontrado.");
}

if(isset($_POST['salvar'])){

    $conn->query("
    DELETE FROM produto_adicionais
    WHERE produto_id='$produto_id'
    ");

    if(isset($_POST['adicionais'])){

        foreach($_POST['adicionais'] as $adicional_id){

            $adicional_id = intval($adicional_id);

            $conn->query("
            INSERT INTO produto_adicionais
            (produto_id, adicional_id)
            VALUES
            ('$produto_id', '$adicional_id')
            ");
        }
    }

    header("Location: produto_adicionais.php?produto_id=$produto_id&ok=1");
    exit;
}

$adicionais = $conn->query("
SELECT *
FROM adicionais
WHERE ativo=1
ORDER BY nome ASC
");

$selecionados = [];

$res = $conn->query("
SELECT adicional_id
FROM produto_adicionais
WHERE produto_id='$produto_id'
");

while($row = $res->fetch_assoc()){
    $selecionados[] = $row['adicional_id'];
}

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Adicionais do Produto</title>
<link rel="stylesheet" href="assets/css/style.css">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>
.form-card{
    background:#fff;
    padding:25px;
    border-radius:15px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
    max-width:850px;
}

.item-adicional{
    padding:12px;
    border-bottom:1px solid #eee;
}

.btn-salvar{
    background:#198754;
    color:#fff;
    border:none;
    padding:12px 20px;
    border-radius:8px;
    cursor:pointer;
    margin-top:20px;
}

.btn-voltar{
    background:#6c757d;
    color:#fff;
    padding:12px 20px;
    border-radius:8px;
    text-decoration:none;
    margin-left:10px;
}

.alerta{
    background:#d4edda;
    padding:15px;
    border-radius:10px;
    margin-bottom:20px;
}
</style>
</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Adicionais do Produto</h1>

<?php if(isset($_GET['ok'])){ ?>
<div class="alerta">
Adicionais salvos com sucesso.
</div>
<?php } ?>

<div class="form-card">

<h2>
<?= $produto['nome']; ?>
</h2>

<br>

<form method="POST">

<?php while($adicional = $adicionais->fetch_assoc()){ ?>

<div class="item-adicional">

<label>

<input
type="checkbox"
name="adicionais[]"
value="<?= $adicional['id']; ?>"
<?= in_array($adicional['id'], $selecionados) ? 'checked' : ''; ?>
>

<?= $adicional['nome']; ?>

- R$
<?= number_format($adicional['preco'],2,',','.'); ?>

</label>

</div>

<?php } ?>

<button
type="submit"
name="salvar"
class="btn-salvar">

Salvar Adicionais

</button>

<a
href="produtos.php"
class="btn-voltar">

Voltar

</a>

</form>

</div>

</div>

</div>

</body>
</html>