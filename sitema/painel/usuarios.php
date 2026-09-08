<?php

session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

somenteAdm();

if(isset($_POST['salvar'])){

    $nome = $conn->real_escape_string($_POST['nome']);
    $usuario = $conn->real_escape_string($_POST['usuario']);
    $senha = md5($_POST['senha']);
    $nivel = $_POST['nivel'];

    $conn->query("
    INSERT INTO usuarios_sistema
    (nome, usuario, senha, nivel, ativo)
    VALUES
    ('$nome', '$usuario', '$senha', '$nivel', 1)
    ");

    header("Location: usuarios.php");
    exit;
}

if(isset($_GET['excluir'])){

    $id = intval($_GET['excluir']);

    $user = $conn->query("
    SELECT *
    FROM usuarios_sistema
    WHERE id='$id'
    ")->fetch_assoc();

    if($user && $user['nivel'] != 'ADM'){

        $conn->query("
        DELETE FROM usuarios_sistema
        WHERE id='$id'
        ");
    }

    header("Location: usuarios.php");
    exit;
}

$usuarios = $conn->query("
SELECT *
FROM usuarios_sistema
ORDER BY id DESC
");

?>

<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Usuários</title>
<link rel="apple-touch-icon" href="icons/icon-192.png">
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
.form-group select{
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

.badge-adm{
    background:#fff3cd;
    padding:5px 10px;
    border-radius:20px;
}

.badge-gerente{
    background:#d4edda;
    padding:5px 10px;
    border-radius:20px;
}
</style>
</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Usuários do Sistema</h1>

<div class="form-card">

<h2>Novo Usuário</h2>
<br>

<form method="POST">

<div class="form-group">
<label>Nome</label>
<input type="text" name="nome" required>
</div>

<div class="form-group">
<label>Usuário</label>
<input type="text" name="usuario" required>
</div>

<div class="form-group">
<label>Senha</label>
<input type="password" name="senha" required>
</div>

<div class="form-group">
<label>Nível</label>
<select name="nivel">
<option value="GERENTE">Gerente</option>
<option value="ADM">Administrador</option>
</select>
</div>

<button type="submit" name="salvar" class="btn-salvar">
Cadastrar Usuário
</button>

</form>

</div>

<div class="table-box">

<h2>Usuários Cadastrados</h2>
<br>

<table>

<tr>
<th>ID</th>
<th>Nome</th>
<th>Usuário</th>
<th>Nível</th>
<th>Ações</th>
</tr>

<?php while($u = $usuarios->fetch_assoc()){ ?>

<tr>

<td><?= $u['id']; ?></td>

<td><?= $u['nome']; ?></td>

<td><?= $u['usuario']; ?></td>

<td>
<?php if($u['nivel'] == 'ADM'){ ?>
<span class="badge-adm">ADM</span>
<?php }else{ ?>
<span class="badge-gerente">GERENTE</span>
<?php } ?>
</td>

<td>

<?php if($u['nivel'] != 'ADM'){ ?>

<a
href="?excluir=<?= $u['id']; ?>"
style="color:red;"
onclick="return confirm('Excluir este gerente?')">

Excluir

</a>

<?php }else{ ?>

Protegido

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