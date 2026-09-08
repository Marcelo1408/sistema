<?php

session_start();

include 'includes/conexao.php';

?>

<!DOCTYPE html>

<html lang="pt-br">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Acesso Negado</title>

<link rel="stylesheet"
href="assets/css/style.css">

<style>

.negado{

max-width:700px;

margin:50px auto;

background:#fff;

padding:40px;

border-radius:20px;

box-shadow:0 5px 20px rgba(0,0,0,.08);

text-align:center;

}

.negado img{

width:120px;

margin-bottom:20px;

}

.negado h1{

font-size:36px;

color:#dc3545;

margin-bottom:15px;

}

.negado p{

font-size:18px;

color:#666;

margin-bottom:30px;

line-height:30px;

}

.btn-voltar{

display:inline-block;

padding:14px 30px;

background:#ff6b00;

color:#fff;

text-decoration:none;

border-radius:10px;

font-size:18px;

transition:.3s;

}

.btn-voltar:hover{

background:#e45f00;

}

.aviso{

margin-top:25px;

padding:15px;

background:#fff3cd;

border-radius:10px;

color:#856404;

font-size:15px;

}

</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<div class="negado">

<div style="font-size:90px;">
🔒
</div>

<h1>

Acesso Restrito

</h1>

<p>

Seu usuário não possui permissão para acessar esta área.

<br><br>

Caso precise desta funcionalidade,
entre em contato com o administrador do sistema.

</p>

<a
href="dashboard.php"
class="btn-voltar">

🏠 Voltar ao Dashboard

</a>

<div class="aviso">

Usuário logado:

<strong>

<?= $_SESSION['nome']; ?>

</strong>

<br>

Perfil:

<strong>

<?= $_SESSION['nivel']; ?>

</strong>

</div>

</div>

</div>

</div>

</body>

</html>