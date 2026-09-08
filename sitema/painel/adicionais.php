<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

if(isset($_POST['salvar'])){

    $nome = $conn->real_escape_string($_POST['nome']);
    $descricao = $conn->real_escape_string($_POST['descricao']);
    $preco = $conn->real_escape_string($_POST['preco']);

    $conn->query("
    INSERT INTO adicionais
    (nome, descricao, preco, ativo)
    VALUES
    ('$nome', '$descricao', '$preco', 1)
    ");

    header("Location: adicionais.php");
    exit;
}

if(isset($_GET['acao']) && isset($_GET['id'])){

    $id = intval($_GET['id']);

    if($_GET['acao'] == 'ativar'){
        $conn->query("UPDATE adicionais SET ativo=1 WHERE id='$id'");
    }

    if($_GET['acao'] == 'desativar'){
        $conn->query("UPDATE adicionais SET ativo=0 WHERE id='$id'");
    }

    header("Location: adicionais.php");
    exit;
}

$adicionais = $conn->query("
SELECT *
FROM adicionais
ORDER BY id DESC
");

?>

<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Adicionais</title>
<link rel="stylesheet" href="assets/css/style.css">

<style>
.form-card,
.table-box{
    background:#fff;
    padding:25px;
    border-radius:15px;
    margin-bottom:25px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
}

.form-group{
    margin-bottom:15px;
}

.form-group label{
    display:block;
    margin-bottom:5px;
    font-weight:bold;
}

.form-group input,
.form-group textarea{
    width:100%;
    padding:10px;
    border:1px solid #ddd;
    border-radius:8px;
}

.btn-salvar{
    background:#198754;
    color:#fff;
    border:none;
    padding:12px 20px;
    border-radius:8px;
    cursor:pointer;
}

.badge-ativo{
    background:#d4edda;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}

.badge-inativo{
    background:#f8d7da;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}

.acoes a{
    text-decoration:none;
    margin-right:10px;
}
</style>
</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Adicionais</h1>

<div class="form-card">

<h2>Novo Adicional</h2>
<br>

<form method="POST">

<div class="form-group">
<label>Nome</label>
<input type="text" name="nome" placeholder="Ex: Farofa, Vinagrete, Molho..." required>
</div>

<div class="form-group">
<label>Descrição</label>
<textarea name="descricao" rows="3" placeholder="Descrição opcional"></textarea>
</div>

<div class="form-group">
<label>Preço</label>
<input type="number" step="0.01" name="preco" placeholder="Ex: 2.00" required>
</div>

<button type="submit" name="salvar" class="btn-salvar">
Salvar Adicional
</button>

</form>

</div>

<div class="table-box">

<h2>Adicionais Cadastrados</h2>
<br>

<table>

<tr>
<th>ID</th>
<th>Nome</th>
<th>Descrição</th>
<th>Preço</th>
<th>Status</th>
<th>Ações</th>
</tr>

<?php while($adicional = $adicionais->fetch_assoc()){ ?>

<tr>

<td><?= $adicional['id']; ?></td>

<td><?= $adicional['nome']; ?></td>

<td><?= $adicional['descricao']; ?></td>

<td>
R$ <?= number_format($adicional['preco'],2,',','.'); ?>
</td>

<td>
<?php if($adicional['ativo']){ ?>
<span class="badge-ativo">Ativo</span>
<?php }else{ ?>
<span class="badge-inativo">Inativo</span>
<?php } ?>
</td>

<td class="acoes">

<?php if($adicional['ativo']){ ?>

<a href="?acao=desativar&id=<?= $adicional['id']; ?>" style="color:red;">
Desativar
</a>

<?php }else{ ?>

<a href="?acao=ativar&id=<?= $adicional['id']; ?>" style="color:green;">
Ativar
</a>

<?php } ?>

</td>

</tr>

<?php } ?>

</table>

</div>

</div>

</div>

</body>
</html>